import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { createLocation, deleteLocation, listLocations, updateLocation } from '../lib/api/endpoints';

type LocationItem = {
  id: string;
  name: string;
  type?: string;
  notes?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  onEnter?: string;
  onExit?: string;
  latitude?: number;
  longitude?: number;
};

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

function getErrorMessage(error: unknown) {
  const data = (error as { response?: { data?: { message?: string; detail?: string } } })?.response?.data;
  return data?.message ?? data?.detail ?? 'Request failed. Please try again.';
}

export function LocationsPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editContactEmail, setEditContactEmail] = useState('');
  const [editContactPhone, setEditContactPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editOnEnter, setEditOnEnter] = useState('');
  const [editOnExit, setEditOnExit] = useState('');
  const [editLatitudeInput, setEditLatitudeInput] = useState('');
  const [editLongitudeInput, setEditLongitudeInput] = useState('');
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
  const [locationError, setLocationError] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [visibleColumns] = useState({
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
  const locationsQuery = useQuery({ queryKey: ['locations'], queryFn: () => listLocations() });
  const createMutation = useMutation({
    mutationFn: createLocation,
    onSuccess: () => {
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
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { name?: string; notes?: string; contactEmail?: string; contactPhone?: string; address?: string; onEnter?: string; onExit?: string; latitude?: number; longitude?: number } }) => updateLocation(id, payload),
    onSuccess: () => {
      setEditId(null);
      setCreateError('');
      setCreateSuccess('Location updated successfully.');
      queryClient.invalidateQueries({ queryKey: ['locations'] });
    },
    onError: (error) => {
      setCreateSuccess('');
      setCreateError(getErrorMessage(error));
    },
  });
  const deleteMutation = useMutation({
    mutationFn: deleteLocation,
    onSuccess: () => {
      setCreateError('');
      setCreateSuccess('Location deleted successfully.');
      queryClient.invalidateQueries({ queryKey: ['locations'] });
    },
    onError: (error) => {
      setCreateSuccess('');
      setCreateError(getErrorMessage(error));
    },
  });

  const latitude = parseDecimal(latitudeInput);
  const longitude = parseDecimal(longitudeInput);
  const editLatitude = parseDecimal(editLatitudeInput);
  const editLongitude = parseDecimal(editLongitudeInput);
  const latitudeProvided = latitudeInput.trim().length > 0;
  const longitudeProvided = longitudeInput.trim().length > 0;
  const editLatitudeProvided = editLatitudeInput.trim().length > 0;
  const editLongitudeProvided = editLongitudeInput.trim().length > 0;
  const latitudeValid = !latitudeProvided || Number.isFinite(latitude);
  const longitudeValid = !longitudeProvided || Number.isFinite(longitude);
  const editLatitudeValid = !editLatitudeProvided || Number.isFinite(editLatitude);
  const editLongitudeValid = !editLongitudeProvided || Number.isFinite(editLongitude);
  const sourceItems = locationsQuery.data?.items ?? [];
  const firstMappableItem = sourceItems.find((item) => item.latitude != null && item.longitude != null);
  const mapLatitude = Number.isFinite(latitude) ? latitude : firstMappableItem?.latitude;
  const mapLongitude = Number.isFinite(longitude) ? longitude : firstMappableItem?.longitude;
  const mapSrc = buildMapEmbedUrl(mapLatitude, mapLongitude);
  const items = sourceItems;

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
      notes: notes.trim() || undefined,
      contactEmail: contactEmail.trim() || undefined,
      contactPhone: contactPhone.trim() || undefined,
      address: address.trim() || undefined,
      onEnter: onEnter.trim() || undefined,
      onExit: onExit.trim() || undefined,
      latitude: latitudeProvided ? latitude : undefined,
      longitude: longitudeProvided ? longitude : undefined,
    });
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by this browser.');
      return;
    }

    setLocationError('');
    setIsLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitudeInput(position.coords.latitude.toFixed(6));
        setLongitudeInput(position.coords.longitude.toFixed(6));
        setIsLocating(false);
      },
      (error) => {
        setLocationError(error.message || 'Unable to fetch current location.');
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['locations'] });
  };

  const startEdit = (item: LocationItem) => {
    setEditId(item.id);
    setEditName(item.name);
    setEditNotes(item.notes ?? '');
    setEditContactEmail(item.contactEmail ?? '');
    setEditContactPhone(item.contactPhone ?? '');
    setEditAddress(item.address ?? '');
    setEditOnEnter(item.onEnter ?? '');
    setEditOnExit(item.onExit ?? '');
    setEditLatitudeInput(item.latitude != null ? String(item.latitude) : '');
    setEditLongitudeInput(item.longitude != null ? String(item.longitude) : '');
    setCreateError('');
    setCreateSuccess('');
  };

  const handleUpdate = () => {
    if (!editId) return;
    if (!editName.trim()) {
      setCreateError('Name is required.');
      return;
    }
    if (!editLatitudeValid || !editLongitudeValid) {
      setCreateError('Latitude/Longitude must be valid numbers (comma or dot accepted).');
      return;
    }
    setCreateError('');
    updateMutation.mutate({
      id: editId,
      payload: {
        name: editName.trim(),
        notes: editNotes.trim() || undefined,
        contactEmail: editContactEmail.trim() || undefined,
        contactPhone: editContactPhone.trim() || undefined,
        address: editAddress.trim() || undefined,
        onEnter: editOnEnter.trim() || undefined,
        onExit: editOnExit.trim() || undefined,
        latitude: editLatitudeProvided ? editLatitude : undefined,
        longitude: editLongitudeProvided ? editLongitude : undefined,
      },
    });
  };

  return (
    <section>
      <h2>Locations</h2>

      {editId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setEditId(null);
              setCreateError('');
            }
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              width: '100%',
              maxWidth: 920,
              padding: '24px 28px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ margin: 0 }}>Update location</h3>
              <button
                type="button"
                className="btn-link"
                onClick={() => {
                  setEditId(null);
                  setCreateError('');
                }}
              >
                Close
              </button>
            </div>

            <div className="toolbar-row" style={{ marginBottom: 8 }}>
              <input className="toolbar-input" placeholder="Name" value={editName} onChange={(e) => setEditName(e.target.value)} />
              <input className="toolbar-input" placeholder="Notes" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
              <input className="toolbar-input" placeholder="Contact email" value={editContactEmail} onChange={(e) => setEditContactEmail(e.target.value)} />
              <input className="toolbar-input" placeholder="Contact phone" value={editContactPhone} onChange={(e) => setEditContactPhone(e.target.value)} />
            </div>
            <div className="toolbar-row" style={{ marginBottom: 8 }}>
              <input className="toolbar-input" placeholder="Address" value={editAddress} onChange={(e) => setEditAddress(e.target.value)} />
              <input className="toolbar-input" placeholder="On enter" value={editOnEnter} onChange={(e) => setEditOnEnter(e.target.value)} />
              <input className="toolbar-input" placeholder="On exit" value={editOnExit} onChange={(e) => setEditOnExit(e.target.value)} />
              <input className="toolbar-input" type="text" inputMode="decimal" value={editLatitudeInput} onChange={(e) => setEditLatitudeInput(e.target.value)} />
              <input className="toolbar-input" type="text" inputMode="decimal" value={editLongitudeInput} onChange={(e) => setEditLongitudeInput(e.target.value)} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                className="btn-link"
                type="button"
                onClick={() => {
                  setEditId(null);
                  setCreateError('');
                }}
              >
                Cancel
              </button>
              <button className="btn-primary" type="button" disabled={updateMutation.isPending} onClick={handleUpdate}>
                {updateMutation.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="panel map-panel">
        <iframe
          title="Locations map"
          className="fleet-map compact"
          src={mapSrc}
        />
      </div>

      <div className="panel table-shell">
        <div className="toolbar-row">
          <div style={{ flex: 1 }} />
          <button className="btn-link" type="button" onClick={handleRefresh}>Refresh</button>
          <button className="btn-primary" type="button" onClick={() => setCreateOpen((open) => !open)}>
            Create
          </button>
        </div>

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
            <button className="btn-link" type="button" onClick={handleUseMyLocation} disabled={isLocating}>
              {isLocating ? 'Locating...' : 'Use my location'}
            </button>
            <button className="btn-primary" type="button" onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Save'}
            </button>
          </div>
        )}

        {createError && <p className="form-error">{createError}</p>}
        {locationError && <p className="form-error">{locationError}</p>}
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
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={Object.values(visibleColumns).filter(Boolean).length + 1} className="empty-cell">No data to display</td>
              </tr>
            )}
            {items.map((item) => (
              <tr key={item.id}>
                {visibleColumns.name && <td>{item.name}</td>}
                {visibleColumns.notes && <td>{item.notes ?? '-'}</td>}
                {visibleColumns.contactEmail && <td>{item.contactEmail ?? '-'}</td>}
                {visibleColumns.contactPhone && <td>{item.contactPhone ?? '-'}</td>}
                {visibleColumns.address && <td>{item.address ?? (item.latitude != null && item.longitude != null ? `${item.latitude}, ${item.longitude}` : '-')}</td>}
                {visibleColumns.users && <td>0</td>}
                {visibleColumns.vehicles && <td>0</td>}
                {visibleColumns.onEnter && <td>{item.onEnter ?? '-'}</td>}
                {visibleColumns.onExit && <td>{item.onExit ?? '-'}</td>}
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn-link" type="button" onClick={() => startEdit(item)}>Update</button>
                  <button
                    className="btn-link"
                    type="button"
                    style={{ color: 'var(--danger, #dc3545)', marginLeft: 8 }}
                    disabled={deleteMutation.isPending}
                    onClick={() => {
                      if (window.confirm(`Delete location "${item.name}"?`)) {
                        deleteMutation.mutate(item.id);
                      }
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
