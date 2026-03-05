import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ackAlert, listAlerts } from '../lib/api/endpoints';

function getErrorMessage(error: unknown) {
  const data = (error as { response?: { data?: { message?: string; detail?: string } } })?.response?.data;
  return data?.message ?? data?.detail ?? 'Request failed.';
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

export function AlertsPage() {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [stateFilterDraft, setStateFilterDraft] = useState<'all' | 'active' | 'resolved'>('all');
  const [severityFilterDraft, setSeverityFilterDraft] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');
  const [stateFilter, setStateFilter] = useState<'all' | 'active' | 'resolved'>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [searchApplied, setSearchApplied] = useState('');
  const [visibleColumns, setVisibleColumns] = useState({
    state: true,
    vehicle: true,
    type: true,
    severity: true,
    firstOccurrence: true,
    lastOccurrence: true,
    count: true,
    actions: true,
  });

  const alertsQuery = useQuery({ queryKey: ['alerts'], queryFn: listAlerts });
  const ackMutation = useMutation({
    mutationFn: ackAlert,
    onSuccess: () => {
      setActionError('');
      setActionMessage('Alert acknowledged.');
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
    onError: (error) => {
      setActionMessage('');
      setActionError(getErrorMessage(error));
    },
  });

  const allAlerts = alertsQuery.data?.alerts ?? [];

  const stats = {
    open: allAlerts.filter((item) => (item.status ?? 'pending').toLowerCase() !== 'resolved').length,
    critical: allAlerts.filter((item) => (item.severity ?? '').toLowerCase() === 'critical').length,
    high: allAlerts.filter((item) => ['warning', 'high'].includes((item.severity ?? '').toLowerCase())).length,
    medium: allAlerts.filter((item) => (item.severity ?? '').toLowerCase() === 'medium').length,
    low: allAlerts.filter((item) => ['info', 'low'].includes((item.severity ?? '').toLowerCase())).length,
  };

  const alerts = allAlerts.filter((item) => {
    const stateValue = (item.status ?? 'pending').toLowerCase();
    const severityValue = (item.severity ?? '').toLowerCase();
    const typeValue = (item.type ?? '').toLowerCase();
    const vehicleValue = String(item.vehicle_id ?? '');
    const titleValue = (item.title ?? '').toLowerCase();
    const query = search.trim().toLowerCase();

    const stateMatch = stateFilter === 'all'
      || (stateFilter === 'active' && stateValue !== 'resolved')
      || (stateFilter === 'resolved' && stateValue === 'resolved');

    const severityRank =
      severityValue === 'critical' ? 'critical'
        : severityValue === 'warning' || severityValue === 'high' ? 'high'
          : severityValue === 'medium' ? 'medium'
            : 'low';
    const severityMatch = severityFilter === 'all' || severityRank === severityFilter;

    const queryMatch = !query
      || typeValue.includes(query)
      || titleValue.includes(query)
      || vehicleValue.includes(query)
      || severityValue.includes(query)
      || stateValue.includes(query);

    return stateMatch && severityMatch && queryMatch;
  });

  const allVisibleSelected = alerts.length > 0 && alerts.every((item) => selectedIds.includes(item.id));

  const handleSearch = () => {
    const nextSearch = searchInput.trim();
    setSearch(nextSearch);
    setSearchApplied(nextSearch);
    alertsQuery.refetch();
  };

  const handleRefresh = () => {
    setActionError('');
    setActionMessage('Refreshing alerts...');
    alertsQuery.refetch().then(() => {
      setActionMessage('Alerts refreshed.');
    }).catch((error) => {
      setActionMessage('');
      setActionError(getErrorMessage(error));
    });
  };

  const handleSearchKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSearch();
    }
  };

  const applyFilters = () => {
    setStateFilter(stateFilterDraft);
    setSeverityFilter(severityFilterDraft);
    setFiltersOpen(false);
  };

  const resetFilters = () => {
    setStateFilterDraft('all');
    setSeverityFilterDraft('all');
    setStateFilter('all');
    setSeverityFilter('all');
  };

  const toggleColumn = (column: keyof typeof visibleColumns) => {
    setVisibleColumns((prev) => ({ ...prev, [column]: !prev[column] }));
  };

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !alerts.some((item) => item.id === id)));
      return;
    }
    setSelectedIds((prev) => Array.from(new Set([...prev, ...alerts.map((item) => item.id)])));
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  };

  const acknowledgeSelected = async () => {
    if (selectedIds.length === 0 || ackMutation.isPending) return;
    setActionError('');
    setActionMessage('');
    try {
      await Promise.all(selectedIds.map((id) => ackAlert({ alert_id: id })));
      setActionMessage(`Acknowledged ${selectedIds.length} alert(s).`);
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  };

  return (
    <section>
      <h2>Alerts</h2>
      <div className="panel stats-grid">
        <div className="stat-card"><p className="stat-value">{stats.open}</p><p className="stat-title">Open alerts</p></div>
        <div className="stat-card"><p className="stat-value">{stats.critical}</p><p className="stat-title">Critical</p></div>
        <div className="stat-card"><p className="stat-value">{stats.high}</p><p className="stat-title">High</p></div>
        <div className="stat-card"><p className="stat-value">{stats.medium}</p><p className="stat-title">Medium</p></div>
        <div className="stat-card"><p className="stat-value">{stats.low}</p><p className="stat-title">Low</p></div>
      </div>

      <div className="panel table-shell">
        <div className="toolbar-row">
          <input
            className="toolbar-input"
            placeholder="Search for fleet alerts"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
          <button className="btn-link" type="button" onClick={() => setFiltersOpen((v) => !v)}>Filters</button>
          <button className="btn-link" type="button" onClick={() => setColumnsOpen((v) => !v)}>Columns</button>
          <button className="btn-link" type="button" onClick={handleSearch}>Search</button>
          <div style={{ flex: 1 }} />
          <button className="btn-link" type="button" onClick={handleRefresh} disabled={alertsQuery.isFetching}>Refresh</button>
          <button className="btn-link" type="button" onClick={() => setActionsOpen((v) => !v)}>Actions</button>
        </div>

        {filtersOpen && (
          <div className="panel" style={{ marginBottom: 12 }}>
            <div className="toolbar-row" style={{ marginBottom: 0 }}>
              <select className="toolbar-input" value={stateFilterDraft} onChange={(e) => setStateFilterDraft(e.target.value as 'all' | 'active' | 'resolved')}>
                <option value="all">State: All</option>
                <option value="active">Active</option>
                <option value="resolved">Resolved</option>
              </select>
              <select className="toolbar-input" value={severityFilterDraft} onChange={(e) => setSeverityFilterDraft(e.target.value as 'all' | 'critical' | 'high' | 'medium' | 'low')}>
                <option value="all">Severity: All</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <button className="btn-link" type="button" onClick={resetFilters}>Reset</button>
              <button className="btn-primary" type="button" onClick={applyFilters}>Apply</button>
            </div>
          </div>
        )}

        {columnsOpen && (
          <div className="panel" style={{ marginBottom: 12 }}>
            <div className="toolbar-row" style={{ marginBottom: 0 }}>
              <button className="btn-link" type="button" onClick={() => toggleColumn('state')}>State {visibleColumns.state ? '✓' : ''}</button>
              <button className="btn-link" type="button" onClick={() => toggleColumn('vehicle')}>Vehicle {visibleColumns.vehicle ? '✓' : ''}</button>
              <button className="btn-link" type="button" onClick={() => toggleColumn('type')}>Type {visibleColumns.type ? '✓' : ''}</button>
              <button className="btn-link" type="button" onClick={() => toggleColumn('severity')}>Severity {visibleColumns.severity ? '✓' : ''}</button>
              <button className="btn-link" type="button" onClick={() => toggleColumn('firstOccurrence')}>First Occurrence {visibleColumns.firstOccurrence ? '✓' : ''}</button>
              <button className="btn-link" type="button" onClick={() => toggleColumn('lastOccurrence')}>Last Occurrence {visibleColumns.lastOccurrence ? '✓' : ''}</button>
              <button className="btn-link" type="button" onClick={() => toggleColumn('count')}>Count {visibleColumns.count ? '✓' : ''}</button>
              <button className="btn-link" type="button" onClick={() => toggleColumn('actions')}>Actions {visibleColumns.actions ? '✓' : ''}</button>
            </div>
          </div>
        )}

        {actionsOpen && (
          <div className="panel" style={{ marginBottom: 12 }}>
            <div className="toolbar-row" style={{ marginBottom: 0 }}>
              <button className="btn-link" type="button" onClick={acknowledgeSelected} disabled={selectedIds.length === 0 || ackMutation.isPending}>
                {ackMutation.isPending ? 'Processing...' : `Acknowledge selected (${selectedIds.length})`}
              </button>
            </div>
          </div>
        )}

        {actionError && <p className="form-error">{actionError}</p>}
        {actionMessage && <p className="muted-note">{actionMessage}</p>}
        {alertsQuery.isLoading ? <p>Loading alerts...</p> : null}
        {!alertsQuery.isLoading && alerts.length === 0 && searchApplied && (
          <p className="muted-note">No alerts found for "{searchApplied}".</p>
        )}

        <table className="vehicles-table">
          <thead>
            <tr>
              <th>
                <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} />
              </th>
              {visibleColumns.state && <th>State ↕</th>}
              {visibleColumns.vehicle && <th>Vehicle ↕</th>}
              {visibleColumns.type && <th>Type ↕</th>}
              {visibleColumns.severity && <th>Severity ↕</th>}
              {visibleColumns.firstOccurrence && <th>First Occurrence ↕</th>}
              {visibleColumns.lastOccurrence && <th>Last Occurrence ↕</th>}
              {visibleColumns.count && <th>Count ↕</th>}
              {visibleColumns.actions && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {alerts.length === 0 && (
              <tr>
                <td colSpan={Object.values(visibleColumns).filter(Boolean).length + 1} className="empty-cell">No data to display</td>
              </tr>
            )}
            {alerts.map((alert) => (
              <tr key={alert.id}>
                <td>
                  <input type="checkbox" checked={selectedIds.includes(alert.id)} onChange={() => toggleSelect(alert.id)} />
                </td>
                {visibleColumns.state && <td>{alert.status ?? '-'}</td>}
                {visibleColumns.vehicle && <td>{alert.vehicle_id}</td>}
                {visibleColumns.type && <td>{alert.type}</td>}
                {visibleColumns.severity && <td>{alert.severity}</td>}
                {visibleColumns.firstOccurrence && <td>{formatDate(alert.created_at)}</td>}
                {visibleColumns.lastOccurrence && <td>{formatDate(alert.created_at)}</td>}
                {visibleColumns.count && <td>1</td>}
                {visibleColumns.actions && (
                  <td>
                    <button
                      className="inline-link-btn"
                      type="button"
                      onClick={() => {
                        setActionError('');
                        setActionMessage('');
                        ackMutation.mutate({ alert_id: alert.id });
                      }}
                    >
                      Acknowledge
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        <p className="muted-note">Alerts: {alerts.length} &nbsp;&nbsp; Selected: {selectedIds.length}</p>
      </div>
    </section>
  );
}
