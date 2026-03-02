import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  clearDtc,
  createDtc,
  createIotLog,
  createObdRawPayload,
  getDtcHistory,
  listDtc,
  listDtcByVehicle,
  listIotLogs,
  listObdRawPayloads,
  pingDtc,
} from '../lib/api/endpoints';

export function DtcPage() {
  const queryClient = useQueryClient();
  const [vehicleId, setVehicleId] = useState(1);
  const [code, setCode] = useState('P0420');
  const [severity, setSeverity] = useState('warning');
  const [description, setDescription] = useState('');
  const [dtcHistoryId, setDtcHistoryId] = useState('P0420');
  const [obdPayloadText, setObdPayloadText] = useState('{"pid":"010C","value":2400}');
  const [obdDongleId, setObdDongleId] = useState('');
  const [obdListVehicleId, setObdListVehicleId] = useState<number>(1);
  const [iotVehicleId, setIotVehicleId] = useState<number>(1);
  const [iotDeviceId, setIotDeviceId] = useState('DEVICE-01');
  const [iotEventType, setIotEventType] = useState('connection');
  const [iotLevel, setIotLevel] = useState('info');
  const [iotMessage, setIotMessage] = useState('Device connected');
  const [iotListVehicleId, setIotListVehicleId] = useState<number>(1);
  const [iotListDeviceId, setIotListDeviceId] = useState('');

  const dtcQuery = useQuery({ queryKey: ['dtc'], queryFn: () => listDtc(100) });
  const pingMutation = useMutation({ mutationFn: pingDtc });
  const byVehicleMutation = useMutation({ mutationFn: ({ id, limit }: { id: number; limit?: number }) => listDtcByVehicle(id, limit ?? 100) });
  const historyMutation = useMutation({ mutationFn: getDtcHistory });
  const createMutation = useMutation({
    mutationFn: createDtc,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dtc'] }),
  });
  const clearMutation = useMutation({
    mutationFn: clearDtc,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dtc'] }),
  });
  const createObdMutation = useMutation({ mutationFn: createObdRawPayload });
  const listObdMutation = useMutation({ mutationFn: listObdRawPayloads });
  const createIotMutation = useMutation({ mutationFn: createIotLog });
  const listIotMutation = useMutation({ mutationFn: listIotLogs });

  const items = dtcQuery.data?.items ?? [];

  return (
    <section>
      <h2>DTC</h2>
      <p className="subtitle">Track active codes, history and clear actions by role.</p>

      <div className="panel form-grid">
        <h3>Ping Mongo (GET /api/v1/dtc/ping)</h3>
        <button className="btn-primary" type="button" onClick={() => pingMutation.mutate()}>
          Ping DTC Mongo
        </button>
        <pre className="json-preview">{JSON.stringify(pingMutation.data ?? {}, null, 2)}</pre>
      </div>

      <form className="panel form-grid" onSubmit={(e) => {
        e.preventDefault();
        createMutation.mutate({ vehicle_id: vehicleId, code, severity, description });
      }}>
        <h3>Create DTC (POST)</h3>
        <input type="number" value={vehicleId} onChange={(e) => setVehicleId(Number(e.target.value))} required />
        <input value={code} onChange={(e) => setCode(e.target.value)} required />
        <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
          <option value="info">info</option>
          <option value="warning">warning</option>
          <option value="critical">critical</option>
        </select>
        <input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <button className="btn-primary" type="submit">Add DTC</button>
        <button
          className="btn-link"
          type="button"
          onClick={() => clearMutation.mutate({ vehicle_id: vehicleId, dtc_code: code })}
        >
          Clear DTC (POST)
        </button>
      </form>

      <form className="panel form-grid" onSubmit={(e) => {
        e.preventDefault();
        byVehicleMutation.mutate({ id: vehicleId, limit: 100 });
      }}>
        <h3>List DTC by Vehicle (GET /api/v1/dtc/{'{vehicle_id}'})</h3>
        <input type="number" value={vehicleId} onChange={(e) => setVehicleId(Number(e.target.value))} required />
        <button className="btn-primary" type="submit">Load Vehicle DTC</button>
        <pre className="json-preview">{JSON.stringify(byVehicleMutation.data ?? {}, null, 2)}</pre>
      </form>

      <form className="panel form-grid" onSubmit={(e) => {
        e.preventDefault();
        historyMutation.mutate(dtcHistoryId);
      }}>
        <h3>DTC History (GET /api/v1/dtc/{'{dtc_id}'}/history)</h3>
        <input value={dtcHistoryId} onChange={(e) => setDtcHistoryId(e.target.value)} required />
        <button className="btn-primary" type="submit">Load History</button>
        <pre className="json-preview">{JSON.stringify(historyMutation.data ?? {}, null, 2)}</pre>
      </form>

      <form className="panel form-grid" onSubmit={(e) => {
        e.preventDefault();
        let parsedPayload: Record<string, unknown> | unknown[] | string = obdPayloadText;
        try {
          parsedPayload = JSON.parse(obdPayloadText);
        } catch {
          parsedPayload = obdPayloadText;
        }

        createObdMutation.mutate({
          vehicle_id: vehicleId,
          dongle_id: obdDongleId || undefined,
          payload: parsedPayload,
        });
      }}>
        <h3>Create OBD Raw Payload (POST /api/v1/dtc/obd/raw)</h3>
        <input type="number" value={vehicleId} onChange={(e) => setVehicleId(Number(e.target.value))} required />
        <input placeholder="Dongle ID (optional)" value={obdDongleId} onChange={(e) => setObdDongleId(e.target.value)} />
        <textarea value={obdPayloadText} onChange={(e) => setObdPayloadText(e.target.value)} rows={4} />
        <button className="btn-primary" type="submit">Create OBD Payload</button>
        <pre className="json-preview">{JSON.stringify(createObdMutation.data ?? {}, null, 2)}</pre>
      </form>

      <form className="panel form-grid" onSubmit={(e) => {
        e.preventDefault();
        listObdMutation.mutate({ limit: 100, vehicle_id: obdListVehicleId || undefined });
      }}>
        <h3>List OBD Raw Payloads (GET /api/v1/dtc/obd/raw)</h3>
        <input
          type="number"
          placeholder="Vehicle ID (optional)"
          value={obdListVehicleId}
          onChange={(e) => setObdListVehicleId(Number(e.target.value))}
        />
        <button className="btn-primary" type="submit">Load OBD Raw</button>
        <pre className="json-preview">{JSON.stringify(listObdMutation.data ?? {}, null, 2)}</pre>
      </form>

      <form className="panel form-grid" onSubmit={(e) => {
        e.preventDefault();
        createIotMutation.mutate({
          vehicle_id: iotVehicleId || undefined,
          device_id: iotDeviceId,
          event_type: iotEventType,
          level: iotLevel,
          message: iotMessage,
        });
      }}>
        <h3>Create IoT Log (POST /api/v1/dtc/iot/logs)</h3>
        <input type="number" value={iotVehicleId} onChange={(e) => setIotVehicleId(Number(e.target.value))} />
        <input value={iotDeviceId} onChange={(e) => setIotDeviceId(e.target.value)} required />
        <input value={iotEventType} onChange={(e) => setIotEventType(e.target.value)} required />
        <input value={iotLevel} onChange={(e) => setIotLevel(e.target.value)} placeholder="Level" />
        <textarea value={iotMessage} onChange={(e) => setIotMessage(e.target.value)} placeholder="Message" rows={3} />
        <button className="btn-primary" type="submit">Create IoT Log</button>
        <pre className="json-preview">{JSON.stringify(createIotMutation.data ?? {}, null, 2)}</pre>
      </form>

      <form className="panel form-grid" onSubmit={(e) => {
        e.preventDefault();
        listIotMutation.mutate({
          limit: 100,
          vehicle_id: iotListVehicleId || undefined,
          device_id: iotListDeviceId || undefined,
        });
      }}>
        <h3>List IoT Logs (GET /api/v1/dtc/iot/logs)</h3>
        <input type="number" value={iotListVehicleId} onChange={(e) => setIotListVehicleId(Number(e.target.value))} />
        <input placeholder="Device ID (optional)" value={iotListDeviceId} onChange={(e) => setIotListDeviceId(e.target.value)} />
        <button className="btn-primary" type="submit">Load IoT Logs</button>
        <pre className="json-preview">{JSON.stringify(listIotMutation.data ?? {}, null, 2)}</pre>
      </form>

      <div className="panel">
        <h3>All DTC events (GET /api/v1/dtc)</h3>
        <table className="vehicles-table">
          <thead>
            <tr>
              <th>Vehicle</th>
              <th>Code</th>
              <th>Severity</th>
              <th>Resolved</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={`${item.code ?? item.dtc_code}-${index}`}>
                <td>{item.vehicle_id}</td>
                <td>{item.code ?? item.dtc_code}</td>
                <td>{item.severity ?? '-'}</td>
                <td>{String(Boolean(item.resolved))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
