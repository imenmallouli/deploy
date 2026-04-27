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

export function TelemetryPage() {
  const [vehicleId, setVehicleId] = useState<number | null>(null);
  const interval = '1h';
  const metricsList = ['speed', 'rpm', 'fuel_level', 'engine_temp', 'battery_voltage', 'engine_load', 'ambient_air_temp', 'intake_temp', 'odometer'];

  const [liveConnected, setLiveConnected] = useState(false);
  const [liveError, setLiveError] = useState('');
  const [liveEvents, setLiveEvents] = useState<RealtimeEvent[]>([]);
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
    const query = token ? `?token=${encodeURIComponent(token)}` : '';
    return `${wsBase}/api/v1/realtime/ws/vehicles/${vehicleId}${query}`;
  }, [vehicleId]);

  const telemetryQuery = useQuery({
    queryKey: ['telemetry-history', vehicleId, interval, metricsList.join(',')],
    queryFn: () => getTelemetryHistory({
      vehicle_id: vehicleId as number,
      interval,
      metrics: metricsList,
    }),
    enabled: hasVehicles && vehicleId !== null,
  });

  const telemetryHistory = telemetryQuery.data as TelemetryHistoryResponse | undefined;
  const telemetrySeries = telemetryHistory?.data ?? {};
  const telemetryMetrics = Object.keys(telemetrySeries);
  const displayMetrics = telemetryMetrics.length > 0 ? telemetryMetrics : metricsList;
  const telemetryRowCount = telemetryMetrics.reduce((max, metricName) => {
    const entries = telemetrySeries[metricName];
    return Math.max(max, Array.isArray(entries) ? entries.length : 0);
  }, 0);

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
              History is loaded automatically.
            </p>
            {telemetryQuery.isLoading && <p className="muted-note">Loading telemetry history...</p>}
            {telemetryQuery.isError && <p className="muted-note">Unable to load telemetry history.</p>}
            {!telemetryQuery.isLoading && !telemetryQuery.isError && (
              <div className="table-shell" style={{ marginTop: 8 }}>
                <table className="vehicles-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      {displayMetrics.map((metricName) => (
                        <th key={metricName}>{metricName}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {telemetryRowCount === 0 && (
                      <tr>
                        <td colSpan={displayMetrics.length + 1} className="empty-cell">
                          No telemetry data for this selection.
                        </td>
                      </tr>
                    )}
                    {Array.from({ length: telemetryRowCount }).map((_, rowIndex) => (
                      <tr key={rowIndex}>
                        <td>{rowIndex + 1}</td>
                        {displayMetrics.map((metricName) => {
                          const values = telemetrySeries[metricName] ?? [];
                          const value = Array.isArray(values) ? values[rowIndex] : undefined;
                          return <td key={`${metricName}-${rowIndex}`}>{formatTelemetryValue(value)}</td>;
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
              Status: {liveConnected ? 'connected' : 'disconnected'}
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
                  {liveEvents.length === 0 && (
                    <tr>
                      <td colSpan={displayMetrics.length + 1} className="empty-cell">No realtime data yet.</td>
                    </tr>
                  )}
                  {liveEvents.map((event, index) => (
                    <tr key={`${event.timestamp ?? 'ts'}-${index}`}>
                      <td>{event.timestamp ?? '-'}</td>
                      {displayMetrics.map((metricName) => (
                        <td key={`${event.timestamp ?? 'ts'}-${index}-${metricName}`}>
                          {formatTelemetryValue(event.metrics?.[metricName])}
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
