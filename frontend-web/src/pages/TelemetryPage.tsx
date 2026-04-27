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

function formatTelemetryValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'string') return value;

  if (typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;
    if ('value' in objectValue) {
      return String(objectValue.value ?? '-');
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

export function TelemetryPage() {
  const [vehicleId, setVehicleId] = useState<number | null>(null);
  const interval = '1m';
  const metricsList = ['speed', 'rpm', 'fuel_level', 'engine_temp', 'battery_voltage', 'engine_load', 'ambient_air_temp', 'intake_temp', 'odometer'];
  const historyStorageKey = 'telemetry-history-cache-v1';

  const [liveConnected, setLiveConnected] = useState(false);
  const [liveError, setLiveError] = useState('');
  const [liveEvents, setLiveEvents] = useState<RealtimeEvent[]>([]);
  const [historyByVehicle, setHistoryByVehicle] = useState<Record<string, MergedTelemetryRow[]>>(() => {
    try {
      const raw = localStorage.getItem('telemetry-history-cache-v1');
      if (!raw) return {};
      return JSON.parse(raw) as Record<string, MergedTelemetryRow[]>;
    } catch {
      return {};
    }
  });
  const wsRef = useRef<WebSocket | null>(null);

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
    params.set('poll_ms', '60000');
    if (token) {
      params.set('token', token);
    }
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
  const currentVehicleKey = vehicleId ? String(vehicleId) : '';
  const mergedRowsFromApi = useMemo(
    () => mergeByTimestamp(telemetrySeries, metricsList),
    [telemetrySeries],
  );
  const displayedRows = useMemo(() => {
    if (!currentVehicleKey) {
      return [];
    }

    return dedupeRows([
      ...(historyByVehicle[currentVehicleKey] ?? []),
      ...mergedRowsFromApi,
    ]);
  }, [currentVehicleKey, historyByVehicle, mergedRowsFromApi]);
  const liveRows = useMemo(() => {
    if (liveEvents.length === 0) {
      return [];
    }

    const latestEvent = liveEvents[0];
    const latestTimestamp = latestEvent.timestamp ? new Date(latestEvent.timestamp).getTime() : Number.NaN;
    if (Number.isNaN(latestTimestamp) || Date.now() - latestTimestamp > REALTIME_FRESHNESS_MS) {
      return [];
    }

    const chronological = [...liveEvents].reverse();
    const latestValues: Record<string, unknown> = {};

    return chronological.map((event) => {
      displayMetrics.forEach((metricName) => {
        const metricValue = event.metrics?.[metricName];
        if (metricValue !== null && metricValue !== undefined) {
          latestValues[metricName] = metricValue;
        }
      });

      return {
        timestamp: event.timestamp ?? new Date().toISOString(),
        values: { ...latestValues },
      };
    }).reverse();
  }, [displayMetrics, liveEvents]);

  useEffect(() => {
    if (!currentVehicleKey || mergedRowsFromApi.length === 0) {
      return;
    }

    setHistoryByVehicle((previous) => {
      const merged = dedupeRows([...(previous[currentVehicleKey] ?? []), ...mergedRowsFromApi]);
      return {
        ...previous,
        [currentVehicleKey]: merged,
      };
    });
  }, [currentVehicleKey, mergedRowsFromApi]);

  useEffect(() => {
    try {
      localStorage.setItem(historyStorageKey, JSON.stringify(historyByVehicle));
    } catch {
      // Ignore storage write errors in private/restricted browser modes.
    }
  }, [historyByVehicle, historyStorageKey]);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (!vehicleId || !wsUrl || !hasVehicles) {
      return;
    }

    if (wsRef.current) {
      wsRef.current.close();
    }

    setLiveError('');
    setLiveEvents([]);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setLiveConnected(true);
    };

    ws.onerror = () => {
      setLiveError('Erreur WebSocket');
    };

    ws.onclose = () => {
      setLiveConnected(false);
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        setLiveEvents((prev) => [payload, ...prev].slice(0, 20));
      } catch {
        setLiveError('Message temps réel invalide');
      }
    };

    return () => {
      ws.close();
    };
  }, [vehicleId, wsUrl, hasVehicles]);

  return (
    <section>
      <h2>Telemetry History</h2>
      <p className="subtitle">Explore time-series metrics by vehicle and interval.</p>

      {vehiclesQuery.isLoading && <p className="muted-note">Loading vehicles...</p>}
      {vehiclesQuery.isError && <p className="muted-note">Unable to load vehicles list.</p>}
      {!vehiclesQuery.isLoading && !vehiclesQuery.isError && !hasVehicles && (
        <p className="muted-note">No vehicles in database.</p>
      )}

      {hasVehicles && vehicleId && (
        <>
          <div className="panel">
            <h3>Select Vehicle</h3>
            <div className="toolbar-row" style={{ marginBottom: 0 }}>
              <select
                className="toolbar-input"
                value={vehicleId}
                onChange={(e) => setVehicleId(Number(e.target.value))}
              >
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    ID {vehicle.id} - {vehicle.license_plate ?? vehicle.vin ?? 'Vehicle'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="panel">
            <h3>Telemetry History</h3>
            <p className="muted-note" style={{ marginTop: 0, marginBottom: 8 }}>
              Vehicle: ID {vehicleId} • Interval: {interval}
            </p>
            <p className="muted-note" style={{ marginTop: 0, marginBottom: 8 }}>
              History shows saved values with their dates. It does not poll every minute.
            </p>
            {telemetryQuery.isLoading && <p className="muted-note">Loading telemetry history...</p>}
            {telemetryQuery.isError && <p className="muted-note">Unable to load telemetry history.</p>}
            {!telemetryQuery.isLoading && !telemetryQuery.isError && (
              <div className="table-shell" style={{ marginTop: 8 }}>
                <table className="vehicles-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      {displayMetrics.map((metricName) => (
                        <th key={metricName}>{metricName}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displayedRows.length === 0 && (
                      <tr>
                        <td colSpan={displayMetrics.length + 1} className="empty-cell">
                          No telemetry data for this selection.
                        </td>
                      </tr>
                    )}
                    {displayedRows.map((row) => (
                      <tr key={row.timestamp}>
                        <td>{formatTimestamp(row.timestamp)}</td>
                        {displayMetrics.map((metricName) => {
                          return (
                            <td key={`${row.timestamp}-${metricName}`}>
                              {formatTelemetryValue(row.values[metricName])}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="panel">
            <h3>Realtime Predictive Stream</h3>
            <p className="muted-note" style={{ margin: 0 }}>Selected vehicle ID: {vehicleId}</p>
            <p className="subtitle">
              Status: {liveConnected ? 'connected' : 'disconnected'} • New vehicle data every 1 minute
              {liveError ? ` - ${liveError}` : ''}
            </p>
            <div className="table-shell" style={{ marginTop: 8 }}>
              <table className="vehicles-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    {displayMetrics.map((metricName) => (
                      <th key={`realtime-${metricName}`}>{metricName}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {liveRows.length === 0 && (
                    <tr>
                      <td colSpan={displayMetrics.length + 1} className="empty-cell">No fresh realtime data yet.</td>
                    </tr>
                  )}
                  {liveRows.map((row, index) => (
                    <tr key={`${row.timestamp}-${index}`}>
                      <td>{formatTimestamp(row.timestamp)}</td>
                      {displayMetrics.map((metricName) => (
                        <td key={`${row.timestamp}-${index}-${metricName}`}>
                          {formatRealtimeValue(row.values[metricName])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
