import { useQuery } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { createDevice, listDevices } from '../lib/api/endpoints';

export function DevicesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [newDeviceId, setNewDeviceId] = useState('');

  const devicesQuery = useQuery({ queryKey: ['devices', search], queryFn: () => listDevices(search || undefined) });
  const createMutation = useMutation({
    mutationFn: createDevice,
    onSuccess: () => {
      setNewDeviceId('');
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['devices-overview'] });
    },
  });

  const items = devicesQuery.data?.items ?? [];

  return (
    <section>
      <h2>Devices</h2>

      <div className="panel table-shell">
        <div className="toolbar-row">
          <input className="toolbar-input" placeholder="Search devices" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="btn-link" type="button">Refresh</button>
          <input className="toolbar-input" placeholder="New device ID" value={newDeviceId} onChange={(e) => setNewDeviceId(e.target.value)} />
          <button className="btn-primary" type="button" onClick={() => newDeviceId.trim() && createMutation.mutate({ device_id: newDeviceId, status: 'online' })}>Create</button>
        </div>
        <table className="vehicles-table">
          <thead>
            <tr>
              <th>Device ID</th>
              <th>Vehicle</th>
              <th>Status</th>
              <th>VIN</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="empty-cell">No data to display</td>
              </tr>
            )}
            {items.map((device) => (
              <tr key={device.id}>
                <td>{device.device_id}</td>
                <td>{device.vehicle_id ?? '-'}</td>
                <td>{device.status ?? '-'}</td>
                <td>{device.vin ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
