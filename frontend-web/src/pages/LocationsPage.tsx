import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createLocation, deleteLocation, listGeofenceVehiclePositions, listLocations, listVehicles, updateLocation } from '../lib/api/endpoints';
import type { Vehicle } from '../lib/api/types';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

type VehiclePositionItem = {
  id: string;
  vehicle_id: number;
  latitude: number;
  longitude: number;
  speed?: number;
  updated_at?: string;
};

type DongleLocationRow = {
  vehicle: Vehicle;
  position?: VehiclePositionItem;
  lastSeen?: string | null;
  isConnected: boolean;
};

function parseDecimal(value: string) {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return Number.NaN;
  return Number(normalized);
}

function getErrorMessage(error: unknown) {
  const data = (error as { response?: { data?: { message?: string; detail?: string } } })?.response?.data;
  return data?.message ?? data?.detail ?? 'Request failed. Please try again.';
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return `${String(parsed.getDate()).padStart(2, '0')}/${String(parsed.getMonth() + 1).padStart(2, '0')}/${parsed.getFullYear()} ${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`;
}

function formatRelativeTime(value?: string | null) {
  if (!value) return '-';
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;

  const deltaSeconds = Math.max(0, Math.round((Date.now() - parsed) / 1000));
  if (deltaSeconds < 60) return `il y a ${deltaSeconds} s`;
  if (deltaSeconds < 3600) return `il y a ${Math.round(deltaSeconds / 60)} min`;
  return `il y a ${Math.round(deltaSeconds / 3600)} h`;
}

function isFreshTimestamp(value?: string | null, thresholdMs = 5 * 60 * 1000) {
  if (!value) return false;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return false;
  return Date.now() - parsed <= thresholdMs;
}

