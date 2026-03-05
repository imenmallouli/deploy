import { useMutation } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createTelemetry, getTelemetryHistory, pingTelemetry } from '../lib/api/endpoints';
import { getAccessToken } from '../lib/auth/session';

export function TelemetryPage() {
  const [vehicleId, setVehicleId] = useState(1);
  const [ts, setTs] = useState('');
  const [speed, setSpeed] = useState<number | ''>('');
  const [rpm, setRpm] = useState<number | ''>('');
  const [fuelLevel, setFuelLevel] = useState<number | ''>('');
  const [engineTemp, setEngineTemp] = useState<number | ''>('');
  const [batteryVoltage, setBatteryVoltage] = useState<number | ''>('');

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

  const pingMutation = useMutation({ mutationFn: pingTelemetry });

  const createMutation = useMutation({ mutationFn: createTelemetry });

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

      <div className="panel form-grid">
        <h3>Ping Telemetry Mongo</h3>
        <button className="btn-primary" type="button" onClick={() => pingMutation.mutate()}>
          Ping Telemetry
        </button>
        <pre className="json-preview">{JSON.stringify(pingMutation.data ?? {}, null, 2)}</pre>
      </div>

      <form className="panel form-grid" onSubmit={(e) => {
        e.preventDefault();
        createMutation.mutate({
          vehicle_id: vehicleId,
          ts: ts || undefined,
          speed: speed === '' ? undefined : Number(speed),
          rpm: rpm === '' ? undefined : Number(rpm),
          fuel_level: fuelLevel === '' ? undefined : Number(fuelLevel),
          engine_temp: engineTemp === '' ? undefined : Number(engineTemp),
          battery_voltage: batteryVoltage === '' ? undefined : Number(batteryVoltage),
        });
      }}>
        <h3>Create Telemetry </h3>
        <input type="number" value={vehicleId} onChange={(e) => setVehicleId(Number(e.target.value))} required />
        <input placeholder="Timestamp ISO (optional)" value={ts} onChange={(e) => setTs(e.target.value)} />
        <input type="number" placeholder="Speed" value={speed} onChange={(e) => setSpeed(e.target.value === '' ? '' : Number(e.target.value))} />
        <input type="number" placeholder="RPM" value={rpm} onChange={(e) => setRpm(e.target.value === '' ? '' : Number(e.target.value))} />
        <input type="number" placeholder="Fuel level" value={fuelLevel} onChange={(e) => setFuelLevel(e.target.value === '' ? '' : Number(e.target.value))} />
        <input type="number" placeholder="Engine temp" value={engineTemp} onChange={(e) => setEngineTemp(e.target.value === '' ? '' : Number(e.target.value))} />
        <input type="number" placeholder="Battery voltage" value={batteryVoltage} onChange={(e) => setBatteryVoltage(e.target.value === '' ? '' : Number(e.target.value))} />
        <button className="btn-primary" type="submit">Create Telemetry</button>
        <pre className="json-preview">{JSON.stringify(createMutation.data ?? {}, null, 2)}</pre>
      </form>

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
