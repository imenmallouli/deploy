import { useQuery } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { createDevice, listDevices } from '../lib/api/endpoints';

function getErrorMessage(error: unknown) {
  const data = (error as { response?: { data?: { message?: string; detail?: string } } })?.response?.data;
  return data?.message ?? data?.detail ?? 'Request failed.';
}

export function DevicesPage() {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [newDeviceId, setNewDeviceId] = useState('');
  const [newVehicleId, setNewVehicleId] = useState('');
  const [newStatus, setNewStatus] = useState('online');
  const [newVin, setNewVin] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [visibleColumns, setVisibleColumns] = useState({
    deviceId: true,
    vehicle: true,
    status: true,
    vin: true,
  });

  const devicesQuery = useQuery({ queryKey: ['devices', search], queryFn: () => listDevices(search || undefined) });
  const createMutation = useMutation({
    mutationFn: createDevice,
    onSuccess: () => {
      setNewDeviceId('');
      setNewVehicleId('');
      setNewStatus('online');
      setNewVin('');
      setActionError('');
      setActionMessage('Device created successfully.');
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['devices-overview'] });
    },
    onError: (error) => {
      setActionMessage('');
      setActionError(getErrorMessage(error));
    },
  });

  const items = devicesQuery.data?.items ?? [];

  const handleSearch = () => {
    setSearch(searchInput.trim());
  };

  const handleSearchKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSearch();
    }
  };

  const handleRefresh = () => {
    setActionError('');
    setActionMessage('Refreshing devices...');
    devicesQuery.refetch().then(() => {
      setActionMessage('Devices refreshed.');
    }).catch((error) => {
      setActionMessage('');
      setActionError(getErrorMessage(error));
    });
  };

  const handleCreate = () => {
    setActionMessage('');
    if (!newDeviceId.trim()) {
      setActionError('Device ID is required.');
      return;
    }

    if (newVehicleId.trim() && Number.isNaN(Number(newVehicleId))) {
      setActionError('Vehicle ID must be a number.');
      return;
    }

    setActionError('');
    createMutation.mutate({
      device_id: newDeviceId.trim(),
      vehicle_id: newVehicleId.trim() ? Number(newVehicleId) : undefined,
      status: newStatus.trim() || undefined,
      vin: newVin.trim() || undefined,
    });
  };

  const toggleColumn = (column: keyof typeof visibleColumns) => {
    setVisibleColumns((prev) => ({ ...prev, [column]: !prev[column] }));
  };

  return (
    <section>
      <h2>Devices</h2>

      <div className="panel table-shell">
        <div className="toolbar-row">
          <input className="toolbar-input" placeholder="Search devices" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} onKeyDown={handleSearchKeyDown} />
          <button className="btn-link" type="button" onClick={handleSearch}>Search</button>
          <button className="btn-link" type="button" onClick={() => setColumnsOpen((v) => !v)}>Columns</button>
          <button className="btn-link" type="button" onClick={handleRefresh} disabled={devicesQuery.isFetching}>Refresh</button>
          <input className="toolbar-input" placeholder="New device ID" value={newDeviceId} onChange={(e) => setNewDeviceId(e.target.value)} />
          <input className="toolbar-input" placeholder="Vehicle ID (optional)" value={newVehicleId} onChange={(e) => setNewVehicleId(e.target.value)} />
          <select className="toolbar-input" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
            <option value="online">online</option>
            <option value="offline">offline</option>
            <option value="warning">warning</option>
          </select>
          <input className="toolbar-input" placeholder="VIN (optional)" value={newVin} onChange={(e) => setNewVin(e.target.value)} />
          <button className="btn-primary" type="button" onClick={handleCreate} disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'Create'}
          </button>
        </div>

        {columnsOpen && (
          <div className="panel" style={{ marginBottom: 12 }}>
            <div className="toolbar-row" style={{ marginBottom: 0 }}>
              <button className="btn-link" type="button" onClick={() => toggleColumn('deviceId')}>Device ID {visibleColumns.deviceId ? '✓' : ''}</button>
              <button className="btn-link" type="button" onClick={() => toggleColumn('vehicle')}>Vehicle {visibleColumns.vehicle ? '✓' : ''}</button>
              <button className="btn-link" type="button" onClick={() => toggleColumn('status')}>Status {visibleColumns.status ? '✓' : ''}</button>
              <button className="btn-link" type="button" onClick={() => toggleColumn('vin')}>VIN {visibleColumns.vin ? '✓' : ''}</button>
            </div>
          </div>
        )}

        {actionError && <p className="form-error">{actionError}</p>}
        {actionMessage && <p className="muted-note">{actionMessage}</p>}

        <table className="vehicles-table">
          <thead>
            <tr>
              {visibleColumns.deviceId && <th>Device ID</th>}
              {visibleColumns.vehicle && <th>Vehicle</th>}
              {visibleColumns.status && <th>Status</th>}
              {visibleColumns.vin && <th>VIN</th>}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={Object.values(visibleColumns).filter(Boolean).length} className="empty-cell">No data to display</td>
              </tr>
            )}
            {items.map((device) => (
              <tr key={device.id}>
                {visibleColumns.deviceId && <td>{device.device_id}</td>}
                {visibleColumns.vehicle && <td>{device.vehicle_id ?? '-'}</td>}
                {visibleColumns.status && <td>{device.status ?? '-'}</td>}
                {visibleColumns.vin && <td>{device.vin ?? '-'}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