export function LocationsPage() {
  const queryClient = useQueryClient();
  const mapRef = useRef<L.Map | null>(null);
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const userMarkerRef = useRef<L.CircleMarker | null>(null);
  const dongleMarkerRef = useRef<L.CircleMarker | null>(null);
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
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [myPosition, setMyPosition] = useState<{ latitude: number; longitude: number } | null>(null);
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
  const vehiclesQuery = useQuery({ queryKey: ['vehicles', 'locations-page'], queryFn: listVehicles });
  const positionsQuery = useQuery({
    queryKey: ['vehicle-positions', 'locations-page'],
    queryFn: listGeofenceVehiclePositions,
    refetchInterval: 15000,
  });
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
  const vehicles = vehiclesQuery.data?.items ?? [];
  const positionItems = positionsQuery.data?.items ?? [];

  const dongleRows = useMemo<DongleLocationRow[]>(() => {
    return vehicles
      .filter((vehicle) => vehicle.dongle_id || vehicle.autopi_device_id || vehicle.autopi_unit_id)
      .map((vehicle) => {
        const position = positionItems.find((item) => item.vehicle_id === vehicle.id);
        const lastSeen = position?.updated_at ?? vehicle.last_autopi_seen ?? vehicle.last_connection ?? null;
        return {
          vehicle,
          position,
          lastSeen,
          isConnected: isFreshTimestamp(lastSeen),
        };
      });
  }, [vehicles, positionItems]);

  const selectedDongle = useMemo(() => {
    const connected = dongleRows.find((row) => row.isConnected && row.position);
    if (connected) return connected;
    return dongleRows.find((row) => row.position) ?? dongleRows[0];
  }, [dongleRows]);

  const selectedDongleStatusLabel = selectedDongle?.isConnected ? 'Connecte' : 'Hors ligne';
  const selectedDongleSyncLabel = formatRelativeTime(selectedDongle?.lastSeen);
  const selectedDonglePositionLabel = selectedDongle?.position
    ? `${selectedDongle.position.latitude.toFixed(5)}, ${selectedDongle.position.longitude.toFixed(5)}`
    : 'indisponible';
  const selectedDongleVehicleLabel = selectedDongle
    ? `${selectedDongle.vehicle.make} ${selectedDongle.vehicle.model}`
    : 'Aucun dongle';
  const selectedDonglePlateLabel = selectedDongle?.vehicle.license_plate ?? '-';
  const selectedDongleSpeedLabel = selectedDongle?.position?.speed != null
    ? `${Math.round(selectedDongle.position.speed)} km/h`
    : '-';

  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setMyPosition({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {
        // Keep silent: user can still see dongle position without browser geolocation.
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 15000,
      },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  useEffect(() => {
    if (!mapNodeRef.current || mapRef.current) return;

    const map = L.map(mapNodeRef.current).setView([35.8256, 10.6084], 12);
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
      userMarkerRef.current = null;
      dongleMarkerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (myPosition) {
      if (!userMarkerRef.current) {
        userMarkerRef.current = L.circleMarker([myPosition.latitude, myPosition.longitude], {
          radius: 7,
          color: '#2563eb',
          fillColor: '#3b82f6',
          fillOpacity: 0.95,
          weight: 2,
        }).addTo(map).bindPopup('Ma position');
      } else {
        userMarkerRef.current.setLatLng([myPosition.latitude, myPosition.longitude]);
      }
    }

    // Always show the last known dongle position when available, even if currently offline.
    const showDongleLocation = Boolean(selectedDongle?.position);
    if (showDongleLocation && selectedDongle?.position) {
      const { latitude: dLat, longitude: dLng } = selectedDongle.position;
      const isOnline = Boolean(selectedDongle?.isConnected);
      const strokeColor = '#15803d';
      const fillColor = '#22c55e';
      const popupText = isOnline ? 'Position dongle' : 'Derniere position dongle (hors ligne)';
      if (!dongleMarkerRef.current) {
        dongleMarkerRef.current = L.circleMarker([dLat, dLng], {
          radius: 7,
          color: strokeColor,
          fillColor,
          fillOpacity: isOnline ? 0.95 : 0.75,
          weight: 2,
        }).addTo(map).bindPopup(popupText);
      } else {
        dongleMarkerRef.current.setLatLng([dLat, dLng]);
        dongleMarkerRef.current.setStyle({
          color: strokeColor,
          fillColor,
          fillOpacity: isOnline ? 0.95 : 0.75,
        });
        dongleMarkerRef.current.bindPopup(popupText);
      }
    } else if (dongleMarkerRef.current) {
      map.removeLayer(dongleMarkerRef.current);
      dongleMarkerRef.current = null;
    }

    const bounds: Array<[number, number]> = [];
    if (myPosition) bounds.push([myPosition.latitude, myPosition.longitude]);
    if (selectedDongle?.position) {
      bounds.push([selectedDongle.position.latitude, selectedDongle.position.longitude]);
    }
    if (bounds.length === 1) {
      map.setView(bounds[0], 14);
    } else if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [24, 24] });
    }
  }, [myPosition, selectedDongle]);

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
        setLocationAccuracy(Math.round(position.coords.accuracy));
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
    queryClient.invalidateQueries({ queryKey: ['vehicles', 'locations-page'] });
    queryClient.invalidateQueries({ queryKey: ['vehicle-positions', 'locations-page'] });
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

      <div className="panel map-panel locations-map-panel">
        <div className="panel-title-row">
          <h3>Locations map</h3>
          <button className="btn-link" type="button" onClick={handleRefresh}>Refresh</button>
        </div>
        <div className="locations-map-shell">
          <div title="Locations map" className="fleet-map compact locations-hero-map" ref={mapNodeRef} />
          <div className="locations-overlay-card locations-overlay-bottom-left locations-overlay-main">
            {!selectedDongle ? (
              <div>
                <strong>Aucun dongle detecte</strong>
              </div>
            ) : selectedDongle.isConnected ? (
              <div>
                <div className="locations-status locations-status-online">Dongle connecte</div>
                <div className="locations-status-grid">
                  <span>Vehicule</span>
                  <strong>{selectedDongleVehicleLabel}</strong>
                  <span>Plaque</span>
                  <strong>{selectedDonglePlateLabel}</strong>
                  <span>Position</span>
                  <strong>{selectedDonglePositionLabel}</strong>
                  <span>Sync</span>
                  <strong>{selectedDongleSyncLabel}</strong>
                </div>
              </div>
            ) : (
              <div>
                <div className="locations-status locations-status-offline">Dongle non connecte</div>
                <div className="locations-status-grid">
                  <span>Vehicule</span>
                  <strong>{selectedDongleVehicleLabel}</strong>
                  <span>Derniere position</span>
                  <strong>{selectedDonglePositionLabel}</strong>
                  <span>Derniere synchro</span>
                  <strong>{selectedDongleSyncLabel}</strong>
                  <span>Horodatage</span>
                  <strong>{formatDateTime(selectedDongle.lastSeen)}</strong>
                </div>
              </div>
            )}
          </div>

          <div className="locations-overlay-card locations-overlay-bottom-right locations-overlay-legend">
            <div className="locations-legend-item">
              <span className="locations-legend-dot locations-legend-dot-user" />
              <span>Ma position</span>
            </div>
            <div className="locations-legend-item">
              <span className="locations-legend-dot locations-legend-dot-dongle" />
              <span>Dongle</span>
            </div>
          </div>
        </div>
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
        {locationAccuracy !== null && (
          <p className="muted-note">📍 Location accuracy: ~{locationAccuracy}m {locationAccuracy > 100 ? '(WiFi/IP — limited accuracy on PC)' : '(good)'}</p>
        )}
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
