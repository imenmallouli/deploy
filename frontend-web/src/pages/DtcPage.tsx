import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import {
  clearDtc,
  getAiInsights,
  getAiRecommendations,
  getAiRiskScore,
  getDtcHistory,
  getTelemetryHistory,
  listDtc,
  listDtcByVehicle,
  listVehicles,
  pingDtc,
} from '../lib/api/endpoints';
import { useI18n } from '../lib/i18n';

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

function toneLabel(value: 'ok' | 'warn' | 'danger', locale: 'fr' | 'en') {
  if (value === 'danger') return locale === 'fr' ? 'Defaut' : 'Fault';
  if (value === 'warn') return locale === 'fr' ? 'Avert.' : 'Warn';
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

function buildSystemStatuses(rows: DtcRow[], fuelLevel: number | null, predictedRisks: PredictedRisk[] = [], locale: 'fr' | 'en' = 'fr'): SystemStatus[] {
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
      ?? (locale === 'fr' ? 'Aucun probleme detecte' : 'No issue detected');

    return { key: label.toLowerCase(), label, status, detail } as SystemStatus;
  };

  const fuelStatus = evaluate('Carburant', [/^P017/, /^P008/, /^P019/, /^P023/, /^P025/], ['fuel']);
  if (fuelStatus.status === 'ok' && fuelLevel !== null && fuelLevel < 15) {
    fuelStatus.status = 'warn';
    fuelStatus.detail = locale === 'fr' ? 'Niveau carburant faible' : 'Low fuel level';
  }

  return [
    evaluate(locale === 'fr' ? 'Catalyseur' : 'Catalyst', [/^P042/, /^P043/], ['exhaust', 'catalyst']),
    evaluate(locale === 'fr' ? 'Sonde O2' : 'O2 sensor', [/^P013/, /^P014/, /^P015/, /^P016/], ['oxygen_sensor']),
    evaluate(locale === 'fr' ? 'Systeme EGR' : 'EGR system', [/^P040/], ['egr']),
    evaluate(locale === 'fr' ? 'Evaporation carb.' : 'Fuel evaporation', [/^P044/, /^P045/, /^P046/], ['evap']),
    evaluate(locale === 'fr' ? 'Allumage' : 'Ignition', [/^P03/], ['ignition', 'misfire']),
    fuelStatus,
  ];
}

