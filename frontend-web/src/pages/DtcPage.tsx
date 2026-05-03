import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import {
  clearDtc,
  getAiInsights,
  getAiRecommendations,
  getAiRiskScore,
  getDtcHistory,
  getTelemetryHistory,
  listDtcByVehicle,
  listVehicles,
  pingDtc,
} from '../lib/api/endpoints';

type TelemetryPoint = {
  timestamp: string;
  value: number;
};

type TelemetryHistoryResponse = {
  status?: string;
  vehicle_id?: number;
  data?: Record<string, TelemetryPoint[]>;
};

type DtcRow = {
  id?: string;
  vehicle_id: number;
  code?: string;
  dtc_code?: string;
  severity?: string;
  description?: string;
  resolved?: boolean;
  created_at?: string;
  firstOccurrence: string;
  lastOccurrence: string;
  count: number;
};

type PredictedRisk = {
  type?: string;
  severity?: string;
  message?: string;
};

type SystemStatus = {
  key: string;
  label: string;
  status: 'ok' | 'warn' | 'danger';
  detail: string;
};

function getErrorMessage(error: unknown) {
  const data = (error as { response?: { data?: { message?: string; detail?: string } } })?.response?.data;
  return data?.message ?? data?.detail ?? 'Request failed.';
}

function parseBackendDate(value?: string | null) {
  if (!value) return null;
  const direct = Date.parse(value);
  if (!Number.isNaN(direct)) return new Date(direct);

  const match = value.match(/^(\d{2})\/([A-Za-z]{3})\/(\d{4})\s+(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, day, mon, year, hour, minute] = match;
  const monthMap: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  const month = monthMap[mon.toLowerCase()];
  if (month === undefined) return null;
  return new Date(Number(year), month, Number(day), Number(hour), Number(minute));
}

function formatShortDate(value?: string | null) {
  if (!value) return '-';
  const parsed = parseBackendDate(value);
  if (!parsed) return value;
  return `${String(parsed.getDate()).padStart(2, '0')}/${String(parsed.getMonth() + 1).padStart(2, '0')} ${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`;
}

function formatMetric(value: number | null | undefined, suffix = '', maximumFractionDigits = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) return `0${suffix}`;
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits }).format(value)}${suffix}`;
}

function normalizeDtcCode(row: { code?: string; dtc_code?: string }) {
  return String(row.code ?? row.dtc_code ?? '').trim().toUpperCase();
}

function severityToTone(value?: string): 'ok' | 'warn' | 'danger' {
  const severity = String(value ?? '').toLowerCase();
  if (severity === 'critical') return 'danger';
  if (severity === 'warning') return 'warn';
  return 'ok';
}

function toneLabel(value: 'ok' | 'warn' | 'danger') {
  if (value === 'danger') return 'Defaut';
  if (value === 'warn') return 'Avert.';
  return 'OK';
}

function findMetricValue(data: TelemetryHistoryResponse | undefined, metric: string) {
  const points = data?.data?.[metric] ?? [];
  if (!points.length) return null;
  return points[points.length - 1]?.value ?? null;
}

function findMetricTimestamp(data: TelemetryHistoryResponse | undefined, metric: string) {
  const points = data?.data?.[metric] ?? [];
  if (!points.length) return null;
  return points[points.length - 1]?.timestamp ?? null;
}

function buildSystemStatuses(rows: DtcRow[], fuelLevel: number | null, predictedRisks: PredictedRisk[] = []): SystemStatus[] {
  const activeRows = rows.filter((row) => !row.resolved);

  const evaluate = (label: string, patterns: RegExp[], riskTypes: string[] = []) => {
    const matchedRow = activeRows.find((row) => patterns.some((pattern) => pattern.test(normalizeDtcCode(row))));
    const matchedRisk = predictedRisks.find((risk) => riskTypes.includes(String(risk.type ?? '').toLowerCase()));
    const rowTone = matchedRow ? severityToTone(matchedRow.severity) : 'ok';
    const riskTone = matchedRisk ? severityToTone(matchedRisk.severity) : 'ok';

    const status = rowTone === 'danger' || riskTone === 'danger'
      ? 'danger'
      : rowTone === 'warn' || riskTone === 'warn'
        ? 'warn'
        : 'ok';

    const detail = matchedRow?.description
      ?? matchedRisk?.message
      ?? 'Aucun probleme detecte';

    return { key: label.toLowerCase(), label, status, detail } as SystemStatus;
  };

  const fuelStatus = evaluate('Carburant', [/^P017/, /^P008/, /^P019/, /^P023/, /^P025/], ['fuel']);
  if (fuelStatus.status === 'ok' && fuelLevel !== null && fuelLevel < 15) {
    fuelStatus.status = 'warn';
    fuelStatus.detail = 'Niveau carburant faible';
  }

  return [
    evaluate('Catalyseur', [/^P042/, /^P043/], ['exhaust', 'catalyst']),
    evaluate('Sonde O2', [/^P013/, /^P014/, /^P015/, /^P016/], ['oxygen_sensor']),
    evaluate('Systeme EGR', [/^P040/], ['egr']),
    evaluate('Evaporation carb.', [/^P044/, /^P045/, /^P046/], ['evap']),
    evaluate('Allumage', [/^P03/], ['ignition', 'misfire']),
    fuelStatus,
  ];
}

function DtcTrendChart({ points }: { points: TelemetryPoint[] }) {
  if (points.length < 2) {
    return <p className="muted-note">Pas assez de donnees moteur pour afficher la courbe.</p>;
  }

  const displayPoints = points.slice(-8);
  const W = 900;
  const H = 250;
  const PL = 52;
  const PR = 20;
  const PT = 16;
  const PB = 34;
  const cW = W - PL - PR;
  const cH = H - PT - PB;
  const values = displayPoints.map((point) => point.value);
  const minValue = Math.min(...values, 85);
  const maxValue = Math.max(...values, 100);
  const minY = Math.max(0, Math.floor(minValue) - 1);
  const maxY = Math.ceil(maxValue) + 1;

  const tickCandidates = [85, 88, 90, 92, 94, 96, 98, 100].filter((tick) => tick >= minY && tick <= maxY);
  const ticks = tickCandidates.length ? tickCandidates : [minY, maxY];

  const sx = (i: number) => PL + (i / Math.max(1, displayPoints.length - 1)) * cW;
  const sy = (val: number) => PT + (1 - (val - minY) / Math.max(1, maxY - minY)) * cH;

  const line = displayPoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${sx(index).toFixed(1)},${sy(point.value).toFixed(1)}`)
    .join(' ');
  const area = `${line} L${sx(displayPoints.length - 1).toFixed(1)},${H - PB} L${sx(0).toFixed(1)},${H - PB} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="dtc-curve-svg" role="img" aria-label="Temperature trend">
      {ticks.map((tick) => (
        <g key={tick}>
          <line x1={PL} y1={sy(tick)} x2={W - PR} y2={sy(tick)} stroke="rgba(113, 145, 189, 0.22)" strokeWidth="1" />
          <text x={PL - 10} y={sy(tick) + 4} textAnchor="end" fontSize="12" fill="#4a6b90">{tick}°C</text>
        </g>
      ))}
      <path d={area} fill="rgba(254, 202, 202, 0.45)" />
      <path d={line} fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <line x1={PL} y1={sy(90)} x2={W - PR} y2={sy(90)} stroke="#f59e0b" strokeWidth="2" strokeDasharray="8 6" />
      {displayPoints.map((point, index) => (
        <text key={`${point.timestamp}-${index}`} x={sx(index)} y={H - 10} textAnchor="middle" fontSize="12" fill="#4a6b90">
          {formatShortDate(point.timestamp).slice(-5)}
        </text>
      ))}
    </svg>
  );
}

export function DtcPage() {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [dateInput, setDateInput] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [dateError, setDateError] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');

  const vehiclesQuery = useQuery({
    queryKey: ['vehicles'],
    queryFn: listVehicles,
  });

  useEffect(() => {
    if (selectedVehicleId !== null) return;
    const firstVehicleId = vehiclesQuery.data?.items?.[0]?.id;
    if (firstVehicleId) {
      setSelectedVehicleId(firstVehicleId);
    }
  }, [selectedVehicleId, vehiclesQuery.data]);

  const dtcQuery = useQuery({
    queryKey: ['dtc', selectedVehicleId],
    queryFn: () => listDtcByVehicle(selectedVehicleId as number, 500),
    enabled: selectedVehicleId !== null,
  });

  const telemetryQuery = useQuery({
    queryKey: ['dtc-telemetry', selectedVehicleId],
    queryFn: () => getTelemetryHistory({
      vehicle_id: selectedVehicleId as number,
      interval: '1m',
      metrics: ['speed', 'rpm', 'fuel_level', 'engine_temp', 'battery_voltage', 'engine_load', 'intake_temp', 'ambient_air_temp'],
    }) as Promise<TelemetryHistoryResponse>,
    enabled: selectedVehicleId !== null,
  });

  const aiRiskQuery = useQuery({
    queryKey: ['dtc-ai-risk', selectedVehicleId],
    queryFn: () => getAiRiskScore(selectedVehicleId as number),
    enabled: selectedVehicleId !== null,
    retry: false,
  });

  const aiRecommendationsQuery = useQuery({
    queryKey: ['dtc-ai-recommendations', selectedVehicleId],
    queryFn: () => getAiRecommendations(selectedVehicleId as number),
    enabled: selectedVehicleId !== null,
    retry: false,
  });

  const aiInsightsQuery = useQuery({
    queryKey: ['dtc-ai-insights', selectedVehicleId],
    queryFn: () => getAiInsights(selectedVehicleId as number),
    enabled: selectedVehicleId !== null,
    retry: false,
  });

  const pingMutation = useMutation({
    mutationFn: pingDtc,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['dtc', selectedVehicleId] }),
        queryClient.invalidateQueries({ queryKey: ['dtc-telemetry', selectedVehicleId] }),
        queryClient.invalidateQueries({ queryKey: ['dtc-ai-risk', selectedVehicleId] }),
        queryClient.invalidateQueries({ queryKey: ['dtc-ai-recommendations', selectedVehicleId] }),
        queryClient.invalidateQueries({ queryKey: ['dtc-ai-insights', selectedVehicleId] }),
      ]);
      setActionError('');
      setActionMessage('Scan complet termine et donnees actualisees.');
    },
    onError: (error) => {
      setActionMessage('');
      setActionError(getErrorMessage(error));
    },
  });

  const historyMutation = useMutation({
    mutationFn: getDtcHistory,
    onSuccess: () => {
      setActionError('');
      setActionMessage('History loaded successfully.');
    },
    onError: (error) => {
      setActionMessage('');
      setActionError(getErrorMessage(error));
    },
  });

  const clearMutation = useMutation({
    mutationFn: clearDtc,
    onSuccess: async () => {
      setActionError('');
      setActionMessage('DTC clear executed.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['dtc', selectedVehicleId] }),
        queryClient.invalidateQueries({ queryKey: ['dtc-ai-risk', selectedVehicleId] }),
        queryClient.invalidateQueries({ queryKey: ['dtc-ai-recommendations', selectedVehicleId] }),
        queryClient.invalidateQueries({ queryKey: ['dtc-ai-insights', selectedVehicleId] }),
      ]);
    },
    onError: (error) => {
      setActionMessage('');
      setActionError(getErrorMessage(error));
    },
  });

  const fromDate = dateFilter ? new Date(dateFilter) : null;
  const hasValidDateRange = !fromDate || !Number.isNaN(fromDate.getTime());

  const rows = useMemo<DtcRow[]>(() => {
    const items = dtcQuery.data?.items ?? [];

    return items
      .filter((item) => {
        const codeValue = String(item.code ?? item.dtc_code ?? '').toLowerCase();
        const descValue = String(item.description ?? '').toLowerCase();
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return codeValue.includes(q) || descValue.includes(q);
      })
      .filter((item) => {
        if (!hasValidDateRange || !fromDate) return true;
        const rowDate = parseBackendDate(
          (item as { first_detected?: string; last_occurrence?: string; created_at?: string }).last_occurrence
          ?? (item as { first_detected?: string; last_occurrence?: string; created_at?: string }).first_detected
          ?? item.created_at,
        );
        if (!rowDate) return true;
        return rowDate >= fromDate;
      })
      .map((item) => ({
        ...item,
        firstOccurrence: (item as { first_detected?: string; created_at?: string }).first_detected ?? item.created_at ?? '-',
        lastOccurrence: (item as { last_occurrence?: string; created_at?: string }).last_occurrence ?? item.created_at ?? '-',
        count: (item as { occurrence_count?: number }).occurrence_count ?? 1,
      }));
  }, [dtcQuery.data, hasValidDateRange, fromDate, search]);

  const selectedVehicle = useMemo(
    () => vehiclesQuery.data?.items?.find((vehicle) => vehicle.id === selectedVehicleId) ?? null,
    [vehiclesQuery.data, selectedVehicleId],
  );

  const activeCount = rows.filter((item) => !item.resolved).length;
  const criticalCount = rows.filter((item) => String(item.severity ?? '').toLowerCase() === 'critical').length;
  const warningCount = rows.filter((item) => String(item.severity ?? '').toLowerCase() === 'warning').length;
  const lastOccurrence = rows[0]?.lastOccurrence ?? null;

  const speedValue = findMetricValue(telemetryQuery.data, 'speed');
  const rpmValue = findMetricValue(telemetryQuery.data, 'rpm');
  const tempValue = findMetricValue(telemetryQuery.data, 'engine_temp')
    ?? findMetricValue(telemetryQuery.data, 'intake_temp')
    ?? findMetricValue(telemetryQuery.data, 'ambient_air_temp');
  const loadValue = findMetricValue(telemetryQuery.data, 'engine_load');
  const batteryValue = findMetricValue(telemetryQuery.data, 'battery_voltage');
  const fuelValue = findMetricValue(telemetryQuery.data, 'fuel_level');
  const telemetryTimestamp = findMetricTimestamp(telemetryQuery.data, 'engine_temp')
    ?? findMetricTimestamp(telemetryQuery.data, 'intake_temp')
    ?? findMetricTimestamp(telemetryQuery.data, 'ambient_air_temp')
    ?? findMetricTimestamp(telemetryQuery.data, 'speed');

  const aiScoreValue = aiRiskQuery.data?.predicted_risk_score
    ?? aiRecommendationsQuery.data?.predicted_risk_score
    ?? aiInsightsQuery.data?.predicted_risk_score
    ?? null;
  const aiSeverityLabel = aiRiskQuery.data?.predicted_severity
    ?? aiRecommendationsQuery.data?.predicted_severity
    ?? aiInsightsQuery.data?.predicted_severity
    ?? null;
  const lastOccurrenceValue = lastOccurrence ?? telemetryTimestamp ?? null;

  const curvePoints = (telemetryQuery.data?.data?.engine_temp ?? []).slice(-8);
  const aiPredictedRisks = aiInsightsQuery.data?.predicted_risks?.slice(0, 3) ?? [];
  const aiCards = aiRecommendationsQuery.data?.recommendations?.slice(0, 3) ?? [];
  const systemStatuses = buildSystemStatuses(rows, fuelValue, aiInsightsQuery.data?.predicted_risks ?? []);
  const recentHistory = rows.slice(0, 3);

  const handleSearch = () => {
    const nextDate = dateInput ? new Date(dateInput) : null;
    const hasValidNextDateRange = !nextDate || !Number.isNaN(nextDate.getTime());

    if (!hasValidNextDateRange) {
      setDateError('Invalid date.');
      return;
    }

    setDateError('');
    setSearch(searchInput.trim());
    setDateFilter(dateInput);
  };

  const handleSearchKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSearch();
    }
  };

  return (
    <section className="dtc-page">
      <div className="dtc-topbar">
        <div className="dtc-header">
          <h2 className="dtc-title">Diagnostic vehicule</h2>
          <p className="dtc-subtitle">
            Lecture OBD-II en temps reel{selectedVehicle?.dongle_id ? ` · Dongle ${selectedVehicle.dongle_id}` : ''}
          </p>
        </div>
        <div className="dtc-top-actions">
          <span className="dtc-live-pill">{telemetryTimestamp ? 'Live' : 'Offline'}</span>
          <button
            type="button"
            className="dtc-action-btn"
            onClick={() => window.print()}
          >
            Exporter PDF
          </button>
          <button
            type="button"
            className="dtc-action-btn"
            onClick={() => pingMutation.mutate()}
            disabled={pingMutation.isPending}
          >
            {pingMutation.isPending ? 'Scan...' : 'Lancer scan complet'}
          </button>
        </div>
      </div>

      <div className="dtc-vehicle-strip">
        <div className="dtc-strip-primary">
          <div className="dtc-vehicle-id">
            {selectedVehicle ? `${selectedVehicle.make} ${selectedVehicle.model} ${selectedVehicle.year}` : 'Vehicule non disponible'}
          </div>
          <div className="dtc-vehicle-meta">Plaque : {selectedVehicle?.license_plate ?? '-'}</div>
          <div className="dtc-vehicle-meta">VIN : {selectedVehicle?.vin ?? '-'}</div>
        </div>
        <div className="dtc-strip-secondary">
          <strong>{formatMetric(selectedVehicle?.mileage ?? null, ' km')}</strong>
          <span>km total</span>
        </div>
        <div className="dtc-strip-secondary">
          <strong>{selectedVehicle?.year ?? '-'}</strong>
          <span>annee</span>
        </div>
        <div className="dtc-strip-secondary">
          <strong>{activeCount}</strong>
          <span>DTC actifs</span>
        </div>
      </div>

      <div className="dtc-kpi-grid">
        <article className="dtc-kpi-card">
          <p className="dtc-kpi-label">Codes DTC actifs</p>
          <p className="dtc-kpi-value">{activeCount}</p>
          <p className="dtc-kpi-note">{criticalCount} critiques · {warningCount} avertissements</p>
        </article>
        <article className="dtc-kpi-card">
          <p className="dtc-kpi-label">Score IA</p>
          <p className="dtc-kpi-value">{aiScoreValue !== null ? formatMetric(aiScoreValue, '/100') : '0/100'}</p>
          <p className="dtc-kpi-note">{aiSeverityLabel ?? (aiRiskQuery.isError ? getErrorMessage(aiRiskQuery.error) : 'Analyse IA en attente')}</p>
        </article>
        <article className="dtc-kpi-card">
          <p className="dtc-kpi-label">Temp. moteur</p>
          <p className="dtc-kpi-value">{tempValue !== null ? formatMetric(tempValue, '°C') : '0°C'}</p>
          <p className="dtc-kpi-note">Mesure la plus recente {telemetryTimestamp ? `· ${formatShortDate(telemetryTimestamp)}` : ''}</p>
        </article>
        <article className="dtc-kpi-card">
          <p className="dtc-kpi-label">Derniere occurrence</p>
          <p className="dtc-kpi-value">{lastOccurrenceValue ? formatShortDate(lastOccurrenceValue) : '0'}</p>
          <p className="dtc-kpi-note">Basee sur le dernier DTC du vehicule</p>
        </article>
      </div>

      <div className="dtc-main-grid">
        <div className="panel diagnostics-shell dtc-table-panel">
          <div className="dtc-panel-head">
            <div>
              <h3 className="dtc-panel-title">Codes DTC detectes</h3>
              <p className="dtc-panel-sub">Defauts lus sur le bus OBD-II</p>
            </div>
            <button
              className="dtc-clear-btn"
              type="button"
              onClick={() => {
                if (selectedVehicleId === null) return;
                setActionMessage('');
                setActionError('');
                clearMutation.mutate({ vehicle_id: selectedVehicleId });
              }}
              disabled={selectedVehicleId === null || clearMutation.isPending}
            >
              {clearMutation.isPending ? 'Effacement...' : 'Effacer les codes'}
            </button>
          </div>

          <div className="diagnostics-toolbar">
            <input
              className="toolbar-input"
              placeholder="Search for code"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
            <input
              className="toolbar-input diagnostics-date"
              type="datetime-local"
              value={dateInput}
              onChange={(event) => setDateInput(event.target.value)}
            />
            <button className="btn-primary" type="button" onClick={handleSearch}>Search</button>
          </div>
          {dateError && <p className="form-error">{dateError}</p>}

          <table className="vehicles-table diagnostics-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Description</th>
                <th>Vehicle</th>
                <th>First occurrence</th>
                <th>Last occurrence</th>
                <th>Count</th>
                <th>State</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty-cell">Aucun code defaut recu depuis AutoPi. Verifie le logger GET_DTC et le retour MQTT dans AutoPi Cloud.</td>
                </tr>
              )}
              {rows.map((item, index) => (
                <tr key={`${item.code ?? item.dtc_code}-${index}`}>
                  <td>{item.code ?? item.dtc_code ?? '-'}</td>
                  <td>{item.description ?? '-'}</td>
                  <td>{item.vehicle_id}</td>
                  <td>{item.firstOccurrence}</td>
                  <td>{item.lastOccurrence}</td>
                  <td>{item.count}</td>
                  <td>{item.resolved ? 'resolved' : 'active'}</td>
                  <td className="actions-cell">
                    <button
                      className="inline-link-btn"
                      type="button"
                      onClick={() => {
                        const historyKey = item.id ?? item.code ?? item.dtc_code;
                        if (historyKey) {
                          setActionMessage('');
                          setActionError('');
                          historyMutation.mutate(String(historyKey));
                        }
                      }}
                    >
                      History
                    </button>
                    <button
                      className="inline-danger"
                      type="button"
                      onClick={() => {
                        setActionMessage('');
                        setActionError('');
                        clearMutation.mutate({ vehicle_id: item.vehicle_id, dtc_code: item.code ?? item.dtc_code });
                      }}
                    >
                      Clear
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="muted-note">{rows.length} total</p>
          {actionError && <p className="form-error">{actionError}</p>}
          {actionMessage && <p className="muted-note">{actionMessage}</p>}
          {(historyMutation.data || historyMutation.isPending) && (
            <pre className="json-preview">{JSON.stringify(historyMutation.data ?? { status: 'loading' }, null, 2)}</pre>
          )}
        </div>

        <aside className="dtc-sensors-panel">
          <h3 className="dtc-panel-title">Capteurs en temps reel</h3>
          <p className="dtc-panel-sub">Donnees live du bus OBD</p>
          {!telemetryQuery.data?.data ? (
            <p className="muted-note">Aucune telemetrie disponible pour ce vehicule.</p>
          ) : (
            <div className="dtc-sensor-list">
              <div className="dtc-sensor-row">
                <span>Vitesse vehicule</span>
                <strong>{formatMetric(speedValue, ' km/h')}</strong>
              </div>
              <div className="dtc-bar"><span style={{ width: `${Math.min(100, Math.max(0, speedValue ?? 0))}%` }} /></div>

              <div className="dtc-sensor-row">
                <span>Regime moteur (RPM)</span>
                <strong>{formatMetric(rpmValue, ' tr/min')}</strong>
              </div>
              <div className="dtc-bar"><span style={{ width: `${Math.min(100, Math.max(0, (rpmValue ?? 0) / 50))}%` }} /></div>

              <div className="dtc-sensor-row">
                <span>Temp. moteur</span>
                <strong>{formatMetric(tempValue, ' °C')}</strong>
              </div>
              <div className="dtc-bar"><span style={{ width: `${Math.min(100, Math.max(0, tempValue ?? 0))}%` }} /></div>

              <div className="dtc-sensor-row">
                <span>Charge moteur</span>
                <strong>{formatMetric(loadValue, '%')}</strong>
              </div>
              <div className="dtc-bar"><span style={{ width: `${Math.min(100, Math.max(0, loadValue ?? 0))}%` }} /></div>

              <div className="dtc-sensor-row">
                <span>Tension batterie</span>
                <strong>{formatMetric(batteryValue, ' V', 1)}</strong>
              </div>
              <div className="dtc-bar"><span style={{ width: `${Math.min(100, Math.max(0, (batteryValue ?? 0) * 6.25))}%` }} /></div>

              <div className="dtc-sensor-row">
                <span>Carburant restant</span>
                <strong>{formatMetric(fuelValue, '%')}</strong>
              </div>
              <div className="dtc-bar"><span style={{ width: `${Math.min(100, Math.max(0, fuelValue ?? 0))}%` }} /></div>
            </div>
          )}
        </aside>
      </div>

      <section className="dtc-curve-panel">
        <div className="dtc-curve-head">
          <h3 className="dtc-lower-title">Courbe temperature moteur</h3>
          <p className="dtc-lower-sub">Historique reel des dernieres mesures de temperature</p>
        </div>
        <DtcTrendChart points={curvePoints} />
      </section>

      <div className="dtc-lower-grid">
        <section className="dtc-lower-card">
          <div className="dtc-lower-head">
            <h3 className="dtc-lower-title">Systemes OBD verifies</h3>
          </div>
          <div className="dtc-status-grid">
            {systemStatuses.map((item) => (
              <div key={item.key} className="dtc-status-item">
                <div className="dtc-status-copy">
                  <span className="dtc-status-label">{item.label}</span>
                  <span className="dtc-status-sub">{item.detail}</span>
                </div>
                <span className={`dtc-status-pill dtc-status-pill-${item.status}`}>{toneLabel(item.status)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="dtc-lower-card">
          <div className="dtc-lower-head">
            <h3 className="dtc-lower-title">Historique DTC recents</h3>
          </div>
          {recentHistory.length === 0 ? (
            <p className="muted-note">Aucun historique DTC disponible.</p>
          ) : (
            <div className="dtc-maintenance-list">
              {recentHistory.map((item, index) => {
                const tone = severityToTone(item.severity);
                return (
                  <article key={`${normalizeDtcCode(item)}-${index}`} className="dtc-maintenance-item">
                    <span className={`dtc-maintenance-dot dtc-maintenance-dot-${tone}`} />
                    <div className="dtc-maintenance-copy">
                      <strong>{normalizeDtcCode(item) || 'DTC'}</strong>
                      <span>{item.description ?? 'Description indisponible'}</span>
                      <span className="dtc-history-meta">{formatShortDate(item.lastOccurrence)} · Occurrences: {item.count}</span>
                    </div>
                    <span className={`dtc-status-pill dtc-status-pill-${tone}`}>{toneLabel(tone)}</span>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="dtc-lower-card dtc-ai-card">
          <div className="dtc-lower-head dtc-lower-head-split">
            <div>
              <h3 className="dtc-lower-title">AI Diagnostic</h3>
              <p className="dtc-lower-sub">Recommandations intelligentes</p>
            </div>
            <button
              type="button"
              className="dtc-refresh-ai-btn"
              onClick={() => {
                if (selectedVehicleId === null) return;
                queryClient.invalidateQueries({ queryKey: ['dtc-ai-risk', selectedVehicleId] });
                queryClient.invalidateQueries({ queryKey: ['dtc-ai-recommendations', selectedVehicleId] });
                queryClient.invalidateQueries({ queryKey: ['dtc-ai-insights', selectedVehicleId] });
              }}
            >
              Refresh
            </button>
          </div>
          {aiInsightsQuery.isError || aiRecommendationsQuery.isError ? (
            <p className="form-error">{getErrorMessage(aiInsightsQuery.error ?? aiRecommendationsQuery.error)}</p>
          ) : aiInsightsQuery.isLoading || aiRecommendationsQuery.isLoading ? (
            <p className="muted-note">Chargement du diagnostic IA...</p>
          ) : (
            <div className="dtc-ai-list">
              {aiInsightsQuery.data?.insights?.summary ? (
                <article className="dtc-ai-item">
                  <strong>Resume IA</strong>
                  <p>{aiInsightsQuery.data.insights.summary}</p>
                </article>
              ) : null}

              {aiCards.map((item, index) => (
                <article key={`${item.title}-${index}`} className="dtc-ai-item">
                  <strong>{item.title}</strong>
                  <p>{item.message}</p>
                </article>
              ))}

              {!aiCards.length && aiPredictedRisks.map((item, index) => (
                <article key={`${item.type}-${index}`} className="dtc-ai-item">
                  <strong>{item.type ?? 'Risque detecte'}</strong>
                  <p>{item.message ?? 'Detail indisponible'}</p>
                </article>
              ))}

              {!aiCards.length && !aiPredictedRisks.length && !aiInsightsQuery.data?.insights?.summary ? (
                <p className="muted-note">Aucune recommandation IA disponible pour ce vehicule.</p>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
