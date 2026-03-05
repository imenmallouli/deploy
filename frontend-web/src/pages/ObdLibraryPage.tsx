import { useMemo, useState } from 'react';

const pids = [
  { pid: '010C', mode: '01', label: 'Engine RPM', unit: 'rpm', category: 'Powertrain' },
  { pid: '010D', mode: '01', label: 'Vehicle Speed', unit: 'km/h', category: 'Powertrain' },
  { pid: '0105', mode: '01', label: 'Coolant Temperature', unit: '°C', category: 'Engine' },
  { pid: '010F', mode: '01', label: 'Intake Air Temperature', unit: '°C', category: 'Engine' },
  { pid: '0111', mode: '01', label: 'Throttle Position', unit: '%', category: 'Engine' },
  { pid: '012F', mode: '01', label: 'Fuel Level Input', unit: '%', category: 'Fuel' },
  { pid: '0142', mode: '01', label: 'Control Module Voltage', unit: 'V', category: 'Electrical' },
  { pid: '03', mode: '03', label: 'Stored DTCs', unit: 'code', category: 'Diagnostics' },
  { pid: '04', mode: '04', label: 'Clear DTCs', unit: '-', category: 'Diagnostics' },
  { pid: '0902', mode: '09', label: 'Vehicle Identification Number', unit: 'text', category: 'Vehicle Info' },
];

type UnitFilter = 'all' | 'rpm' | 'km/h' | '°C' | '%' | 'V' | 'code' | 'text' | '-';
type CategoryFilter = 'all' | 'Powertrain' | 'Engine' | 'Fuel' | 'Electrical' | 'Diagnostics' | 'Vehicle Info';

export function ObdLibraryPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [unitFilterDraft, setUnitFilterDraft] = useState<UnitFilter>('all');
  const [categoryFilterDraft, setCategoryFilterDraft] = useState<CategoryFilter>('all');
  const [unitFilter, setUnitFilter] = useState<UnitFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [actionMessage, setActionMessage] = useState('');
  const [visibleColumns, setVisibleColumns] = useState({
    pid: true,
    mode: true,
    description: true,
    unit: true,
    category: true,
  });

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return pids.filter((row) => {
      const unitMatch = unitFilter === 'all' || row.unit === unitFilter;
      const categoryMatch = categoryFilter === 'all' || row.category === categoryFilter;
      const queryMatch = !query
        || row.pid.toLowerCase().includes(query)
        || row.mode.toLowerCase().includes(query)
        || row.label.toLowerCase().includes(query)
        || row.unit.toLowerCase().includes(query)
        || row.category.toLowerCase().includes(query);
      return unitMatch && categoryMatch && queryMatch;
    });
  }, [search, unitFilter, categoryFilter]);

  const handleSearch = () => {
    setSearch(searchInput.trim());
  };

  const handleSearchKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSearch();
    }
  };

  const applyFilters = () => {
    setUnitFilter(unitFilterDraft);
    setCategoryFilter(categoryFilterDraft);
    setFiltersOpen(false);
  };

  const resetFilters = () => {
    setUnitFilterDraft('all');
    setCategoryFilterDraft('all');
    setUnitFilter('all');
    setCategoryFilter('all');
  };

  const handleRefresh = () => {
    setActionMessage('OBD library refreshed.');
  };

  const toggleColumn = (column: keyof typeof visibleColumns) => {
    setVisibleColumns((prev) => ({ ...prev, [column]: !prev[column] }));
  };

  const visibleCount = Object.values(visibleColumns).filter(Boolean).length;

  return (
    <section>
      <h2>OBD Library</h2>
      <p className="subtitle">Reference of common OBD PIDs and diagnostics commands.</p>

      <div className="panel table-shell">
        <div className="toolbar-row">
          <input
            className="toolbar-input"
            placeholder="Search PID, mode, description"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
          <button className="btn-link" type="button" onClick={() => setFiltersOpen((value) => !value)}>Filters</button>
          <button className="btn-link" type="button" onClick={() => setColumnsOpen((value) => !value)}>Columns</button>
          <button className="btn-link" type="button" onClick={handleSearch}>Search</button>
          <div style={{ flex: 1 }} />
          <button className="btn-link" type="button" onClick={handleRefresh}>Refresh</button>
        </div>

        {filtersOpen && (
          <div className="panel" style={{ marginBottom: 12 }}>
            <div className="toolbar-row" style={{ marginBottom: 0 }}>
              <select
                className="toolbar-input"
                value={categoryFilterDraft}
                onChange={(event) => setCategoryFilterDraft(event.target.value as CategoryFilter)}
              >
                <option value="all">Category: All</option>
                <option value="Powertrain">Powertrain</option>
                <option value="Engine">Engine</option>
                <option value="Fuel">Fuel</option>
                <option value="Electrical">Electrical</option>
                <option value="Diagnostics">Diagnostics</option>
                <option value="Vehicle Info">Vehicle Info</option>
              </select>

              <select
                className="toolbar-input"
                value={unitFilterDraft}
                onChange={(event) => setUnitFilterDraft(event.target.value as UnitFilter)}
              >
                <option value="all">Unit: All</option>
                <option value="rpm">rpm</option>
                <option value="km/h">km/h</option>
                <option value="°C">°C</option>
                <option value="%">%</option>
                <option value="V">V</option>
                <option value="code">code</option>
                <option value="text">text</option>
                <option value="-">-</option>
              </select>

              <button className="btn-link" type="button" onClick={resetFilters}>Reset</button>
              <button className="btn-primary" type="button" onClick={applyFilters}>Apply</button>
            </div>
          </div>
        )}

        {columnsOpen && (
          <div className="panel" style={{ marginBottom: 12 }}>
            <div className="toolbar-row" style={{ marginBottom: 0 }}>
              <button className="btn-link" type="button" onClick={() => toggleColumn('pid')}>PID {visibleColumns.pid ? '✓' : ''}</button>
              <button className="btn-link" type="button" onClick={() => toggleColumn('mode')}>Mode {visibleColumns.mode ? '✓' : ''}</button>
              <button className="btn-link" type="button" onClick={() => toggleColumn('description')}>Description {visibleColumns.description ? '✓' : ''}</button>
              <button className="btn-link" type="button" onClick={() => toggleColumn('unit')}>Unit {visibleColumns.unit ? '✓' : ''}</button>
              <button className="btn-link" type="button" onClick={() => toggleColumn('category')}>Category {visibleColumns.category ? '✓' : ''}</button>
            </div>
          </div>
        )}

        {actionMessage && <p className="muted-note">{actionMessage}</p>}

        <table className="vehicles-table">
          <thead>
            <tr>
              {visibleColumns.pid && <th>PID</th>}
              {visibleColumns.mode && <th>Mode</th>}
              {visibleColumns.description && <th>Description</th>}
              {visibleColumns.unit && <th>Unit</th>}
              {visibleColumns.category && <th>Category</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={visibleCount} className="empty-cell">No data to display</td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.pid}>
                {visibleColumns.pid && <td>{row.pid}</td>}
                {visibleColumns.mode && <td>{row.mode}</td>}
                {visibleColumns.description && <td>{row.label}</td>}
                {visibleColumns.unit && <td>{row.unit}</td>}
                {visibleColumns.category && <td>{row.category}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
