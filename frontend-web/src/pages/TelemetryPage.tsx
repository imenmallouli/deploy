import { useMutation } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getTelemetryHistory } from '../lib/api/endpoints';
import { getAccessToken } from '../lib/auth/session';

export function TelemetryPage() {
  const [vehicleId, setVehicleId] = useState(1);

  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [interval, setInterval] = useState('1h');
  const [metrics, setMetrics] = useState('speed,rpm,fuel_level,engine_temp,battery_voltage');

  const [liveConnected, setLiveConnected] = useState(false);
  const [liveError, setLiveError] = useState('');
  const [liveEvents, setLiveEvents] = useState<any[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const wsUrl = useMemo(() => {
    const base = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').trim();
    const token = getAccessToken();
    const wsBase = base.startsWith('https://')
      ? base.replace('https://', 'wss://')
      : base.replace('http://', 'ws://');
    const query = token ? `?token=${encodeURIComponent(token)}` : '';
    return `${wsBase}/api/v1/realtime/ws/vehicles/${vehicleId}${query}`;
  }, [vehicleId]);

  const telemetryMutation = useMutation({
    mutationFn: getTelemetryHistory,
  });

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const connectLive = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    setLiveError('');

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
  };

  const disconnectLive = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setLiveConnected(false);
  };

  return (
    <section>
      <h2>Telemetry History</h2>
      <p className="subtitle">Explore time-series metrics by vehicle and interval.</p>

      <form className="panel form-grid" onSubmit={(e) => {
        e.preventDefault();
        telemetryMutation.mutate({
          vehicle_id: vehicleId,
          start: start || undefined,
          end: end || undefined,
          interval,
          metrics: metrics
            .split(',')
            .map((metric) => metric.trim())
            .filter(Boolean),
        });
      }}>
        <h3>Get Telemetry History </h3>
        <input type="number" value={vehicleId} onChange={(e) => setVehicleId(Number(e.target.value))} required />
        <input placeholder="Start ISO (optional)" value={start} onChange={(e) => setStart(e.target.value)} />
        <input placeholder="End ISO (optional)" value={end} onChange={(e) => setEnd(e.target.value)} />
        <select value={interval} onChange={(e) => setInterval(e.target.value)}>
          <option value="1m">1m</option>
          <option value="5m">5m</option>
          <option value="1h">1h</option>
          <option value="1d">1d</option>
        </select>
        <input
          placeholder="metrics (comma-separated)"
          value={metrics}
          onChange={(e) => setMetrics(e.target.value)}
        />
        <button className="btn-primary" type="submit">Fetch History</button>
      </form>
      <div className="panel">
        <pre className="json-preview">{JSON.stringify(telemetryMutation.data ?? {}, null, 2)}</pre>
      </div>

      <div className="panel form-grid">
        <h3>Realtime Predictive Stream </h3>
        <input
          type="number"
          value={vehicleId}
          onChange={(e) => setVehicleId(Number(e.target.value))}
          required
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-primary" type="button" onClick={connectLive}>
            Connect
          </button>
          <button className="btn-secondary" type="button" onClick={disconnectLive}>
            Disconnect
          </button>
        </div>
        <p className="subtitle">
          Status: {liveConnected ? 'connected' : 'disconnected'}
          {liveError ? ` - ${liveError}` : ''}
        </p>
        <pre className="json-preview">{JSON.stringify(liveEvents, null, 2)}</pre>
      </div>
    </section>
  );
}