function DtcTrendChart({ points, locale }: { points: TelemetryPoint[]; locale: 'fr' | 'en' }) {
  const sanitizedPoints = points.filter((point) => Number.isFinite(point.value));
  if (sanitizedPoints.length < 2) {
    return <p className="muted-note">{locale === 'fr' ? 'Pas assez de donnees moteur pour afficher la courbe.' : 'Not enough engine data to display the chart.'}</p>;
  }

  const displayPoints = sanitizedPoints.slice(-8);
  const W = 900;
  const H = 250;
  const PL = 62;
  const PR = 20;
  const PT = 16;
  const PB = 34;
  const cW = W - PL - PR;
  const cH = H - PT - PB;

  const minY = 0;
  const maxY = 100;
  const tickStep = 10;
  const ticks: number[] = [];
  for (let tick = 0; tick <= maxY; tick += tickStep) {
    ticks.push(tick);
  }

  const sx = (i: number) => PL + (i / Math.max(1, displayPoints.length - 1)) * cW;
  const sy = (val: number) => PT + (1 - (val - minY) / Math.max(1, maxY - minY)) * cH;

  const chartPoints = displayPoints.map((point, index) => ({
    x: sx(index),
    y: sy(Math.min(maxY, Math.max(minY, point.value))),
  }));

  const buildSmoothPath = (pts: { x: number; y: number }[]) => {
    if (pts.length < 2) return '';
    const first = pts[0];
    const commands = [`M${first.x.toFixed(1)},${first.y.toFixed(1)}`];

    for (let i = 1; i < pts.length; i += 1) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const cpX = ((prev.x + curr.x) / 2).toFixed(1);
      commands.push(
        `C${cpX},${prev.y.toFixed(1)} ${cpX},${curr.y.toFixed(1)} ${curr.x.toFixed(1)},${curr.y.toFixed(1)}`,
      );
    }

    return commands.join(' ');
  };

  const line = buildSmoothPath(chartPoints);
  const area = `${line} L${chartPoints[chartPoints.length - 1].x.toFixed(1)},${H - PB} L${chartPoints[0].x.toFixed(1)},${H - PB} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="dtc-curve-svg" role="img" aria-label={locale === 'fr' ? 'Courbe de temperature' : 'Temperature trend'}>
      {ticks.map((tick) => (
        <g key={tick}>
          <line x1={PL} y1={sy(tick)} x2={W - PR} y2={sy(tick)} stroke="rgba(113, 145, 189, 0.22)" strokeWidth="1" />
          <text x={PL - 10} y={sy(tick) + 4} textAnchor="end" fontSize="12" fill="#4a6b90">{tick}°C</text>
        </g>
      ))}
      <path d={area} fill="rgba(254, 202, 202, 0.45)" />
      <path d={line} fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {90 >= minY && 90 <= maxY ? (
        <line x1={PL} y1={sy(90)} x2={W - PR} y2={sy(90)} stroke="#f59e0b" strokeWidth="2" strokeDasharray="8 6" />
      ) : null}
      {displayPoints.map((point, index) => (
        <text key={`${point.timestamp}-${index}`} x={sx(index)} y={H - 10} textAnchor="middle" fontSize="12" fill="#4a6b90">
          {formatShortDate(point.timestamp).slice(-5)}
        </text>
      ))}
    </svg>
  );
}

export function DtcPage() {
  const { locale } = useI18n();
  const text = locale === 'fr'
    ? {
        scanDone: 'Scan complet termine et donnees actualisees.',
        historyLoaded: 'Historique charge avec succes.',
        clearDone: 'Effacement DTC execute.',
        invalidDate: 'Date invalide.',
        title: 'Diagnostic vehicule',
        subtitle: 'Lecture OBD-II en temps reel',
        fullScan: 'Lancer scan complet',
        exportPdf: 'Exporter PDF',
        noVehicle: 'Vehicule non disponible',
        plate: 'Plaque',
        year: 'annee',
        fuel: 'carburant',
        fuelType: 'Essence',
        kmTotal: 'km total',
        criticalLabel: 'critiques',
        warningLabel: 'avertissements',
        activeDtc: 'DTC actifs',
        activeCodes: 'Codes DTC actifs',
        pendingAi: 'Analyse IA en attente',
        lastMeasure: 'Mesure la plus recente',
        lastOccurrence: 'Derniere occurrence',
        basedOnLast: 'Basee sur le dernier DTC du vehicule',
        detectedCodes: 'Codes DTC detectes',
        defectsBus: 'Defauts lus sur le bus OBD-II',
        clearing: 'Effacement...',
        clearCodes: 'Effacer les codes',
        searchCode: 'Rechercher un code',
        search: 'Chercher',
        description: 'Description',
        vehicle: 'Vehicule',
        firstOccurrence: 'Premiere occurrence',
        lastOccurrenceCol: 'Derniere occurrence',
        count: 'Nombre',
        state: 'Etat',
        noCode: 'Aucun code defaut recu depuis AutoPi. Verifie le logger GET_DTC et le retour MQTT dans AutoPi Cloud.',
        history: 'Historique',
        clear: 'Effacer',
        total: 'total',
        sensors: 'Capteurs en temps reel',
        liveData: 'Donnees live du bus OBD',
        noTelemetry: 'Aucune telemetrie disponible pour ce vehicule.',
        speed: 'Vitesse vehicule',
        rpm: 'Regime moteur (RPM)',
        temp: 'Temp. moteur',
        load: 'Charge moteur',
        battery: 'Tension batterie',
        remainingFuel: 'Carburant restant',
        tempCurve: 'Courbe temperature moteur',
        tempHistory: 'Historique reel des dernieres mesures de temperature',
        systemsVerified: 'Systemes OBD verifies',
        recentHistory: 'Historique DTC recents',
        noHistory: 'Aucun historique DTC disponible.',
        noDesc: 'Description indisponible',
        occurrences: 'Occurrences',
        aiDiag: 'AI Diagnostic',
        smartReco: 'Recommandations intelligentes',
        loadingAi: 'Chargement du diagnostic IA...',
        aiSummary: 'Resume IA',
        riskDetected: 'Risque detecte',
        noDetail: 'Detail indisponible',
        noAiReco: 'Aucune recommandation IA disponible pour ce vehicule.',
      }
    : {
        scanDone: 'Full scan completed and data refreshed.',
        historyLoaded: 'History loaded successfully.',
        clearDone: 'DTC clear executed.',
        invalidDate: 'Invalid date.',
        title: 'Vehicle diagnostics',
        subtitle: 'Real-time OBD-II reading',
        fullScan: 'Run full scan',
        exportPdf: 'Export PDF',
        noVehicle: 'Vehicle not available',
        plate: 'Plate',
        year: 'year',
        fuel: 'fuel',
        fuelType: 'Petrol',
        kmTotal: 'total km',
        criticalLabel: 'critical',
        warningLabel: 'warnings',
        activeDtc: 'active DTC',
        activeCodes: 'Active DTC codes',
        pendingAi: 'AI analysis pending',
        lastMeasure: 'Most recent measure',
        lastOccurrence: 'Last occurrence',
        basedOnLast: 'Based on latest vehicle DTC',
        detectedCodes: 'Detected DTC codes',
        defectsBus: 'Faults read from OBD-II bus',
        clearing: 'Clearing...',
        clearCodes: 'Clear codes',
        searchCode: 'Search code',
        search: 'Search',
        description: 'Description',
        vehicle: 'Vehicle',
        firstOccurrence: 'First occurrence',
        lastOccurrenceCol: 'Last occurrence',
        count: 'Count',
        state: 'State',
        noCode: 'No DTC code received from AutoPi. Check GET_DTC logger and MQTT return in AutoPi Cloud.',
        history: 'History',
        clear: 'Clear',
        total: 'total',
        sensors: 'Real-time sensors',
        liveData: 'Live OBD bus data',
        noTelemetry: 'No telemetry available for this vehicle.',
        speed: 'Vehicle speed',
        rpm: 'Engine RPM',
        temp: 'Engine temp.',
        load: 'Engine load',
        battery: 'Battery voltage',
        remainingFuel: 'Remaining fuel',
        tempCurve: 'Engine temperature curve',
        tempHistory: 'Recent historical engine temperature values',
        systemsVerified: 'Verified OBD systems',
        recentHistory: 'Recent DTC history',
        noHistory: 'No DTC history available.',
        noDesc: 'Description unavailable',
        occurrences: 'Occurrences',
        aiDiag: 'AI Diagnostic',
        smartReco: 'Smart recommendations',
        loadingAi: 'Loading AI diagnostic...',
        aiSummary: 'AI summary',
        riskDetected: 'Detected risk',
        noDetail: 'Detail unavailable',
        noAiReco: 'No AI recommendation available for this vehicle.',
      };
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

  const recentDtcQuery = useQuery({
    queryKey: ['dtc-latest'],
    queryFn: () => listDtc(500),
  });

  const hasLoadedDtcBootstrap = recentDtcQuery.isFetched || recentDtcQuery.isError;

  useEffect(() => {
    if (selectedVehicleId !== null || !hasLoadedDtcBootstrap) return;

    const vehicles = vehiclesQuery.data?.items ?? [];
    if (!vehicles.length) return;

    const vehicleIdsWithDtc = (recentDtcQuery.data?.items ?? [])
      .map((item) => Number(item.vehicle_id))
      .filter((id) => Number.isFinite(id));

    const preferredVehicle = vehicles.find((vehicle) => vehicleIdsWithDtc.includes(vehicle.id));
    if (preferredVehicle) {
      setSelectedVehicleId(preferredVehicle.id);
      return;
    }

    setSelectedVehicleId(vehicles[0].id);
  }, [selectedVehicleId, vehiclesQuery.data, recentDtcQuery.data, hasLoadedDtcBootstrap]);

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
      setActionMessage(text.scanDone);
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
      setActionMessage(text.historyLoaded);
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
      setActionMessage(text.clearDone);
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

  const dtcItemsSource = useMemo(() => {
    const byVehicleItems = dtcQuery.data?.items ?? [];
    if (byVehicleItems.length > 0) return byVehicleItems;
    return recentDtcQuery.data?.items ?? [];
  }, [dtcQuery.data, recentDtcQuery.data]);

  const rows = useMemo<DtcRow[]>(() => {
    const items = dtcItemsSource;

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
  }, [dtcItemsSource, hasValidDateRange, fromDate, search]);

  const selectedVehicle = useMemo(
    () => vehiclesQuery.data?.items?.find((vehicle) => vehicle.id === selectedVehicleId) ?? null,
    [vehiclesQuery.data, selectedVehicleId],
  );

  const activeCount = rows.filter((item) => !item.resolved).length;
  const criticalCount = rows.filter((item) => String(item.severity ?? '').toLowerCase() === 'critical').length;
  const warningCount = rows.filter((item) => String(item.severity ?? '').toLowerCase() === 'warning').length;
  const lastOccurrence = rows[0]?.lastOccurrence ?? null;
  const vehicleStatusLabel = selectedVehicle?.status
    ? `${selectedVehicle.status.charAt(0).toUpperCase()}${selectedVehicle.status.slice(1).toLowerCase()}`
    : (locale === 'fr' ? 'Actif' : 'Active');

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
  const systemStatuses = buildSystemStatuses(rows, fuelValue, aiInsightsQuery.data?.predicted_risks ?? [], locale);
  const recentHistory = rows.slice(0, 3);

  const handleSearch = () => {
    const nextDate = dateInput ? new Date(dateInput) : null;
    const hasValidNextDateRange = !nextDate || !Number.isNaN(nextDate.getTime());

    if (!hasValidNextDateRange) {
      setDateError(text.invalidDate);
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
          <h2 className="dtc-title">{text.title}</h2>
          <p className="dtc-subtitle">
            {text.subtitle}{selectedVehicle?.dongle_id ? ` · Dongle ${selectedVehicle.dongle_id}` : ''}
          </p>
        </div>
        <div className="dtc-top-actions">
          <span className="dtc-live-pill">{telemetryTimestamp ? 'Live' : 'Offline'}</span>
          <button
            type="button"
            className="dtc-action-btn"
            onClick={() => window.print()}
          >
            {text.exportPdf}
          </button>
          <button
            type="button"
            className="dtc-action-btn"
            onClick={() => pingMutation.mutate()}
            disabled={pingMutation.isPending}
          >
            {pingMutation.isPending ? 'Scan...' : text.fullScan}
          </button>
        </div>
      </div>

      <div className="dtc-vehicle-strip">
        <div className="dtc-strip-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="10" width="18" height="7" rx="1.5" />
            <path d="M6 10 8.4 6.5h7.2L18 10" />
            <circle cx="7.5" cy="16.5" r="1.2" />
            <circle cx="16.5" cy="16.5" r="1.2" />
          </svg>
        </div>

        <div className="dtc-strip-primary dtc-strip-sep">
          <div className="dtc-vehicle-id">
            {selectedVehicle ? `${selectedVehicle.make} ${selectedVehicle.model} ${selectedVehicle.year}` : text.noVehicle}
          </div>
          <div className="dtc-vehicle-meta">{text.plate} : {selectedVehicle?.license_plate ?? 'N/A'}</div>
          <div className="dtc-vehicle-meta">VIN : {selectedVehicle?.vin ?? 'N/A'}</div>
        </div>

        <div className="dtc-strip-secondary dtc-strip-sep">
          <strong>{formatMetric(selectedVehicle?.mileage ?? null, ' km')}</strong>
          <span>{text.kmTotal}</span>
        </div>

        <div className="dtc-strip-secondary dtc-strip-sep">
          <strong>{selectedVehicle?.year ?? '-'}</strong>
          <span>{text.year}</span>
        </div>

        <div className="dtc-strip-secondary dtc-strip-sep">
          <strong>{text.fuelType}</strong>
          <span>{text.fuel}</span>
        </div>

        <div className="dtc-strip-badges">
          <span className="dtc-strip-badge dtc-strip-badge-status">{vehicleStatusLabel}</span>
          <span className="dtc-strip-badge dtc-strip-badge-dtc">{activeCount} {text.activeDtc}</span>
        </div>
      </div>

      <div className="dtc-kpi-grid">
        <article className="dtc-kpi-card">
          <p className="dtc-kpi-label">{text.activeCodes}</p>
          <p className="dtc-kpi-value">{activeCount}</p>
          <p className="dtc-kpi-note">{criticalCount} {text.criticalLabel} · {warningCount} {text.warningLabel}</p>
        </article>
        <article className="dtc-kpi-card">
          <p className="dtc-kpi-label">Score IA</p>
          <p className="dtc-kpi-value">{aiScoreValue !== null ? formatMetric(aiScoreValue, '/100') : '0/100'}</p>
          <p className="dtc-kpi-note">{aiSeverityLabel ?? (aiRiskQuery.isError ? getErrorMessage(aiRiskQuery.error) : text.pendingAi)}</p>
        </article>
        <article className="dtc-kpi-card">
          <p className="dtc-kpi-label">{text.temp}</p>
          <p className="dtc-kpi-value">{tempValue !== null ? formatMetric(tempValue, '°C') : '0°C'}</p>
          <p className="dtc-kpi-note">{text.lastMeasure} {telemetryTimestamp ? `· ${formatShortDate(telemetryTimestamp)}` : ''}</p>
        </article>
        <article className="dtc-kpi-card">
          <p className="dtc-kpi-label">{text.lastOccurrence}</p>
          <p className="dtc-kpi-value">{lastOccurrenceValue ? formatShortDate(lastOccurrenceValue) : '0'}</p>
          <p className="dtc-kpi-note">{text.basedOnLast}</p>
        </article>
      </div>

      <div className="dtc-main-grid">
        <div className="panel diagnostics-shell dtc-table-panel">
          <div className="dtc-panel-head">
            <div>
              <h3 className="dtc-panel-title">{text.detectedCodes}</h3>
              <p className="dtc-panel-sub">{text.defectsBus}</p>
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
              {clearMutation.isPending ? text.clearing : text.clearCodes}
            </button>
          </div>

          <div className="diagnostics-toolbar">
            <select
              className="toolbar-input"
              value={selectedVehicleId ?? ''}
              onChange={(event) => setSelectedVehicleId(Number(event.target.value))}
              disabled={!vehiclesQuery.data?.items?.length}
            >
              {(vehiclesQuery.data?.items ?? []).map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.make} {vehicle.model} {vehicle.year} — {vehicle.license_plate}
                </option>
              ))}
            </select>
            <input
              className="toolbar-input"
              placeholder={text.searchCode}
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
            <button className="btn-primary" type="button" onClick={handleSearch}>{text.search}</button>
          </div>
          {dateError && <p className="form-error">{dateError}</p>}

          <div className="table-shell diagnostics-table-shell">
            <table className="vehicles-table diagnostics-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>{text.description}</th>
                  <th>{text.vehicle}</th>
                  <th>{text.firstOccurrence}</th>
                  <th>{text.lastOccurrenceCol}</th>
                  <th>{text.count}</th>
                  <th>{text.state}</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="empty-cell">{text.noCode}</td>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="muted-note">{rows.length} {text.total}</p>
          {actionError && <p className="form-error">{actionError}</p>}
          {actionMessage && <p className="muted-note">{actionMessage}</p>}
          {(historyMutation.data || historyMutation.isPending) && (
            <pre className="json-preview">{JSON.stringify(historyMutation.data ?? { status: 'loading' }, null, 2)}</pre>
          )}
        </div>

        <aside className="dtc-sensors-panel">
          <h3 className="dtc-panel-title">{text.sensors}</h3>
          <p className="dtc-panel-sub">{text.liveData}</p>
          {!telemetryQuery.data?.data ? (
            <p className="muted-note">{text.noTelemetry}</p>
          ) : (
            <div className="dtc-sensor-list">
              <div className="dtc-sensor-row">
                <span>{text.speed}</span>
                <strong>{formatMetric(speedValue, ' km/h')}</strong>
              </div>
              <div className="dtc-bar"><span style={{ width: `${Math.min(100, Math.max(0, speedValue ?? 0))}%` }} /></div>

              <div className="dtc-sensor-row">
                <span>{text.rpm}</span>
                <strong>{formatMetric(rpmValue, ' tr/min')}</strong>
              </div>
              <div className="dtc-bar"><span style={{ width: `${Math.min(100, Math.max(0, (rpmValue ?? 0) / 50))}%` }} /></div>

              <div className="dtc-sensor-row">
                <span>{text.temp}</span>
                <strong>{formatMetric(tempValue, ' °C')}</strong>
              </div>
              <div className="dtc-bar"><span style={{ width: `${Math.min(100, Math.max(0, tempValue ?? 0))}%` }} /></div>

              <div className="dtc-sensor-row">
                <span>{text.load}</span>
                <strong>{formatMetric(loadValue, '%')}</strong>
              </div>
              <div className="dtc-bar"><span style={{ width: `${Math.min(100, Math.max(0, loadValue ?? 0))}%` }} /></div>

              <div className="dtc-sensor-row">
                <span>{text.battery}</span>
                <strong>{formatMetric(batteryValue, ' V', 1)}</strong>
              </div>
              <div className="dtc-bar"><span style={{ width: `${Math.min(100, Math.max(0, (batteryValue ?? 0) * 6.25))}%` }} /></div>

              <div className="dtc-sensor-row">
                <span>{text.remainingFuel}</span>
                <strong>{formatMetric(fuelValue, '%')}</strong>
              </div>
              <div className="dtc-bar"><span style={{ width: `${Math.min(100, Math.max(0, fuelValue ?? 0))}%` }} /></div>
            </div>
          )}
        </aside>
      </div>

      <section className="dtc-curve-panel">
        <div className="dtc-curve-head">
          <h3 className="dtc-lower-title">{text.tempCurve}</h3>
          <p className="dtc-lower-sub">{text.tempHistory}</p>
        </div>
        <DtcTrendChart points={curvePoints} locale={locale} />
      </section>

      <div className="dtc-lower-grid">
        <section className="dtc-lower-card">
          <div className="dtc-lower-head">
            <h3 className="dtc-lower-title">{text.systemsVerified}</h3>
          </div>
          <div className="dtc-status-grid">
            {systemStatuses.map((item) => (
              <div key={item.key} className="dtc-status-item">
                <div className="dtc-status-copy">
                  <span className="dtc-status-label">{item.label}</span>
                  <span className="dtc-status-sub">{item.detail}</span>
                </div>
                <span className={`dtc-status-pill dtc-status-pill-${item.status}`}>{toneLabel(item.status, locale)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="dtc-lower-card">
          <div className="dtc-lower-head">
            <h3 className="dtc-lower-title">{text.recentHistory}</h3>
          </div>
          {recentHistory.length === 0 ? (
            <p className="muted-note">{text.noHistory}</p>
          ) : (
            <div className="dtc-maintenance-list">
              {recentHistory.map((item, index) => {
                const tone = severityToTone(item.severity);
                return (
                  <article key={`${normalizeDtcCode(item)}-${index}`} className="dtc-maintenance-item">
                    <span className={`dtc-maintenance-dot dtc-maintenance-dot-${tone}`} />
                    <div className="dtc-maintenance-copy">
                      <strong>{normalizeDtcCode(item) || 'DTC'}</strong>
                      <span>{item.description ?? text.noDesc}</span>
                      <span className="dtc-history-meta">{formatShortDate(item.lastOccurrence)} · {text.occurrences}: {item.count}</span>
                    </div>
                    <span className={`dtc-status-pill dtc-status-pill-${tone}`}>{toneLabel(tone, locale)}</span>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="dtc-lower-card dtc-ai-card">
          <div className="dtc-lower-head dtc-lower-head-split">
            <div>
              <h3 className="dtc-lower-title">{text.aiDiag}</h3>
              <p className="dtc-lower-sub">{text.smartReco}</p>
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
            <p className="muted-note">{text.loadingAi}</p>
          ) : (
            <div className="dtc-ai-list">
              {aiInsightsQuery.data?.insights?.summary ? (
                <article className="dtc-ai-item">
                  <strong>{text.aiSummary}</strong>
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
                  <strong>{item.type ?? text.riskDetected}</strong>
                  <p>{item.message ?? text.noDetail}</p>
                </article>
              ))}

              {!aiCards.length && !aiPredictedRisks.length && !aiInsightsQuery.data?.insights?.summary ? (
                <p className="muted-note">{text.noAiReco}</p>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
