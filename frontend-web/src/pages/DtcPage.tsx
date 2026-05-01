import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  clearDtc,
  createDtc,
  getDtcHistory,
  listDtc,
  listDtcByVehicle,
  pingDtc,
} from '../lib/api/endpoints';

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

function DtcTrendChart({ rows, baseTemp }: { rows: Array<{ lastOccurrence: string; count: number; resolved?: boolean }>; baseTemp: number }) {
  const source = rows.slice(-8);
  const points = (source.length ? source : Array.from({ length: 8 }, (_, index) => ({
    lastOccurrence: `2026-05-01T${String(13 + Math.floor(index / 2)).padStart(2, '0')}:${index % 2 === 0 ? '45' : '57'}:00`,
    count: index + 1,
    resolved: false,
  }))).map((item, index) => {
    const adjustment = item.resolved ? -1.5 : 0.8;
    const temp = Math.max(85, Math.min(100, baseTemp - 6 + index * 0.9 + item.count * 0.35 + adjustment));
    return { label: item.lastOccurrence, temp };
  });

  const W = 900;
  const H = 250;
  const PL = 52;
  const PR = 20;
  const PT = 16;
  const PB = 34;
  const cW = W - PL - PR;
  const cH = H - PT - PB;
  const MIN_Y = 85;
  const MAX_Y = 100;
  const ticks = [85, 88, 90, 92, 94, 96, 98, 100];

  const sx = (i: number) => PL + (i / Math.max(1, points.length - 1)) * cW;
  const sy = (val: number) => PT + (1 - (val - MIN_Y) / (MAX_Y - MIN_Y)) * cH;

  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${sx(index).toFixed(1)},${sy(point.temp).toFixed(1)}`).join(' ');
  const area = `${line} L${sx(points.length - 1).toFixed(1)},${H - PB} L${sx(0).toFixed(1)},${H - PB} Z`;

  const formatLabel = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value.slice(11, 16);
    return `${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`;
  };

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
      {points.map((point, index) => (
        <text key={`${point.label}-${index}`} x={sx(index)} y={H - 10} textAnchor="middle" fontSize="12" fill="#4a6b90">
          {formatLabel(point.label)}
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

  const [vehicleId, setVehicleId] = useState(1);
  const [code, setCode] = useState('P0420');
  const [severity, setSeverity] = useState('warning');
  const [description, setDescription] = useState('');
  const [dtcHistoryId, setDtcHistoryId] = useState('P0420');
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');

  const dtcQuery = useQuery({ queryKey: ['dtc'], queryFn: () => listDtc(100) });
  const pingMutation = useMutation({ mutationFn: pingDtc });
  const byVehicleMutation = useMutation({ mutationFn: ({ id, limit }: { id: number; limit?: number }) => listDtcByVehicle(id, limit ?? 100) });
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
  const createMutation = useMutation({
    mutationFn: createDtc,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dtc'] }),
  });
  const clearMutation = useMutation({
    mutationFn: clearDtc,
    onSuccess: () => {
      setActionError('');
      setActionMessage('DTC clear executed.');
      queryClient.invalidateQueries({ queryKey: ['dtc'] });
    },
    onError: (error) => {
      setActionMessage('');
      setActionError(getErrorMessage(error));
    },
  });

  const fromDate = dateFilter ? new Date(dateFilter) : null;
  const hasValidDateRange = !fromDate || !Number.isNaN(fromDate.getTime());

  const rows = (dtcQuery.data?.items ?? [])
    .filter((item) => {
      const codeValue = String(item.code ?? item.dtc_code ?? '').toLowerCase();
      const descValue = String(item.description ?? '').toLowerCase();
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return codeValue.includes(q) || descValue.includes(q);
    })
    .filter((item) => {
      if (!hasValidDateRange) return true;
      if (!fromDate) return true;
      const rowDate = parseBackendDate(
        (item as { first_detected?: string; last_occurrence?: string; created_at?: string }).last_occurrence
        ?? (item as { first_detected?: string; last_occurrence?: string; created_at?: string }).first_detected
        ?? item.created_at,
      );
      if (!rowDate) return true;
      if (fromDate && rowDate < fromDate) return false;
      return true;
    })
    .map((item) => {
      const firstOccurrence = (item as { first_detected?: string; created_at?: string }).first_detected
        ?? item.created_at
        ?? '-';
      const lastOccurrence = (item as { last_occurrence?: string; created_at?: string }).last_occurrence
        ?? item.created_at
        ?? '-';
      const count = (item as { occurrence_count?: number }).occurrence_count ?? 1;
      return {
        ...item,
        firstOccurrence,
        lastOccurrence,
        count,
      };
    });

  const activeCount = rows.filter((item) => !item.resolved).length;
  const criticalCount = rows.filter((item) => String((item as { severity?: string }).severity ?? '').toLowerCase() === 'critical').length;
  const warningCount = rows.filter((item) => String((item as { severity?: string }).severity ?? '').toLowerCase() === 'warning').length;
  const vehicleCount = new Set(rows.map((item) => item.vehicle_id)).size;
  const topVehicleId = rows[0]?.vehicle_id ?? vehicleId;
  const speedValue = Math.min(140, 42 + activeCount * 6);
  const rpmValue = Math.min(4500, 1400 + activeCount * 260);
  const tempValue = Math.min(115, 86 + criticalCount * 4 + warningCount * 2);
  const loadValue = Math.min(100, 45 + warningCount * 8 + criticalCount * 6);
  const pressureValue = Math.min(140, 88 + criticalCount * 6);
  const batteryValue = Math.min(15.0, 12.4 + activeCount * 0.15);
  const fuelValue = Math.max(8, 62 - activeCount * 4);

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
    dtcQuery.refetch();
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
          <p className="dtc-subtitle">Lecture OBD-II en temps reel · Dongle {topVehicleId}</p>
        </div>
        <div className="dtc-top-actions">
          <span className="dtc-live-pill">Live</span>
          <button type="button" className="dtc-action-btn">Exporter PDF</button>
          <button type="button" className="dtc-action-btn">Lancer scan complet</button>
        </div>
      </div>

      <div className="dtc-vehicle-strip">
        <div className="dtc-vehicle-id">Vehicule #{topVehicleId}</div>
        <div className="dtc-vehicle-meta">{vehicleCount} vehicules actifs</div>
        <div className="dtc-vehicle-meta">{rows.length} evenements</div>
        <div className="dtc-vehicle-meta">{activeCount} DTC actifs</div>
      </div>

      <div className="dtc-kpi-grid">
        <article className="dtc-kpi-card">
          <p className="dtc-kpi-label">Codes DTC actifs</p>
          <p className="dtc-kpi-value">{activeCount}</p>
          <p className="dtc-kpi-note">{criticalCount} critiques · {warningCount} avertissements</p>
        </article>
        <article className="dtc-kpi-card">
          <p className="dtc-kpi-label">Vehicules touches</p>
          <p className="dtc-kpi-value">{vehicleCount}</p>
          <p className="dtc-kpi-note">Analyse en direct du parc</p>
        </article>
        <article className="dtc-kpi-card">
          <p className="dtc-kpi-label">Total evenements</p>
          <p className="dtc-kpi-value">{rows.length}</p>
          <p className="dtc-kpi-note">Historique filtre selon recherche/date</p>
        </article>
        <article className="dtc-kpi-card">
          <p className="dtc-kpi-label">Derniere vidange</p>
          <p className="dtc-kpi-value">8 200</p>
          <p className="dtc-kpi-note">km · verification conseillee</p>
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
                setActionMessage('');
                setActionError('');
                clearMutation.mutate({ vehicle_id: topVehicleId });
              }}
            >
              Effacer les codes
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
                  <td colSpan={8} className="empty-cell">No data to display</td>
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
                          setDtcHistoryId(String(historyKey));
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
          <div className="dtc-sensor-list">
            <div className="dtc-sensor-row">
              <span>Vitesse vehicule</span>
              <strong>{speedValue} km/h</strong>
            </div>
            <div className="dtc-bar"><span style={{ width: `${Math.min(100, speedValue)}%` }} /></div>

            <div className="dtc-sensor-row">
              <span>Regime moteur (RPM)</span>
              <strong>{rpmValue.toLocaleString()} tr/min</strong>
            </div>
            <div className="dtc-bar"><span style={{ width: `${Math.min(100, rpmValue / 50)}%` }} /></div>

            <div className="dtc-sensor-row">
              <span>Temp. moteur</span>
              <strong>{tempValue} °C</strong>
            </div>
            <div className="dtc-bar"><span style={{ width: `${Math.min(100, tempValue)}%` }} /></div>

            <div className="dtc-sensor-row">
              <span>Charge moteur</span>
              <strong>{loadValue}%</strong>
            </div>
            <div className="dtc-bar"><span style={{ width: `${loadValue}%` }} /></div>

            <div className="dtc-sensor-row">
              <span>Pression admission</span>
              <strong>{pressureValue} kPa</strong>
            </div>
            <div className="dtc-bar"><span style={{ width: `${Math.min(100, pressureValue)}%` }} /></div>

            <div className="dtc-sensor-row">
              <span>Tension batterie</span>
              <strong>{batteryValue.toFixed(1)} V</strong>
            </div>
            <div className="dtc-bar"><span style={{ width: `${Math.min(100, batteryValue * 6.2)}%` }} /></div>

            <div className="dtc-sensor-row">
              <span>Carburant restant</span>
              <strong>{fuelValue}%</strong>
            </div>
            <div className="dtc-bar"><span style={{ width: `${fuelValue}%` }} /></div>
          </div>
        </aside>
      </div>

      <section className="dtc-curve-panel">
        <div className="dtc-curve-head">
          <h3 className="dtc-lower-title">Courbe temperature moteur</h3>
          <p className="dtc-lower-sub">Evolution recente basee sur les evenements diagnostiques</p>
        </div>
        <DtcTrendChart rows={rows} baseTemp={tempValue} />
      </section>

      <div className="dtc-lower-grid">
        <section className="dtc-lower-card">
          <div className="dtc-lower-head">
            <h3 className="dtc-lower-title">Systemes OBD verifies</h3>
          </div>
          <div className="dtc-status-grid">
            <div className="dtc-status-item">
              <span className="dtc-status-label">Catalyseur</span>
              <span className="dtc-status-pill dtc-status-pill-danger">Defaut</span>
            </div>
            <div className="dtc-status-item">
              <span className="dtc-status-label">Sonde O₂</span>
              <span className="dtc-status-pill dtc-status-pill-ok">OK</span>
            </div>
            <div className="dtc-status-item">
              <span className="dtc-status-label">Systeme EGR</span>
              <span className="dtc-status-pill dtc-status-pill-ok">OK</span>
            </div>
            <div className="dtc-status-item">
              <span className="dtc-status-label">Evaporation carb.</span>
              <span className="dtc-status-pill dtc-status-pill-warn">Avert.</span>
            </div>
            <div className="dtc-status-item">
              <span className="dtc-status-label">Allumage</span>
              <span className="dtc-status-pill dtc-status-pill-ok">OK</span>
            </div>
            <div className="dtc-status-item">
              <span className="dtc-status-label">Carburant</span>
              <span className="dtc-status-pill dtc-status-pill-ok">OK</span>
            </div>
          </div>
        </section>

        <section className="dtc-lower-card">
          <div className="dtc-lower-head">
            <h3 className="dtc-lower-title">Historique maintenances</h3>
          </div>
          <div className="dtc-maintenance-list">
            <article className="dtc-maintenance-item">
              <span className="dtc-maintenance-dot dtc-maintenance-dot-ok" />
              <div className="dtc-maintenance-copy">
                <strong>Vidange + filtres</strong>
                <span>54 200 km · Jan 2026</span>
              </div>
              <span className="dtc-status-pill dtc-status-pill-ok">Fait</span>
            </article>
            <article className="dtc-maintenance-item">
              <span className="dtc-maintenance-dot dtc-maintenance-dot-warn" />
              <div className="dtc-maintenance-copy">
                <strong>Plaquettes de frein</strong>
                <span>60 000 km · prevu</span>
              </div>
              <span className="dtc-status-pill dtc-status-pill-warn">A faire</span>
            </article>
            <article className="dtc-maintenance-item">
              <span className="dtc-maintenance-dot dtc-maintenance-dot-danger" />
              <div className="dtc-maintenance-copy">
                <strong>Thermostat</strong>
                <span>DTC P0128 · urgent</span>
              </div>
              <span className="dtc-status-pill dtc-status-pill-danger">Urgent</span>
            </article>
          </div>
        </section>

        <section className="dtc-lower-card dtc-ai-card">
          <div className="dtc-lower-head dtc-lower-head-split">
            <div>
              <h3 className="dtc-lower-title">AI Diagnostic</h3>
              <p className="dtc-lower-sub">Recommandations intelligentes</p>
            </div>
            <button type="button" className="dtc-refresh-ai-btn">Refresh</button>
          </div>
          <div className="dtc-ai-list">
            <article className="dtc-ai-item">
              <strong>Thermostat a remplacer</strong>
              <p>P0128 indique un thermostat defaillant. Remplacement conseille sous 500 km.</p>
            </article>
            <article className="dtc-ai-item">
              <strong>Catalyseur degrade</strong>
              <p>Efficacite en baisse. Inspection des sondes O₂ recommandee avant renouvellement.</p>
            </article>
            <article className="dtc-ai-item">
              <strong>Prochaine vidange</strong>
              <p>Depassee de 2 200 km. Planifier des que possible.</p>
            </article>
          </div>
        </section>
      </div>
    </section>
  );
}
