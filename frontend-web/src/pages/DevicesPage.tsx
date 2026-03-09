import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { listDevices } from '../lib/api/endpoints';

export function DevicesPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [statusFilterDraft, setStatusFilterDraft] = useState<'all' | 'online' | 'offline' | 'warning'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline' | 'warning'>('all');
  const [actionMessage, setActionMessage] = useState('');
  const [visibleColumns, setVisibleColumns] = useState({
    name: true,
    status: true,
    type: true,
    unitId: true,
    lastCommunication: true,
    updateState: true,
  });

  const devicesQuery = useQuery({ queryKey: ['devices', search], queryFn: () => listDevices(search || undefined) });

  const sourceItems = devicesQuery.data?.items ?? [];
  const items = sourceItems.filter((device) => {
    if (statusFilter === 'all') return true;
    return String(device.status ?? '').toLowerCase() === statusFilter;
  });

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

  const applyFilters = () => {
    setStatusFilter(statusFilterDraft);
    setFiltersOpen(false);
  };

  const resetFilters = () => {
    setStatusFilterDraft('all');
    setStatusFilter('all');
  };

  const toggleColumn = (column: keyof typeof visibleColumns) => {
    setVisibleColumns((prev) => ({ ...prev, [column]: !prev[column] }));
  };

  return (
    <section>
      <h2>Devices</h2>

      <div className="panel table-shell">
        <div className="toolbar-row">
          <input className="toolbar-input" placeholder="Search for devices" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} onKeyDown={handleSearchKeyDown} />
          <button className="btn-link" type="button" onClick={() => setFiltersOpen((open) => !open)}>Filters</button>
          <button className="btn-link" type="button" onClick={() => setColumnsOpen((v) => !v)}>Columns</button>
          <button className="btn-link" type="button" onClick={handleSearch}>Search</button>
          <div style={{ flex: 1 }} />
          <button className="btn-link" type="button" onClick={handleExportCsv}>Export CSV</button>
          <button className="btn-link" type="button" onClick={handleRefresh} disabled={devicesQuery.isFetching}>Refresh</button>
        </div>

        {filtersOpen && (
          <div className="panel" style={{ marginBottom: 12 }}>
            <div className="toolbar-row" style={{ marginBottom: 0 }}>
              <select
                className="toolbar-input"
                value={statusFilterDraft}
                onChange={(event) => setStatusFilterDraft(event.target.value as 'all' | 'online' | 'offline' | 'warning')}
              >
                <option value="all">Status: All</option>
                <option value="online">Online only</option>
                <option value="offline">Offline only</option>
                <option value="warning">Warning only</option>
              </select>
              <button className="btn-link" type="button" onClick={resetFilters}>Reset</button>
              <button className="btn-primary" type="button" onClick={applyFilters}>Apply</button>
            </div>
          </div>
        )}

        {columnsOpen && (
          <div className="panel" style={{ marginBottom: 12 }}>
            <div className="toolbar-row" style={{ marginBottom: 0 }}>
              <button className="btn-link" type="button" onClick={() => toggleColumn('name')}>Name {visibleColumns.name ? '✓' : ''}</button>
              <button className="btn-link" type="button" onClick={() => toggleColumn('status')}>Status {visibleColumns.status ? '✓' : ''}</button>
              <button className="btn-link" type="button" onClick={() => toggleColumn('type')}>Type {visibleColumns.type ? '✓' : ''}</button>
              <button className="btn-link" type="button" onClick={() => toggleColumn('unitId')}>Unit ID {visibleColumns.unitId ? '✓' : ''}</button>
              <button className="btn-link" type="button" onClick={() => toggleColumn('lastCommunication')}>Last Communication {visibleColumns.lastCommunication ? '✓' : ''}</button>
              <button className="btn-link" type="button" onClick={() => toggleColumn('updateState')}>Update State {visibleColumns.updateState ? '✓' : ''}</button>
            </div>
          </div>
        )}

        {actionMessage && <p className="muted-note">{actionMessage}</p>}

        <table className="vehicles-table">
          <thead>
            <tr>
              <th><input type="checkbox" aria-label="Select all devices" /></th>
              {visibleColumns.name && <th>Name</th>}
              {visibleColumns.status && <th>Status</th>}
              {visibleColumns.type && <th>Type</th>}
              {visibleColumns.unitId && <th>Unit ID</th>}
              {visibleColumns.lastCommunication && <th>Last Communication</th>}
              {visibleColumns.updateState && <th>Update State</th>}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={Object.values(visibleColumns).filter(Boolean).length + 1} className="empty-cell">No data to display</td>
              </tr>
            )}
            {items.map((device) => (
              <tr key={device.id}>
                <td><input type="checkbox" aria-label={`Select ${device.device_id}`} /></td>
                {visibleColumns.name && (
                  <td>
                    <Link className="inline-link" to={`/devices/${encodeURIComponent(device.device_id)}`}>
                      {device.device_id}
                    </Link>
                  </td>
                )}
                {visibleColumns.status && (
                  <td>
                    <span className={`status-pill ${String(device.status ?? 'offline').toLowerCase() === 'offline' ? 'critical' : String(device.status ?? '').toLowerCase() === 'warning' ? 'warning' : ''}`}>
                      {String(device.status ?? 'offline')}
                    </span>
                  </td>
                )}
                {visibleColumns.type && <td>4G</td>}
                {visibleColumns.unitId && <td>{device.device_id}</td>}
                {visibleColumns.lastCommunication && <td>{(device as { updated_at?: string; created_at?: string }).updated_at ?? (device as { updated_at?: string; created_at?: string }).created_at ?? '-'}</td>}
                {visibleColumns.updateState && <td>Up-to-date</td>}
              </tr>
            ))}
          </tbody>
        </table>

        <p className="muted-note">Devices: {items.length}</p>
      </div>
    </section>
  );
}
