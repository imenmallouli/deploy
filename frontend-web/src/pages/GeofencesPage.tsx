import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { checkGeofences, createGeofence, listGeofences } from '../lib/api/endpoints';

function parseDecimal(value: string) {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return Number.NaN;
  return Number(normalized);
}

function parseOptionalNumber(value: string): number | undefined {
  const normalized = value.trim();
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function buildMapEmbedUrl(latitude?: number, longitude?: number) {
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    const lat = Number(latitude);
    const lng = Number(longitude);
    const lngDelta = 0.02;
    const latDelta = 0.01;
    const left = (lng - lngDelta).toFixed(6);
    const bottom = (lat - latDelta).toFixed(6);
    const right = (lng + lngDelta).toFixed(6);
    const top = (lat + latDelta).toFixed(6);
    const marker = `${lat.toFixed(6)}%2C${lng.toFixed(6)}`;

    return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${marker}`;
  }

  return 'https://www.openstreetmap.org/export/embed.html?bbox=-3.8%2C43.8%2C3.8%2C49.2&layer=mapnik';
}

function getErrorMessage(error: unknown) {
  const data = (error as { response?: { data?: { message?: string; detail?: string } } })?.response?.data;
  return data?.message ?? data?.detail ?? 'Create failed. Please try again.';
}

export function GeofencesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [enabledDraft, setEnabledDraft] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [enabledFilter, setEnabledFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [onEnter, setOnEnter] = useState('');
  const [onExit, setOnExit] = useState('');
  const [centerLatInput, setCenterLatInput] = useState('');
  const [centerLngInput, setCenterLngInput] = useState('');
  const [radiusMInput, setRadiusMInput] = useState('');
  const [checkVehicleId, setCheckVehicleId] = useState('');
  const [checkLatInput, setCheckLatInput] = useState('');
  const [checkLngInput, setCheckLngInput] = useState('');
  const [createFeedback, setCreateFeedback] = useState('');
  const [createError, setCreateError] = useState('');
  const [visibleColumns, setVisibleColumns] = useState({
    name: true,
    description: true,
    onEnter: true,
    onExit: true,
    center: true,
    radius: true,
    vehicles: true,
    actions: true,
  });

  const geofencesQuery = useQuery({ queryKey: ['geofences', search], queryFn: () => listGeofences(search || undefined) });
  const createMutation = useMutation({
    mutationFn: createGeofence,
    onSuccess: () => {
      setName('');
      setDescription('');
      setOnEnter('');
      setOnExit('');
      setCreateError('');
      setCreateFeedback('Geofence created successfully.');
      queryClient.invalidateQueries({ queryKey: ['geofences'] });
    },
    onError: (error) => {
      setCreateFeedback('');
      setCreateError(getErrorMessage(error));
    },
  });
  const checkMutation = useMutation({ mutationFn: checkGeofences });

  const sourceItems = geofencesQuery.data?.items ?? [];
  const items = sourceItems.filter((item) => {
    if (enabledFilter === 'enabled') return item.enabled !== false;
    if (enabledFilter === 'disabled') return item.enabled === false;
    return true;
  });
  const centerLat = parseDecimal(centerLatInput);
  const centerLng = parseDecimal(centerLngInput);
  const radiusM = parseDecimal(radiusMInput);
  const checkLat = parseDecimal(checkLatInput);
  const checkLng = parseDecimal(checkLngInput);
  const checkVehicleIdValue = parseOptionalNumber(checkVehicleId);
  const canCreate = name.trim().length > 0 && Number.isFinite(centerLat) && Number.isFinite(centerLng) && Number.isFinite(radiusM) && radiusM > 0;
  const canCheck = Number.isFinite(checkLat) && Number.isFinite(checkLng);
  const visibleCount = Object.values(visibleColumns).filter(Boolean).length;
  const mapLatitude = Number.isFinite(checkLat) ? checkLat : Number.isFinite(centerLat) ? centerLat : undefined;
  const mapLongitude = Number.isFinite(checkLng) ? checkLng : Number.isFinite(centerLng) ? centerLng : undefined;
  const mapSrc = buildMapEmbedUrl(mapLatitude, mapLongitude);

  const handleCreate = () => {
    setCreateFeedback('');
    if (!name.trim()) {
      setCreateError('Name is required.');
      return;
    }
    if (!canCreate) {
      setCreateError('Latitude, longitude and radius must be valid numbers.');
      return;
    }
    setCreateError('');
    createMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      on_enter: onEnter.trim() || undefined,
      on_exit: onExit.trim() || undefined,
      center_lat: centerLat,
      center_lng: centerLng,
      radius_m: radiusM,
      enabled: true,
    });
  };

  const applyFilters = () => {
    setEnabledFilter(enabledDraft);
    setFiltersOpen(false);
  };

  const resetFilters = () => {
    setEnabledDraft('all');
    setEnabledFilter('all');
  };

  const toggleColumn = (column: keyof typeof visibleColumns) => {
    setVisibleColumns((prev) => ({ ...prev, [column]: !prev[column] }));
  };

  return (
    <section>
      <h2>Geofences</h2>
      <div className="panel map-panel">
        <iframe
          title="Geofences map"
          className="fleet-map compact"
          src={mapSrc}
        />
      </div>

      <div className="panel table-shell">
        <div className="toolbar-row">
          <input className="toolbar-input" placeholder="Search for geofences" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="btn-link" type="button" onClick={() => setFiltersOpen((open) => !open)}>Filters</button>
          <button className="btn-link" type="button" onClick={() => setColumnsOpen((open) => !open)}>Columns</button>
          <input className="toolbar-input" placeholder="New geofence name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="toolbar-input" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <input className="toolbar-input" placeholder="On enter action" value={onEnter} onChange={(e) => setOnEnter(e.target.value)} />
          <input className="toolbar-input" placeholder="On exit action" value={onExit} onChange={(e) => setOnExit(e.target.value)} />
          <input className="toolbar-input" type="text" inputMode="decimal" placeholder="Center lat" value={centerLatInput} onChange={(e) => setCenterLatInput(e.target.value)} />
          <input className="toolbar-input" type="text" inputMode="decimal" placeholder="Center lng" value={centerLngInput} onChange={(e) => setCenterLngInput(e.target.value)} />
          <input className="toolbar-input" type="text" inputMode="decimal" placeholder="Radius (m)" value={radiusMInput} onChange={(e) => setRadiusMInput(e.target.value)} />
          <button
            className="btn-primary"
            type="button"
            onClick={handleCreate}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? 'Creating...' : 'Create'}
          </button>
        </div>

        {filtersOpen && (
          <div className="panel" style={{ marginBottom: 12 }}>
            <div className="toolbar-row" style={{ marginBottom: 0 }}>
              <select
                className="toolbar-input"
                value={enabledDraft}
                onChange={(event) => setEnabledDraft(event.target.value as 'all' | 'enabled' | 'disabled')}
              >
                <option value="all">Enabled: All</option>
                <option value="enabled">Enabled only</option>
                <option value="disabled">Disabled only</option>
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
              <button className="btn-link" type="button" onClick={() => toggleColumn('description')}>Description {visibleColumns.description ? '✓' : ''}</button>
              <button className="btn-link" type="button" onClick={() => toggleColumn('onEnter')}>On Enter {visibleColumns.onEnter ? '✓' : ''}</button>
              <button className="btn-link" type="button" onClick={() => toggleColumn('onExit')}>On Exit {visibleColumns.onExit ? '✓' : ''}</button>
              <button className="btn-link" type="button" onClick={() => toggleColumn('center')}>Center {visibleColumns.center ? '✓' : ''}</button>
              <button className="btn-link" type="button" onClick={() => toggleColumn('radius')}>Radius {visibleColumns.radius ? '✓' : ''}</button>
              <button className="btn-link" type="button" onClick={() => toggleColumn('vehicles')}>Vehicles {visibleColumns.vehicles ? '✓' : ''}</button>
              <button className="btn-link" type="button" onClick={() => toggleColumn('actions')}>Actions {visibleColumns.actions ? '✓' : ''}</button>
            </div>
          </div>
        )}

        {createError && <p className="form-error">{createError}</p>}
        {createFeedback && <p className="muted-note">{createFeedback}</p>}

        <div className="toolbar-row">
          <input className="toolbar-input" type="number" placeholder="Vehicle ID (optional)" value={checkVehicleId} onChange={(e) => setCheckVehicleId(e.target.value)} />
          <input className="toolbar-input" type="text" inputMode="decimal" placeholder="Position lat" value={checkLatInput} onChange={(e) => setCheckLatInput(e.target.value)} />
          <input className="toolbar-input" type="text" inputMode="decimal" placeholder="Position lng" value={checkLngInput} onChange={(e) => setCheckLngInput(e.target.value)} />
          <button
            className="btn-link"
            type="button"
            disabled={!canCheck || checkMutation.isPending}
            onClick={() => checkMutation.mutate({
              vehicle_id: checkVehicleIdValue,
              latitude: checkLat,
              longitude: checkLng,
            })}
          >
            Check position
          </button>
        </div>

        <table className="vehicles-table">
          <thead>
            <tr>
              {visibleColumns.name && <th>Name</th>}
              {visibleColumns.description && <th>Description</th>}
              {visibleColumns.onEnter && <th>On Enter</th>}
              {visibleColumns.onExit && <th>On Exit</th>}
              {visibleColumns.center && <th>Center</th>}
              {visibleColumns.radius && <th>Radius (m)</th>}
              {visibleColumns.vehicles && <th>Vehicles</th>}
              {visibleColumns.actions && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={visibleCount} className="empty-cell">No data to display</td>
              </tr>
            )}
            {items.map((item) => (
              <tr key={item.id}>
                {visibleColumns.name && <td>{item.name}</td>}
                {visibleColumns.description && <td>{item.description ?? '-'}</td>}
                {visibleColumns.onEnter && <td>{item.on_enter ?? '-'}</td>}
                {visibleColumns.onExit && <td>{item.on_exit ?? '-'}</td>}
                {visibleColumns.center && <td>{item.center_lat ?? '-'}, {item.center_lng ?? '-'}</td>}
                {visibleColumns.radius && <td>{item.radius_m ?? '-'}</td>}
                {visibleColumns.vehicles && <td>{item.vehicle_count ?? 0}</td>}
                {visibleColumns.actions && <td>-</td>}
              </tr>
            ))}
          </tbody>
        </table>

        <pre className="json-preview">{JSON.stringify(checkMutation.data ?? {}, null, 2)}</pre>
      </div>
    </section>
  );
}
