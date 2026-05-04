import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getTelemetryHistory, listVehicles } from '../lib/api/endpoints';
import { getAccessToken } from '../lib/auth/session';

type TelemetryHistoryResponse = {
  status?: string;
  vehicle_id?: number;
  start?: string;
  end?: string;
  interval?: string;
  data?: Record<string, unknown[]>;
};

type RealtimeEvent = {
  timestamp?: string;
  metrics?: Record<string, unknown>;
  predictive_signals?: Array<{
    type?: string;
    severity?: string;
    message?: string;
  }>;
};

type TelemetryPoint = {
  timestamp?: string;
  ts?: string;
  value?: unknown;
};

type MergedTelemetryRow = {
  timestamp: string;
  values: Record<string, unknown>;
};

const REALTIME_FRESHNESS_MS = 2 * 60 * 1000;
const DIRECT_ONLY_METRICS = new Set(['temp_cpu', 'cpu', 'gpu']);

function formatTelemetryValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'string') return value;

  if (typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;
    if ('value' in objectValue) {
      return String(objectValue.value ?? '');
    }
    return JSON.stringify(objectValue);
  }

  return String(value);
}

function formatRealtimeValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  return formatTelemetryValue(value);
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

function mergeByTimestamp(
  telemetrySeries: Record<string, unknown[]>,
  metrics: string[],
): MergedTelemetryRow[] {
  const rows = new Map<string, MergedTelemetryRow>();

  metrics.forEach((metricName) => {
    const points = telemetrySeries[metricName];
    if (!Array.isArray(points)) return;

    points.forEach((point) => {
      if (!point || typeof point !== 'object') return;
      const p = point as TelemetryPoint;
      const ts = p.timestamp ?? p.ts;
      if (!ts) return;

      const existing = rows.get(ts) ?? { timestamp: ts, values: {} };
      existing.values[metricName] = p.value;
      rows.set(ts, existing);
    });
  });

  return Array.from(rows.values()).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
}

function carryForwardValues(rows: MergedTelemetryRow[], metrics: string[]): MergedTelemetryRow[] {
  return rows.map((row) => {
    const filled: Record<string, unknown> = {};
    metrics.forEach((metric) => {
      const v = row.values[metric];
      filled[metric] = (v !== null && v !== undefined) ? v : null;
    });
    return { timestamp: row.timestamp, values: filled };
  });
}

function dedupeRows(rows: MergedTelemetryRow[]): MergedTelemetryRow[] {
  const map = new Map<string, MergedTelemetryRow>();

  rows.forEach((row) => {
    const existing = map.get(row.timestamp);
    if (!existing) {
      map.set(row.timestamp, { timestamp: row.timestamp, values: { ...row.values } });
      return;
    }

    map.set(row.timestamp, {
      timestamp: row.timestamp,
      values: { ...existing.values, ...row.values },
    });
  });

  return Array.from(map.values()).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
}

// ─── helpers ────────────────────────────────────────────────────────────────

