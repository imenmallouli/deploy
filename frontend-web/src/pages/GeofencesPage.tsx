import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw';
import {
  createGeofence,
  deleteGeofence,
  listGeofenceVehiclePositions,
  listGeofences,
  listVehicles,
  setupGeofenceMonitoring,
} from '../lib/api/endpoints';

function getErrorMessage(error: unknown, fallback = 'Operation failed. Please try again.') {
  const data = (error as { response?: { data?: { message?: string; detail?: string } } })?.response?.data;
  return data?.message ?? data?.detail ?? fallback;
}

export function GeofencesPage() {
  const queryClient = useQueryClient();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const drawLayerRef = useRef<L.FeatureGroup | null>(null);
  const geofenceLayerRef = useRef<L.LayerGroup | null>(null);
  const vehicleLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.CircleMarker | null>(null);

  const [zoneName, setZoneName] = useState('');
  const [drawnPolygon, setDrawnPolygon] = useState<number[][]>([]);
  const [createError, setCreateError] = useState('');
  const [createFeedback, setCreateFeedback] = useState('');

  const [selectedGeofenceId, setSelectedGeofenceId] = useState('');
  const [selectedVehicles, setSelectedVehicles] = useState<number[]>([]);
  const [notificationEmail, setNotificationEmail] = useState('');
  const [setupError, setSetupError] = useState('');
  const [setupFeedback, setSetupFeedback] = useState('');

  const geofencesQuery = useQuery({
    queryKey: ['geofences'],
    queryFn: () => listGeofences(),
  });

  const vehiclesQuery = useQuery({
    queryKey: ['vehicles'],
    queryFn: listVehicles,
  });

  const vehiclePositionsQuery = useQuery({
    queryKey: ['geofence-vehicle-positions'],
    queryFn: listGeofenceVehiclePositions,
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current).setView([35.8256, 10.6084], 13);
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const drawLayer = new L.FeatureGroup();
    drawLayerRef.current = drawLayer;
    map.addLayer(drawLayer);

    const geofenceLayer = L.layerGroup().addTo(map);
    geofenceLayerRef.current = geofenceLayer;

    const vehicleLayer = L.layerGroup().addTo(map);
    vehicleLayerRef.current = vehicleLayer;

    const drawControl = new L.Control.Draw({
      edit: {
        featureGroup: drawLayer,
        edit: false,
        remove: true,
      },
      draw: {
        polyline: false,
        circle: false,
        circlemarker: false,
        marker: false,
        polygon: {},
        rectangle: {},
      },
    });

    map.addControl(drawControl);

    map.on(L.Draw.Event.CREATED, (event: any) => {
      drawLayer.clearLayers();
      const layer = event.layer as L.Polygon;
      drawLayer.addLayer(layer);
      const latLngs = layer.getLatLngs()[0] as L.LatLng[];
      setDrawnPolygon(latLngs.map((p) => [p.lat, p.lng]));
    });

    map.on(L.Draw.Event.DELETED, () => {
      setDrawnPolygon([]);
    });

    // Auto-locate user on load
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          map.setView([latitude, longitude], 15);
          const marker = L.circleMarker([latitude, longitude], {
            radius: 8,
            color: '#1a56db',
            fillColor: '#3b82f6',
            fillOpacity: 0.9,
            weight: 2,
          }).bindPopup('My location').addTo(map);
          userMarkerRef.current = marker;
        },
        () => { /* permission denied or unavailable – keep default view */ }
      );
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const geofenceLayer = geofenceLayerRef.current;
    if (!geofenceLayer) return;

    geofenceLayer.clearLayers();
    const geofences = geofencesQuery.data?.items ?? [];
    geofences.forEach((g) => {
      if (g.polygon && g.polygon.length >= 3) {
        L.polygon(g.polygon as [number, number][], {
          color: '#1465c0',
          weight: 2,
          fillOpacity: 0.2,
        })
          .bindPopup(`<strong>${g.name}</strong>`)
          .addTo(geofenceLayer);
      }
    });
  }, [geofencesQuery.data]);

  useEffect(() => {
    const vehicleLayer = vehicleLayerRef.current;
    if (!vehicleLayer) return;

    vehicleLayer.clearLayers();
    const positions = vehiclePositionsQuery.data?.items ?? [];
    positions.forEach((p) => {
      const vehicle = vehiclesQuery.data?.items?.find((v) => v.id === p.vehicle_id);
      const plateLabel = vehicle?.license_plate ? ` · ${vehicle.license_plate}` : '';
      L.circleMarker([p.latitude, p.longitude], {
        radius: 6,
        color: '#0f8c4a',
        fillColor: '#20bf6b',
        fillOpacity: 0.9,
      })
        .bindPopup(`<strong>Vehicle ${p.vehicle_id}${plateLabel}</strong><br/>${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`)
        .addTo(vehicleLayer);
    });
  }, [vehiclePositionsQuery.data, vehiclesQuery.data]);

  const createMutation = useMutation({
    mutationFn: createGeofence,
    onSuccess: () => {
      setZoneName('');
      setDrawnPolygon([]);
      drawLayerRef.current?.clearLayers();
      setCreateError('');
      setCreateFeedback('Geocloture creee avec succes.');
      queryClient.invalidateQueries({ queryKey: ['geofences'] });
      setTimeout(() => setCreateFeedback(''), 3000);
    },
    onError: (error) => {
      setCreateFeedback('');
      setCreateError(getErrorMessage(error));
    },
  });

  const setupMutation = useMutation({
    mutationFn: setupGeofenceMonitoring,
    onSuccess: () => {
      setSelectedVehicles([]);
      setNotificationEmail('');
      setSetupError('');
      setSetupFeedback('Monitoring sauvegarde avec succes.');
      setTimeout(() => setSetupFeedback(''), 3000);
    },
    onError: (error) => {
      setSetupFeedback('');
      setSetupError(getErrorMessage(error));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteGeofence,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['geofences'] });
    },
  });

  const handleCreateGeofence = () => {
    setCreateError('');
    if (!zoneName.trim()) {
      setCreateError('Le nom de la zone est requis.');
      return;
    }
    if (drawnPolygon.length < 3) {
      setCreateError('Dessinez une zone (carre/polygone) sur la carte.');
      return;
    }

    createMutation.mutate({
      name: zoneName.trim(),
      polygon: drawnPolygon,
      enabled: true,
    });
  };

  const toggleVehicleSelection = (vehicleId: number) => {
    setSelectedVehicles((prev) =>
      prev.includes(vehicleId) ? prev.filter((id) => id !== vehicleId) : [...prev, vehicleId]
    );
  };

  const handleSetupMonitoring = () => {
    setSetupError('');
    if (!selectedGeofenceId) {
      setSetupError('Selectionnez une geocloture.');
      return;
    }
    if (selectedVehicles.length === 0) {
      setSetupError('Selectionnez au moins un vehicule.');
      return;
    }
    if (!notificationEmail.includes('@')) {
      setSetupError('Entrez un email valide.');
      return;
    }

    setupMutation.mutate({
      geofence_id: selectedGeofenceId,
      vehicle_ids: selectedVehicles,
      notification_email: notificationEmail.trim(),
    });
  };

  const geofences = geofencesQuery.data?.items ?? [];
  const vehicles = vehiclesQuery.data?.items ?? [];
  const positions = vehiclePositionsQuery.data?.items ?? [];

  // Point-in-polygon (ray casting) – runs client-side
  function pointInPolygon(lat: number, lng: number, polygon: number[][]): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0], yi = polygon[i][1];
      const xj = polygon[j][0], yj = polygon[j][1];
      const intersect = yi > lng !== yj > lng && lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  // For each vehicle position, find which zone(s) it's currently inside
  function getZoneForPosition(lat: number, lng: number): string {
    const matched = geofences.filter(
      (g) => g.polygon && g.polygon.length >= 3 && pointInPolygon(lat, lng, g.polygon as number[][])
    );
    if (matched.length === 0) return 'Outside all zones';
    return matched.map((g) => g.name).join(', ');
  }

  return (
    <section>
      <h2>Geofences</h2>
      <p className="subtitle">Dessinez votre zone sur la carte puis configurez l'email de notification.</p>

      <div className="panel table-shell" style={{ marginBottom: 16 }}>
        <h3>Carte</h3>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button
            className="btn-secondary"
            onClick={() => {
              if (!navigator.geolocation || !mapRef.current) return;
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  const { latitude, longitude } = pos.coords;
                  mapRef.current!.setView([latitude, longitude], 15);
                  if (userMarkerRef.current) {
                    userMarkerRef.current.setLatLng([latitude, longitude]);
                  } else {
                    userMarkerRef.current = L.circleMarker([latitude, longitude], {
                      radius: 8,
                      color: '#1a56db',
                      fillColor: '#3b82f6',
                      fillOpacity: 0.9,
                      weight: 2,
                    }).bindPopup('My location').addTo(mapRef.current!);
                  }
                },
                () => alert('Unable to get your location.')
              );
            }}
          >
            📍 My Location
          </button>
        </div>
        <div
          ref={mapContainerRef}
          style={{ width: '100%', height: 500, border: '1px solid #d4d4d4', borderRadius: 8 }}
        />
      </div>

      <div className="panel table-shell">
        <h3>Creer une geocloture</h3>
        <div className="toolbar-row" style={{ flexWrap: 'wrap', gap: 8 }}>
          <input
            className="toolbar-input"
            placeholder="Nom de la zone"
            value={zoneName}
            onChange={(e) => setZoneName(e.target.value)}
            style={{ flex: '1 1 220px' }}
          />
          <button className="btn-primary" onClick={handleCreateGeofence} disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creation...' : 'Creer'}
          </button>
        </div>
        {createError && <p className="form-error">{createError}</p>}
        {createFeedback && <p className="muted-note">{createFeedback}</p>}
      </div>

      <div className="panel table-shell">
        <h3>Monitoring et email</h3>
        <div className="toolbar-row" style={{ flexWrap: 'wrap', gap: 8 }}>
          <select
            className="toolbar-input"
            value={selectedGeofenceId}
            onChange={(e) => setSelectedGeofenceId(e.target.value)}
            style={{ flex: '1 1 220px' }}
          >
            <option value="">Selectionner une geocloture...</option>
            {geofences.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <input
            className="toolbar-input"
            placeholder="Email notification"
            value={notificationEmail}
            onChange={(e) => setNotificationEmail(e.target.value)}
            type="email"
            style={{ flex: '1 1 240px' }}
          />
          <button className="btn-primary" onClick={handleSetupMonitoring} disabled={setupMutation.isPending}>
            {setupMutation.isPending ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </div>

        {selectedGeofenceId && (
          <div style={{ marginTop: 12, padding: 12, background: '#f7f7f7', borderRadius: 6 }}>
            <strong>Vehicules surveilles:</strong>
            <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', marginTop: 8 }}>
              {vehicles.map((v) => (
                <label key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={selectedVehicles.includes(v.id)}
                    onChange={() => toggleVehicleSelection(v.id)}
                  />
                  <span>Vehicule {v.id} - {v.license_plate || 'N/A'}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {setupError && <p className="form-error">{setupError}</p>}
        {setupFeedback && <p className="muted-note">{setupFeedback}</p>}
      </div>

      <div className="panel table-shell">
        <h3>Zones existantes</h3>
        <table className="vehicles-table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Type</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {geofences.length === 0 && (
              <tr>
                <td colSpan={4} className="empty-cell">
                  {geofencesQuery.isLoading ? 'Chargement...' : 'Aucune geocloture.'}
                </td>
              </tr>
            )}
            {geofences.map((g) => (
              <tr key={g.id}>
                <td>{g.name}</td>
                <td>{g.polygon?.length ? 'Polygone' : 'Cercle'}</td>
                <td>{g.enabled !== false ? 'Actif' : 'Inactif'}</td>
                <td>
                  <button
                    className="btn-link"
                    style={{ color: 'var(--danger, #dc3545)' }}
                    disabled={deleteMutation.isPending}
                    onClick={() => {
                      if (window.confirm(`Supprimer ${g.name} ?`)) deleteMutation.mutate(g.id);
                    }}
                  >
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Vehicle Locations Table */}
      <div className="panel table-shell">
        <h3>
          Vehicle Locations
          <span style={{ fontSize: 12, fontWeight: 400, marginLeft: 8, color: '#888' }}>
            (auto-refresh every 10s)
          </span>
        </h3>
        <table className="vehicles-table">
          <thead>
            <tr>
              <th>Vehicle ID</th>
              <th>License Plate</th>
              <th>Latitude</th>
              <th>Longitude</th>
              <th>Current Zone</th>
              <th>Show on Map</th>
            </tr>
          </thead>
          <tbody>
            {positions.length === 0 && (
              <tr>
                <td colSpan={6} className="empty-cell">
                  {vehiclePositionsQuery.isLoading ? 'Loading...' : 'No vehicle positions available.'}
                </td>
              </tr>
            )}
            {positions.map((p) => {
              const vehicle = vehicles.find((v) => v.id === p.vehicle_id);
              const zone = getZoneForPosition(p.latitude, p.longitude);
              const isOutside = zone === 'Outside all zones';
              return (
                <tr key={p.vehicle_id}>
                  <td>{p.vehicle_id}</td>
                  <td>{vehicle?.license_plate || 'N/A'}</td>
                  <td>{p.latitude.toFixed(6)}</td>
                  <td>{p.longitude.toFixed(6)}</td>
                  <td>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 12,
                        fontSize: 12,
                        background: isOutside ? '#fff3cd' : '#d1fae5',
                        color: isOutside ? '#856404' : '#065f46',
                        fontWeight: 600,
                      }}
                    >
                      {zone}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn-link"
                      onClick={() => {
                        if (mapRef.current) {
                          mapRef.current.setView([p.latitude, p.longitude], 16);
                        }
                      }}
                    >
                      📍 Show
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
