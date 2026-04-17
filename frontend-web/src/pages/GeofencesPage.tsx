import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { createGeofence, deleteGeofence, listGeofences } from '../lib/api/endpoints';

function parseDecimal(value: string) {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return Number.NaN;
  return Number(normalized);
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

function getErrorMessage(error: unknown, fallback = 'Operation failed. Please try again.') {
  const data = (error as { response?: { data?: { message?: string; detail?: string } } })?.response?.data;
  return data?.message ?? data?.detail ?? fallback;
}

export function GeofencesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
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
  const deleteMutation = useMutation({
    mutationFn: deleteGeofence,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['geofences'] }); },
  });

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
  const canCreate = name.trim().length > 0 && Number.isFinite(centerLat) && Number.isFinite(centerLng) && Number.isFinite(radiusM) && radiusM > 0;
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

        {createError && <p className="form-error">{createError}</p>}
        {createFeedback && <p className="muted-note">{createFeedback}</p>}

      
        <div className="toolbar-row">
          <input className="toolbar-input" type="number" placeholder="Vehicle ID (optional)" value={checkVehicleId} onChange={(e) => setCheckVehicleId(e.target.value)} />
          <input className="toolbar-input" type="text" inputMode="decimal" placeholder="Position lat" value={checkLatInput} onChange={(e) => setCheckLatInput(e.target.value)} />
          <input className="toolbar-input" type="text" inputMode="decimal" placeholder="Position lng" value={checkLngInput} onChange={(e) => setCheckLngInput(e.target.value)} />
        </div>
        <table className="vehicles-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>On Enter</th>
              <th>On Exit</th>
              <th>Center</th>
              <th>Radius (m)</th>
              <th>Vehicles</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={8} className="empty-cell">No data to display</td>
              </tr>
            )}
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.description ?? '-'}</td>
                <td>{item.on_enter ?? '-'}</td>
                <td>{item.on_exit ?? '-'}</td>
                <td>{item.center_lat ?? '-'}, {item.center_lng ?? '-'}</td>
                <td>{item.radius_m ?? '-'}</td>
                <td>{item.vehicle_count ?? 0}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button
                    className="btn-link"
                    type="button"
                    style={{ color: 'var(--danger, #dc3545)' }}
                    disabled={deleteMutation.isPending}
                    onClick={() => { if (window.confirm(`Delete "${item.name}"?`)) deleteMutation.mutate(item.id); }}
                  >Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>


      </div>
    </section>
  );
}
