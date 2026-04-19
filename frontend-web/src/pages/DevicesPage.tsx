import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { createDevice, listDevices } from '../lib/api/endpoints';

export function DevicesPage() {
  const queryClient = useQueryClient();
  const [deviceId, setDeviceId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [vin, setVin] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  const devicesQuery = useQuery({ queryKey: ['devices'], queryFn: () => listDevices() });

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await createDevice({
        device_id: deviceId,
        vehicle_id: vehicleId.trim() === '' ? undefined : Number(vehicleId),
        vin: vin.trim() === '' ? undefined : vin,
      });

      if (response.status !== 'success') {
        throw new Error(response.message || 'Échec de création du device');
      }

      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      setDeviceId('');
      setVehicleId('');
      setVin('');
      setActionMessage('Device ajouté avec succès.');
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Échec de création du device';
      setActionMessage(message);
    },
  });

  const sourceItems = devicesQuery.data?.items ?? [];
  const items = sourceItems;

  const handleRefresh = () => {
    setActionMessage('Refreshing devices...');
    devicesQuery.refetch().then(() => setActionMessage('Devices refreshed.'));
  };

  const handleExportCsv = () => {
    const lines = [
      ['Name', 'Status', 'Type', 'Unit ID', 'Last Communication', 'Update State'].join(','),
      ...items.map((device) => {
        const raw = device as { updated_at?: string; created_at?: string };
        const lastCommunication = raw.updated_at ?? raw.created_at ?? '';
        const status = String(device.status ?? 'offline');
        return [
          device.device_id,
          status,
          '4G',
          device.device_id,
          lastCommunication,
          'Up-to-date',
        ].map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',');
      }),
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'devices.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section>
      <h2>Devices</h2>

      <form
        className="panel form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          setActionMessage('');
          createMutation.mutate();
        }}
      >
        <h3>Create Device</h3>
        <input
          placeholder="Device ID exact (ex: dongle_001)"
          value={deviceId}
          onChange={(e) => setDeviceId(e.target.value)}
          required
        />
        <input
          type="number"
          placeholder="Vehicle ID optionnel (ex: 5)"
          value={vehicleId}
          onChange={(e) => setVehicleId(e.target.value)}
        />
        <input
          placeholder="VIN optionnel (17 caractères, ex: VF1AAAAA123456789)"
          value={vin}
          onChange={(e) => setVin(e.target.value)}
        />
        <button className="btn-primary" type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? 'Creating...' : 'Add Device'}
        </button>
      </form>

      <div className="panel table-shell">
        <div className="toolbar-row">
          <div style={{ flex: 1 }} />
          <button className="btn-link" type="button" onClick={handleExportCsv}>Export CSV</button>
          <button className="btn-link" type="button" onClick={handleRefresh} disabled={devicesQuery.isFetching}>Refresh</button>
        </div>

        {actionMessage && <p className="muted-note">{actionMessage}</p>}

        <table className="vehicles-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Type</th>
              <th>Unit ID</th>
              <th>Last Communication</th>
              <th>Update State</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="empty-cell">No data to display</td>
              </tr>
            )}
            {items.map((device) => (
              <tr key={device.id}>
                <td>
                  <Link className="inline-link" to={`/devices/${encodeURIComponent(device.device_id)}`}>
                    {device.device_id}
                  </Link>
                </td>
                <td>
                  <span className={`status-pill ${String(device.status ?? 'offline').toLowerCase() === 'offline' ? 'critical' : String(device.status ?? '').toLowerCase() === 'warning' ? 'warning' : ''}`}>
                    {String(device.status ?? 'offline')}
                  </span>
                </td>
                <td>4G</td>
                <td>{device.device_id}</td>
                <td>{(device as { updated_at?: string; created_at?: string }).updated_at ?? (device as { updated_at?: string; created_at?: string }).created_at ?? '-'}</td>
                <td>Up-to-date</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="muted-note">Devices: {items.length}</p>
      </div>
    </section>
  );
}