function extractNumeric(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isNaN(v) ? null : v;
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if ('value' in o) {
      const n = Number(o.value);
      return Number.isNaN(n) ? null : n;
    }
  }
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function SpeedRpmChart({ rows }: { rows: MergedTelemetryRow[] }) {
  const pts = rows.slice(-40);
  if (pts.length < 2) {
    return <p className="tl-no-data">Not enough data to render the chart.</p>;
  }

  const W = 540, H = 190, PL = 34, PR = 10, PT = 10, PB = 28;
  const cW = W - PL - PR;
  const cH = H - PT - PB;
  const MAX_Y = 140;

  const sx = (i: number) => PL + (i / (pts.length - 1)) * cW;
  const sy = (val: number) => PT + (1 - Math.min(Math.max(val, 0), MAX_Y) / MAX_Y) * cH;

  const buildD = (vals: (number | null)[]) => {
    let d = '';
    let open = false;
    vals.forEach((v, i) => {
      if (v === null || Number.isNaN(v)) { open = false; return; }
      const x = sx(i).toFixed(1);
      const y = sy(v).toFixed(1);
      d += open ? `L${x},${y}` : `M${x},${y}`;
      open = true;
    });
    return d;
  };

  const speedVals = pts.map((r) => extractNumeric(r.values.speed));
  const rpmVals = pts.map((r) => { const v = extractNumeric(r.values.rpm); return v !== null ? v / 100 : null; });
  const gridLines = [0, 40, 80, 120];

  const tLabel = (ts: string) => {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return ts.slice(11, 16);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const xLabels: { i: number; label: string }[] = [];
  const step = Math.max(1, Math.floor(pts.length / 6));
  for (let i = 0; i < pts.length; i += step) xLabels.push({ i, label: tLabel(pts[i].timestamp) });
  if (xLabels[xLabels.length - 1]?.i !== pts.length - 1) {
    xLabels.push({ i: pts.length - 1, label: tLabel(pts[pts.length - 1].timestamp) });
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {gridLines.map((v) => (
        <g key={v}>
          <line x1={PL} y1={sy(v)} x2={W - PR} y2={sy(v)} stroke="#e5e7eb" strokeWidth="1" />
          <text x={PL - 4} y={sy(v) + 3} textAnchor="end" fontSize="9" fill="#9ca3af">{v}</text>
        </g>
      ))}
      {buildD(speedVals) && (
        <path d={buildD(speedVals)} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      )}
      {buildD(rpmVals) && (
        <path d={buildD(rpmVals)} fill="none" stroke="#16a34a" strokeWidth="1.5" strokeDasharray="6,3" strokeLinejoin="round" strokeLinecap="round" />
      )}
      {xLabels.map(({ i, label }) => (
        <text key={i} x={sx(i)} y={H - 2} textAnchor="middle" fontSize="9" fill="#9ca3af">{label}</text>
      ))}
    </svg>
  );
}

function TlHealthBar({ label, value, raw, color }: { label: string; value: number; unit: string; raw: string; color: 'green' | 'orange' | 'red' | 'blue' }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="tl-hbar">
      <div className="tl-hbar-top">
        <span className="tl-hbar-label">{label}</span>
        <span className="tl-hbar-val">{raw}</span>
      </div>
      <div className="tl-hbar-track">
        <div className={`tl-hbar-fill tl-hbar-${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export function TelemetryPage() {
  const [vehicleId, setVehicleId] = useState<number | null>(null);
  const interval = '5m';
  const metricsList = [
    'speed',
    'rpm',
    'fuel_level',
    'engine_temp',
    'battery_voltage',
    'battery_charge_level',
    'nominal_voltage',
    'engine_load',
    'ambient_air_temp',
    'intake_temp',
    'odometer',
    'track_altitude',
    'course_over_ground',
    'satellites_used',
    'glonass_satellites_used',
    'temp_cpu',
    'cpu',
    'gpu',
  ];

  // Metrics to show in tables (exclude ones already displayed in KPI cards + health bars)
  const tableMetrics = [
    'speed',
    'rpm',
    'fuel_level',
    'engine_temp',
    'battery_voltage',
    'engine_load',
    'ambient_air_temp',
    'intake_temp',
    'odometer',
    'temp_cpu',
    'cpu',
    'gpu',
  ];

  const [liveConnected, setLiveConnected] = useState(false);
  const [liveError, setLiveError] = useState('');
  const [liveEvents, setLiveEvents] = useState<RealtimeEvent[]>([]);
  const [freshnessTick, setFreshnessTick] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const lastSeenIdRef = useRef<string | null>(null);

  const vehiclesQuery = useQuery({
    queryKey: ['vehicles', 'telemetry-page'],
    queryFn: listVehicles,
  });

  const vehicles = vehiclesQuery.data?.items ?? [];
  const hasVehicles = vehicles.length > 0;

  useEffect(() => {
    if (!hasVehicles) {
      setVehicleId(null);
      return;
    }

    setVehicleId((current) => {
      if (current && vehicles.some((vehicle) => vehicle.id === current)) {
        return current;
      }
      return vehicles[0].id;
    });
  }, [hasVehicles, vehicles]);

  const wsUrl = useMemo(() => {
    if (!vehicleId) return '';

    const base = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').trim();
    const token = getAccessToken();
    const wsBase = base.startsWith('https://')
      ? base.replace('https://', 'wss://')
      : base.replace('http://', 'ws://');
    const params = new URLSearchParams();
    params.set('poll_ms', '120000');
    if (token) {
      params.set('token', token);
    }
    // Note: last_seen_id is appended dynamically in the connect() function
    // so reconnects don't re-show already-seen events.
    const query = `?${params.toString()}`;
    return `${wsBase}/api/v1/realtime/ws/vehicles/${vehicleId}${query}`;
  }, [vehicleId]);

  const telemetryQuery = useQuery({
    queryKey: ['telemetry-history', vehicleId, interval, metricsList.join(',')],
    queryFn: () => getTelemetryHistory({
      vehicle_id: vehicleId as number,
      // Ask backend for full history range.
      start: '1970-01-01T00:00:00Z',
      end: new Date().toISOString(),
      interval,
      metrics: metricsList,
    }),
    enabled: hasVehicles && vehicleId !== null,
  });

  const telemetryHistory = telemetryQuery.data as TelemetryHistoryResponse | undefined;
  const telemetrySeries = telemetryHistory?.data ?? {};
  const displayMetrics = metricsList;
  const mergedRowsFromApi = useMemo(
    () => mergeByTimestamp(telemetrySeries, metricsList),
    [telemetrySeries],
  );
  const displayedRows = useMemo(() => carryForwardValues(dedupeRows(mergedRowsFromApi), metricsList), [mergedRowsFromApi]);
  const liveRows = useMemo(() => {
    if (liveEvents.length === 0) {
      return [];
    }

    const latestEvent = liveEvents[0];
    const latestTimestamp = latestEvent.timestamp ? new Date(latestEvent.timestamp).getTime() : Number.NaN;
    if (Number.isNaN(latestTimestamp) || Date.now() - latestTimestamp > REALTIME_FRESHNESS_MS) {
      return [];
    }

    // Realtime stream: minute-by-minute events as received from backend.
    return liveEvents.map((event) => ({
      timestamp: event.timestamp ?? new Date().toISOString(),
      values: event.metrics ?? {},
    }));
  }, [liveEvents, freshnessTick]);

  const liveTableRows = liveRows;

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!vehicleId || !wsUrl || !hasVehicles) {
      return;
    }

    let destroyed = false;

    function connect() {
      if (destroyed) return;

      if (wsRef.current) {
        wsRef.current.close();
      }

      setLiveError('');

      // Append last_seen_id so the backend skips the doc already shown.
      const reconnectUrl = lastSeenIdRef.current
        ? `${wsUrl}&last_seen_id=${encodeURIComponent(lastSeenIdRef.current)}`
        : wsUrl;
      const ws = new WebSocket(reconnectUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setLiveConnected(true);
      };

      ws.onerror = () => {
        setLiveError('Erreur WebSocket');
      };

      ws.onclose = () => {
        setLiveConnected(false);
        // Do NOT clear liveEvents here — the freshness check (REALTIME_FRESHNESS_MS)
        // will expire stale events naturally. Clearing here causes the backend to
        // re-send the last stale document on every reconnect, making the table
        // re-appear even when the car is off.
        if (!destroyed) {
          reconnectTimerRef.current = setTimeout(connect, 5000);
        }
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          // Backend signals that no fresh car data is available → clear table now.
          if (payload?.event === 'no_data') {
            setLiveEvents([]);
            return;
          }
          // Track the last doc ID so reconnects resume from here.
          if (payload?._doc_id) {
            lastSeenIdRef.current = payload._doc_id;
          }
          setLiveEvents((prev) => [payload, ...prev].slice(0, 20));
        } catch {
          setLiveError('Message temps réel invalide');
        }
      };
    }

    // Reset last_seen_id when vehicle changes (new vehicle = fresh stream).
    lastSeenIdRef.current = null;
    setLiveEvents([]);
    connect();

    return () => {
      destroyed = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      wsRef.current?.close();
    };
  }, [vehicleId, wsUrl, hasVehicles]);

  // Periodically re-evaluate liveRows so the freshness check can clear the
  // realtime table even if no new WebSocket messages arrive (car is off).
  useEffect(() => {
    const id = setInterval(() => setFreshnessTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // ── derived / computed ────────────────────────────────────────────────────
  const currentVehicle = vehicles.find((v) => v.id === vehicleId);

  const latestLiveRow = liveRows[0];

  const latestMetricValue = (metric: string): number | null => {
    for (const row of liveRows) {
      const value = extractNumeric(row.values[metric]);
      if (value !== null) return value;
    }

    return null;
  };

  const currentSpeed       = latestMetricValue('speed') ?? 0;
  const currentRpm         = latestMetricValue('rpm') ?? 0;
  const currentEngineTemp  = latestMetricValue('engine_temp') ?? 0;
  const currentFuelLevel   = latestMetricValue('fuel_level') ?? 0;
  const currentBattery     = latestMetricValue('battery_voltage') ?? 0;
  const currentBatteryChargeLevel = latestMetricValue('battery_charge_level');
  const currentNominalVoltage = latestMetricValue('nominal_voltage');
  const currentEngineLoad  = latestMetricValue('engine_load') ?? 0;
  const currentAmbientTemp = latestMetricValue('ambient_air_temp') ?? 0;
  const currentIntakeTemp  = latestMetricValue('intake_temp') ?? 0;
  const currentOdometer    = latestMetricValue('odometer') ?? 0;
  const currentTrackAltitude = latestMetricValue('track_altitude');
  const currentCourseOverGround = latestMetricValue('course_over_ground');
  const currentSatellitesUsed = latestMetricValue('satellites_used');
  const currentGlonassSatellitesUsed = latestMetricValue('glonass_satellites_used');
  const currentTempCpu = latestMetricValue('temp_cpu');
  const currentCpu = latestMetricValue('cpu');
  const currentGpu = latestMetricValue('gpu');

  const batteryPct = currentBattery > 0
    ? Math.min(100, Math.max(0, ((currentBattery - 11) / 3.8) * 100))
    : 0;

  const speedValues = displayedRows
    .map((r) => extractNumeric(r.values.speed))
    .filter((v): v is number => v !== null);
  const avgSpeed = speedValues.length
    ? speedValues.reduce((a, b) => a + b, 0) / speedValues.length
    : 0;
  const maxSpeedVal = speedValues.length ? Math.max(...speedValues) : 0;

  const firstRow = displayedRows[0];
  const lastRow  = displayedRows[displayedRows.length - 1];
  const durationMs  = firstRow && lastRow
    ? new Date(lastRow.timestamp).getTime() - new Date(firstRow.timestamp).getTime()
    : 0;
  const durationMin = Math.round(durationMs / 60000);
  const durationLabel = durationMin < 60
    ? `${durationMin} min`
    : `${Math.floor(durationMin / 60)}h ${durationMin % 60}min`;

  const odomVals = displayedRows
    .map((r) => extractNumeric(r.values.odometer))
    .filter((v): v is number => v !== null);
  const distance = odomVals.length >= 2
    ? odomVals[odomVals.length - 1] - odomVals[0]
    : avgSpeed * (durationMs / 3_600_000);

  const allAlerts = liveEvents.flatMap((e) =>
    (e.predictive_signals ?? []).map((s) => ({ ...s, time: e.timestamp ?? '' }))
  );
  const latestAlert = allAlerts[0];

  const fuelConsumed = (distance / 100) * 7;
  const co2Estimate  = fuelConsumed * 2.31;

  const lastSyncLabel = latestLiveRow
    ? (() => {
        const delta = Math.round((Date.now() - new Date(latestLiveRow.timestamp).getTime()) / 1000);
        if (delta < 60)   return `Dernière sync il y a ${delta} s`;
        if (delta < 3600) return `Dernière sync il y a ${Math.round(delta / 60)} min`;
        return `Dernière sync il y a ${Math.round(delta / 3600)} h`;
      })()
    : (liveConnected ? 'Connecté cloud, en attente de données...' : 'Aucune donnée temps réel');

  const driveScore = maxSpeedVal > 0
    ? Math.max(50, Math.round(100 - allAlerts.length * 5 - (maxSpeedVal > 120 ? 15 : 0)))
    : 0;

  return (
    <div className="tl-page">
      {vehiclesQuery.isLoading && <p className="tl-muted">Loading vehicles...</p>}
      {vehiclesQuery.isError && <p className="tl-muted">Unable to load vehicles.</p>}
      {!vehiclesQuery.isLoading && !vehiclesQuery.isError && !hasVehicles && (
        <p className="tl-muted">No vehicles in the database.</p>
      )}

      {hasVehicles && vehicleId && (
        <>
          {/* ── HEADER ── */}
          <div className="tl-header">
            <div className="tl-header-left">
              <h2 className="tl-title">
                Télémétrie — {currentVehicle?.make?.toUpperCase() ?? ''} {currentVehicle?.model ?? ''} {currentVehicle?.year ?? ''}
              </h2>
              <p className="tl-sub">
                VIN {currentVehicle?.vin ?? ''} · Dongle {currentVehicle?.dongle_id ?? ''} · {lastSyncLabel}
              </p>
            </div>
            <div className="tl-header-right">
              <div className="tl-header-actions">
                <span className={`tl-live-badge${liveConnected ? ' tl-live-on' : ''}`}>
                  <span className="tl-live-dot" />
                  Live
                </span>
                <span className="tl-ghost-badge">Aujourd'hui</span>
                <button
                  type="button"
                  className="tl-export-btn"
                  onClick={() => {
                    const csv = [
                      'Date,' + displayMetrics.join(','),
                      ...displayedRows.map((r) =>
                          [formatTimestamp(r.timestamp), ...displayMetrics.map((m) => formatTelemetryValue(r.values[m]))].join(',')
                      ),
                    ].join('\n');
                    const a = document.createElement('a');
                    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
                    a.download = `telemetry-${vehicleId}.csv`;
                    a.click();
                  }}
                >
                  Exporter
                </button>
              </div>
              <select
                className="tl-vehicle-select"
                value={vehicleId}
                onChange={(e) => setVehicleId(Number(e.target.value))}
              >
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.make} {v.model} {v.year} — {v.license_plate}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ── KPI CARDS ── */}
          <div className="tl-kpi-row tl-kpi-row-compact">
            <div className="tl-kpi-card tl-kpi-card-compact">
              <span className="tl-kpi-label">Niveau charge batterie</span>
              <span className="tl-kpi-val">{currentBatteryChargeLevel != null ? Math.round(currentBatteryChargeLevel) : 0}</span>
              <span className="tl-kpi-unit">%</span>
              {currentBatteryChargeLevel != null && (
                <span className={`tl-kpi-trend ${currentBatteryChargeLevel < 20 ? 'tl-trend-danger' : 'tl-trend-up'}`}>
                  {currentBatteryChargeLevel < 20 ? '▼ faible' : '▲ ok'}
                </span>
              )}
            </div>
            <div className="tl-kpi-card tl-kpi-card-compact">
              <span className="tl-kpi-label">Tension nominale</span>
              <span className="tl-kpi-val">{currentNominalVoltage != null ? currentNominalVoltage.toFixed(1) : '0'}</span>
              <span className="tl-kpi-unit">V</span>
              {currentNominalVoltage != null && (
                <span className={`tl-kpi-trend ${currentNominalVoltage < 12 ? 'tl-trend-warn' : 'tl-trend-up'}`}>
                  {currentNominalVoltage < 12 ? '▲ basse' : '▲ stable'}
                </span>
              )}
            </div>
            <div className="tl-kpi-card tl-kpi-card-compact">
              <span className="tl-kpi-label">Altitude</span>
              <span className="tl-kpi-val">{currentTrackAltitude != null ? Math.round(currentTrackAltitude) : '—'}</span>
              <span className="tl-kpi-unit">m</span>
              {currentTrackAltitude != null && (
                <span className="tl-kpi-trend tl-trend-up">
                  {`▲ cap ${currentCourseOverGround != null ? Math.round(currentCourseOverGround) : 0}°`}
                </span>
              )}
            </div>
            <div className="tl-kpi-card tl-kpi-card-compact">
              <span className="tl-kpi-label">Satellites utilisés</span>
              <span className="tl-kpi-val">{currentSatellitesUsed != null ? Math.round(currentSatellitesUsed) : '—'}</span>
              <span className="tl-kpi-unit">sat</span>
              {currentSatellitesUsed != null && (
                <span className={`tl-kpi-trend ${currentSatellitesUsed < 4 ? 'tl-trend-warn' : 'tl-trend-up'}`}>
                  {currentGlonassSatellitesUsed != null ? `▲ GLONASS ${Math.round(currentGlonassSatellitesUsed)}` : currentSatellitesUsed < 4 ? '▲ signal faible' : '▲ signal ok'}
                </span>
              )}
            </div>
          </div>

          {/* ── ALERT BANNER ── */}
          {latestAlert && (
            <div className="tl-alert-banner">
              <span className="tl-alert-dot" />
              <div className="tl-alert-body">
                <strong className="tl-alert-title">Alerte — {latestAlert.type?.toLowerCase()}</strong>
                <p className="tl-alert-msg">{latestAlert.message}</p>
              </div>
              <span className="tl-alert-time">{latestAlert.time ? latestAlert.time.slice(11, 19) : ''}</span>
            </div>
          )}

          {/* ── CHART + SANTÉ ── */}
          <div className="tl-mid">
            <div className="tl-chart-panel">
              <div className="tl-chart-top">
                <div>
                  <h3 className="tl-panel-title">Vitesse & RPM — dernières 30 min</h3>
                  <p className="tl-panel-sub">Données en temps réel toutes les 10 secondes</p>
                </div>
                <div className="tl-chart-legend">
                  <span className="tl-leg tl-leg-speed">— Vitesse</span>
                  <span className="tl-leg tl-leg-rpm">— RPM /100</span>
                </div>
              </div>
              <SpeedRpmChart rows={displayedRows} />
            </div>

            <div className="tl-health-panel">
              <div className="tl-health-top">
                <span className="tl-panel-title">Santé système</span>
                <span className="tl-panel-sub">Indicateurs temps réel</span>
              </div>
              <div className="tl-hbars">
                <TlHealthBar label="Vitesse"         value={Math.min(100, (currentSpeed / 180) * 100)}                  unit="km/h" raw={`${Math.round(currentSpeed)} km/h`}                    color="blue" />
                <TlHealthBar label="Régime"          value={Math.min(100, (currentRpm / 7000) * 100)}                   unit="tr/min" raw={`${currentRpm.toLocaleString('fr-FR')} tr/min`}     color="blue" />
                <TlHealthBar label="Carburant"       value={currentFuelLevel}                                            unit="%" raw={`${Math.round(currentFuelLevel)}%`}                      color={currentFuelLevel > 0 && currentFuelLevel < 20 ? 'red' : currentFuelLevel < 50 ? 'orange' : 'green'} />
                <TlHealthBar label="Temp. moteur"    value={Math.min(100, (currentEngineTemp / 120) * 100)}             unit="°C" raw={`${Math.round(currentEngineTemp)}°C`}                  color={currentEngineTemp > 100 ? 'red' : currentEngineTemp > 85 ? 'orange' : 'green'} />
                <TlHealthBar label="Batterie"        value={batteryPct}                                                  unit="V" raw={`${currentBattery.toFixed(1)}V`}                        color={currentBattery < 11.5 ? 'red' : currentBattery < 12.0 ? 'orange' : 'green'} />
                <TlHealthBar label="Charge moteur"   value={currentEngineLoad}                                           unit="%" raw={`${Math.round(currentEngineLoad)}%`}                    color={currentEngineLoad > 85 ? 'orange' : 'green'} />
                <TlHealthBar label="Temp. ambiante"  value={Math.min(100, ((currentAmbientTemp + 20) / 60) * 100)}      unit="°C" raw={`${Math.round(currentAmbientTemp)}°C`}                 color="blue" />
                <TlHealthBar label="Temp. admission" value={Math.min(100, (currentIntakeTemp / 55) * 100)}              unit="°C" raw={`${Math.round(currentIntakeTemp)}°C`}                  color="blue" />
                <TlHealthBar
                  label="Temp. CPU"
                  value={currentTempCpu != null ? Math.min(100, (currentTempCpu / 100) * 100) : 0}
                  unit="°C"
                  raw={currentTempCpu != null ? `${Math.round(currentTempCpu)}°C` : '—'}
                  color={currentTempCpu != null && currentTempCpu > 85 ? 'orange' : 'blue'}
                />
                <TlHealthBar
                  label="CPU"
                  value={currentCpu ?? 0}
                  unit="%"
                  raw={currentCpu != null ? `${Math.round(currentCpu)}%` : '0%'}
                  color={currentCpu != null && currentCpu > 85 ? 'orange' : 'blue'}
                />
                <TlHealthBar
                  label="GPU"
                  value={currentGpu ?? 0}
                  unit="%"
                  raw={currentGpu != null ? `${Math.round(currentGpu)}%` : '0%'}
                  color={currentGpu != null && currentGpu > 85 ? 'orange' : 'blue'}
                />
              </div>
              <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid #e5e7eb', fontSize: 12, color: '#666' }}>
                <strong>Kilométrage total:</strong> {currentOdometer.toLocaleString('fr-FR')} km
              </div>
            </div>
          </div>

          {/* ── EVENTS + STATS ── */}
          <div className="tl-lower">
            <div className="tl-events-panel">
              <div className="tl-panel-hrow">
                <span className="tl-panel-title">Événements récents</span>
                <span className="tl-panel-sub">Alertes et logs du trajet</span>
              </div>
              {allAlerts.slice(0, 5).length === 0 && !liveConnected ? (
                <p className="tl-empty">Aucun événement récent.</p>
              ) : (
                <>
                  {allAlerts.slice(0, 5).map((ev, i) => (
                    <div key={i} className="tl-ev-row">
                      <span className={`tl-ev-dot tl-ev-${(ev.severity ?? 'info').toLowerCase()}`} />
                      <div className="tl-ev-body">
                        <strong className="tl-ev-title">{ev.type ?? 'Événement'}</strong>
                        <p className="tl-ev-msg">{ev.message ?? ''}</p>
                        <span className="tl-ev-time">{ev.time ? ev.time.slice(11, 19) : ''}</span>
                      </div>
                      <span className={`tl-ev-badge tl-ev-badge-${(ev.severity ?? 'info').toLowerCase()}`}>
                        {ev.severity === 'critical' ? 'Critique' : ev.severity === 'warning' ? 'Avertiss.' : 'Info'}
                      </span>
                    </div>
                  ))}
                  {liveConnected && (
                    <div className="tl-ev-row">
                      <span className="tl-ev-dot tl-ev-system" />
                      <div className="tl-ev-body">
                        <strong className="tl-ev-title">Synchronisation dongle</strong>
                        <p className="tl-ev-msg">Connexion active — signal {liveError ? 'faible' : 'fort'}</p>
                      </div>
                      <span className="tl-ev-badge tl-ev-badge-system">Système</span>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="tl-stats-panel">
              <div className="tl-panel-hrow">
                <span className="tl-panel-title">Statistiques du trajet</span>
                <span className="tl-panel-sub">Session en cours</span>
              </div>
              <div className="tl-stats-grid">
                <div className="tl-stat-cell">
                  <span className="tl-stat-label">Distance parcourue</span>
                  <span className="tl-stat-val">{distance.toFixed(1)} km</span>
                </div>
                <div className="tl-stat-cell">
                  <span className="tl-stat-label">Durée trajet</span>
                  <span className="tl-stat-val">{durationMin > 0 ? durationLabel : '0 min'}</span>
                </div>
                <div className="tl-stat-cell">
                  <span className="tl-stat-label">Vitesse moyenne</span>
                  <span className="tl-stat-val">{`${Math.round(avgSpeed)} km/h`}</span>
                </div>
                <div className="tl-stat-cell">
                  <span className="tl-stat-label">Vitesse max</span>
                  <span className="tl-stat-val">{`${Math.round(maxSpeedVal)} km/h`}</span>
                </div>
                <div className="tl-stat-cell">
                  <span className="tl-stat-label">Conso. carburant</span>
                  <span className="tl-stat-val">{`${(fuelConsumed / Math.max(distance / 100, 0.01)).toFixed(1)} L/100`}</span>
                </div>
                <div className="tl-stat-cell">
                  <span className="tl-stat-label">CO₂ estimé</span>
                  <span className="tl-stat-val">{`${co2Estimate.toFixed(1)} kg`}</span>
                </div>
                <div className="tl-stat-cell">
                  <span className="tl-stat-label">Alertes déclenchées</span>
                  <span className="tl-stat-val tl-stat-alert">{allAlerts.length}</span>
                </div>
                <div className="tl-stat-cell">
                  <span className="tl-stat-label">Score conduite</span>
                  <span className="tl-stat-val tl-stat-score">{`${driveScore} / 100`}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── HISTORIQUE TABLE ── */}
          <div className="tl-table-panel">
            <div className="tl-panel-hrow">
              <span className="tl-panel-title">Historique télémétrie</span>
              <span className="tl-panel-sub">Véhicule ID {vehicleId} · Intervalle {interval}</span>
            </div>
            {telemetryQuery.isLoading && <p className="tl-muted">Loading telemetry history...</p>}
            {telemetryQuery.isError && <p className="tl-muted">Unable to load telemetry history.</p>}
            {!telemetryQuery.isLoading && !telemetryQuery.isError && (
              <div className="table-shell">
                <table className="tl-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      {tableMetrics.map((m) => <th key={m}>{m}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {displayedRows.length === 0 && (
                      <tr><td colSpan={tableMetrics.length + 1} className="empty-cell">No telemetry data.</td></tr>
                    )}
                    {displayedRows.map((row) => (
                      <tr key={row.timestamp}>
                        <td>{formatTimestamp(row.timestamp)}</td>
                        {tableMetrics.map((m) => (
                          <td key={`${row.timestamp}-${m}`}>{formatTelemetryValue(row.values[m])}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── FLUX TEMPS RÉEL TABLE ── */}
          <div className="tl-table-panel">
            <div className="tl-panel-hrow">
              <span className="tl-panel-title">Flux temps réel</span>
              <span className={`tl-panel-sub${liveConnected ? ' tl-sub-live' : ''}`}>
                {liveConnected ? '● Connecté' : '○ Déconnecté'} — données toutes les minutes
                {liveError ? ` · ${liveError}` : ''}
              </span>
            </div>
            <div className="table-shell">
              <table className="tl-table">
                <thead>
                  <tr>
                    <th>Heure</th>
                    {tableMetrics.map((m) => <th key={`rt-${m}`}>{m}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {liveTableRows.length === 0 && (
                    <tr><td colSpan={tableMetrics.length + 1} className="empty-cell">Aucune donnée temps réel.</td></tr>
                  )}
                  {liveTableRows.map((row, idx) => (
                    <tr key={`${row.timestamp}-${idx}`}>
                      <td>{formatTimestamp(row.timestamp)}</td>
                      {tableMetrics.map((m) => (
                        <td key={`${row.timestamp}-${idx}-${m}`}>{formatRealtimeValue(row.values[m])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
