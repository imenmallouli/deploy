import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { createLocation, listLocations } from '../lib/api/endpoints';

function parseDecimal(value: string) {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return Number.NaN;
  return Number(normalized);
}

function getErrorMessage(error: unknown) {
  const data = (error as { response?: { data?: { message?: string; detail?: string } } })?.response?.data;
  return data?.message ?? data?.detail ?? 'Request failed. Please try again.';
}

export function LocationsPage() {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [addressFilterDraft, setAddressFilterDraft] = useState<'all' | 'with' | 'without'>('all');
  const [addressFilter, setAddressFilter] = useState<'all' | 'with' | 'without'>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [address, setAddress] = useState('');
  const [onEnter, setOnEnter] = useState('');
  const [onExit, setOnExit] = useState('');
  const [latitudeInput, setLatitudeInput] = useState('');
  const [longitudeInput, setLongitudeInput] = useState('');
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const [visibleColumns, setVisibleColumns] = useState({
    name: true,
    notes: true,
    contactEmail: true,
    contactPhone: true,
    address: true,
    users: true,
    vehicles: true,
    onEnter: true,
    onExit: true,
  });
  const [locationMeta, setLocationMeta] = useState<Record<string, {
    notes?: string;
    contactEmail?: string;
    contactPhone?: string;
    address?: string;
    onEnter?: string;
    onExit?: string;
  }>>({});

  const locationsQuery = useQuery({ queryKey: ['locations', search], queryFn: () => listLocations(search || undefined) });
  const createMutation = useMutation({
    mutationFn: createLocation,
    onSuccess: (result) => {
      const createdId = (result as { item?: { id?: string } })?.item?.id;
      if (createdId) {
        setLocationMeta((prev) => ({
          ...prev,
          [createdId]: {
            notes: notes.trim() || undefined,
            contactEmail: contactEmail.trim() || undefined,
            contactPhone: contactPhone.trim() || undefined,
            address: address.trim() || undefined,
            onEnter: onEnter.trim() || undefined,
            onExit: onExit.trim() || undefined,
          },
        }));
      }
      setName('');
      setNotes('');
      setContactEmail('');
      setContactPhone('');
      setAddress('');
      setOnEnter('');
      setOnExit('');
      setLatitudeInput('');
      setLongitudeInput('');
      setCreateError('');
      setCreateSuccess('Location created successfully.');
      queryClient.invalidateQueries({ queryKey: ['locations'] });
    },
    onError: (error) => {
      setCreateSuccess('');
      setCreateError(getErrorMessage(error));
    },
  });

  const latitude = parseDecimal(latitudeInput);
  const longitude = parseDecimal(longitudeInput);
  const latitudeProvided = latitudeInput.trim().length > 0;
  const longitudeProvided = longitudeInput.trim().length > 0;
  const latitudeValid = !latitudeProvided || Number.isFinite(latitude);
  const longitudeValid = !longitudeProvided || Number.isFinite(longitude);
  const sourceItems = locationsQuery.data?.items ?? [];
  const items = sourceItems.filter((item) => {
    const resolvedAddress = locationMeta[item.id]?.address ?? (item.latitude != null && item.longitude != null ? `${item.latitude}, ${item.longitude}` : '');
    if (addressFilter === 'with') return Boolean(resolvedAddress);
    if (addressFilter === 'without') return !resolvedAddress;
    return true;
  });

  const handleCreate = () => {
    setCreateSuccess('');
    if (!name.trim()) {
      setCreateError('Name is required.');
      return;
    }
    if (!latitudeValid || !longitudeValid) {
      setCreateError('Latitude/Longitude must be valid numbers (comma or dot accepted).');
      return;
    }
    setCreateError('');
    createMutation.mutate({
      name: name.trim(),
      latitude: latitudeProvided ? latitude : undefined,
      longitude: longitudeProvided ? longitude : undefined,
    });
  };

  const handleSearch = () => {
    setSearch(searchInput.trim());
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['locations'] });
  };

  const applyFilters = () => {
    setAddressFilter(addressFilterDraft);
    setFiltersOpen(false);
  };

  const resetFilters = () => {
    setAddressFilterDraft('all');
    setAddressFilter('all');
  };

  const toggleColumn = (column: keyof typeof visibleColumns) => {
    setVisibleColumns((prev) => ({ ...prev, [column]: !prev[column] }));
  };

  return (
    <section>
      <h2>Locations</h2>

      <div className="panel map-panel">
        <iframe
          title="Locations map"
          className="fleet-map compact"
          src="https://www.openstreetmap.org/export/embed.html?bbox=-3.8%2C43.8%2C3.8%2C49.2&amp;layer=mapnik"
        />
      </div>

      <div className="panel table-shell">
        <div className="toolbar-row">
          <input className="toolbar-input" placeholder="Search for locations" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          <button className="btn-link" type="button" onClick={() => setFiltersOpen((open) => !open)}>Filters</button>
          <button className="btn-link" type="button" onClick={() => setColumnsOpen((open) => !open)}>Columns</button>
          <button className="btn-link" type="button" onClick={handleSearch}>Search</button>
          <div style={{ flex: 1 }} />
          <button className="btn-link" type="button" onClick={handleRefresh}>Refresh</button>
          <button className="btn-primary" type="button" onClick={() => setCreateOpen((open) => !open)}>
            Create
          </button>
        </div>

        {filtersOpen && (
          <div className="panel" style={{ marginBottom: 12 }}>
            <div className="toolbar-row" style={{ marginBottom: 0 }}>
              <select
                className="toolbar-input"
                value={addressFilterDraft}
                onChange={(event) => setAddressFilterDraft(event.target.value as 'all' | 'with' | 'without')}
              >
                <option value="all">Address: All</option>
                <option value="with">With address</option>
                <option value="without">Without address</option>
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
              <button className="btn-link" type="button" onClick={() => toggleColumn('notes')}>Notes {visibleColumns.notes ? '✓' : ''}</button>
              <button className="btn-link" type="button" onClick={() => toggleColumn('contactEmail')}>Contact Email {visibleColumns.contactEmail ? '✓' : ''}</button>
              <button className="btn-link" type="button" onClick={() => toggleColumn('contactPhone')}>Contact Phone {visibleColumns.contactPhone ? '✓' : ''}</button>
              <button className="btn-link" type="button" onClick={() => toggleColumn('address')}>Address {visibleColumns.address ? '✓' : ''}</button>
              <button className="btn-link" type="button" onClick={() => toggleColumn('users')}>Users {visibleColumns.users ? '✓' : ''}</button>
              <button className="btn-link" type="button" onClick={() => toggleColumn('vehicles')}>Vehicles {visibleColumns.vehicles ? '✓' : ''}</button>
              <button className="btn-link" type="button" onClick={() => toggleColumn('onEnter')}>On Enter {visibleColumns.onEnter ? '✓' : ''}</button>
              <button className="btn-link" type="button" onClick={() => toggleColumn('onExit')}>On Exit {visibleColumns.onExit ? '✓' : ''}</button>
            </div>
          </div>
        )}

        {createOpen && (
          <div className="toolbar-row" style={{ marginBottom: 12 }}>
            <input className="toolbar-input" placeholder="New location name" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="toolbar-input" placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <input className="toolbar-input" placeholder="Contact email (optional)" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
            <input className="toolbar-input" placeholder="Contact phone (optional)" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
            <input className="toolbar-input" placeholder="Address (optional)" value={address} onChange={(e) => setAddress(e.target.value)} />
            <input className="toolbar-input" placeholder="On enter action (optional)" value={onEnter} onChange={(e) => setOnEnter(e.target.value)} />
            <input className="toolbar-input" placeholder="On exit action (optional)" value={onExit} onChange={(e) => setOnExit(e.target.value)} />
            <input className="toolbar-input" type="text" inputMode="decimal" placeholder="Latitude (optional)" value={latitudeInput} onChange={(e) => setLatitudeInput(e.target.value)} />
            <input className="toolbar-input" type="text" inputMode="decimal" placeholder="Longitude (optional)" value={longitudeInput} onChange={(e) => setLongitudeInput(e.target.value)} />
            <button className="btn-primary" type="button" onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Save'}
            </button>
          </div>
        )}

        {createError && <p className="form-error">{createError}</p>}
        {createSuccess && <p className="muted-note">{createSuccess}</p>}

        <table className="vehicles-table">
          <thead>
            <tr>
              {visibleColumns.name && <th>Name ↕</th>}
              {visibleColumns.notes && <th>Notes</th>}
              {visibleColumns.contactEmail && <th>Contact Email ↕</th>}
              {visibleColumns.contactPhone && <th>Contact Phone</th>}
              {visibleColumns.address && <th>Address ↕</th>}
              {visibleColumns.users && <th>Users</th>}
              {visibleColumns.vehicles && <th>Vehicles</th>}
              {visibleColumns.onEnter && <th>On Enter</th>}
              {visibleColumns.onExit && <th>On Exit</th>}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={Object.values(visibleColumns).filter(Boolean).length} className="empty-cell">No data to display</td>
              </tr>
            )}
            {items.map((item) => (
              <tr key={item.id}>
                {visibleColumns.name && <td>{item.name}</td>}
                {visibleColumns.notes && <td>{locationMeta[item.id]?.notes ?? '-'}</td>}
                {visibleColumns.contactEmail && <td>{locationMeta[item.id]?.contactEmail ?? '-'}</td>}
                {visibleColumns.contactPhone && <td>{locationMeta[item.id]?.contactPhone ?? '-'}</td>}
                {visibleColumns.address && <td>{locationMeta[item.id]?.address ?? (item.latitude != null && item.longitude != null ? `${item.latitude}, ${item.longitude}` : '-')}</td>}
                {visibleColumns.users && <td>0</td>}
                {visibleColumns.vehicles && <td>0</td>}
                {visibleColumns.onEnter && <td>{locationMeta[item.id]?.onEnter ?? '-'}</td>}
                {visibleColumns.onExit && <td>{locationMeta[item.id]?.onExit ?? '-'}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
