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
  // Main map (bottom page)
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const geofenceLayerRef = useRef<L.LayerGroup | null>(null);
  const vehicleLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.CircleMarker | null>(null);

  // Modal map (for drawing)
  const modalMapContainerRef = useRef<HTMLDivElement | null>(null);
  const modalMapRef = useRef<L.Map | null>(null);
  const modalDrawLayerRef = useRef<L.FeatureGroup | null>(null);
  const modalUserMarkerRef = useRef<L.CircleMarker | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [zoneName, setZoneName] = useState('');
  const [drawnPolygon, setDrawnPolygon] = useState<number[][]>([]);
  const [createError, setCreateError] = useState('');
  const [createFeedback, setCreateFeedback] = useState('');
  const [isLocatingMain, setIsLocatingMain] = useState(false);
  const [isLocatingModal, setIsLocatingModal] = useState(false);

  const [selectedGeofenceId, setSelectedGeofenceId] = useState('');
  const [selectedVehicles, setSelectedVehicles] = useState<number[]>([]);
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

    const geofenceLayer = L.layerGroup().addTo(map);
    geofenceLayerRef.current = geofenceLayer;

    const vehicleLayer = L.layerGroup().addTo(map);
    vehicleLayerRef.current = vehicleLayer;

    // Auto-locate user on load with real-time updates
    let watchId: number | null = null;
    if (navigator.geolocation) {
      const geoOptions = { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 };
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          map.setView([latitude, longitude], 15);
          if (userMarkerRef.current) {
            userMarkerRef.current.setLatLng([latitude, longitude]);
          } else {
            userMarkerRef.current = L.circleMarker([latitude, longitude], {
              radius: 8,
              color: '#1a56db',
              fillColor: '#3b82f6',
              fillOpacity: 0.9,
              weight: 2,
            }).bindPopup('My location').addTo(map);
          }
        },
        (error) => {
          console.error('Geolocation error:', error.message);
          if (error.code === 1) {
            alert('❌ Permission refusée. Veuillez autoriser la localisation dans les paramètres du navigateur.');
          }
        },
        geoOptions
      );
    } else {
      alert('⚠️ Géolocalisation non supportée par votre navigateur.');
    }

    return () => {
      // ✅ FIX BUG 4: Cleanup watchPosition to prevent memory leak
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Initialize modal map ONLY when modal opens
  useEffect(() => {
    if (!showCreateModal || !modalMapContainerRef.current) return;

    const timer = setTimeout(() => {
      // If map already exists (modal reopened), force Leaflet to recompute layout.
      if (modalMapRef.current) {
        modalMapRef.current.invalidateSize();
        return;
      }

      try {
        const map = L.map(modalMapContainerRef.current!).setView([35.8256, 10.6084], 13);
        modalMapRef.current = map;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);

        const drawLayer = new L.FeatureGroup();
        modalDrawLayerRef.current = drawLayer;
        map.addLayer(drawLayer);

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

        // Force map to recalculate size
        setTimeout(() => {
          map.invalidateSize();
        }, 400); // ✅ FIX BUG 5: Increased from 200ms to 400ms to ensure CSS animation completes
      } catch (err) {
        console.error('Error initializing modal map:', err);
      }
    }, 180);

    return () => {
      clearTimeout(timer);
      if (modalMapRef.current) {
        modalMapRef.current.remove();
        modalMapRef.current = null;
      }
    };
  }, [showCreateModal]);

  // Sync geofences on main map
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

  // Sync vehicle positions on main map
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
      if (modalDrawLayerRef.current) modalDrawLayerRef.current.clearLayers();
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

  const extractDrawnPolygons = (): number[][] => {
    const drawLayer = modalDrawLayerRef.current;
    if (!drawLayer) return [];
    const layers = drawLayer.getLayers();
    for (const layer of layers) {
      if (layer instanceof L.Polygon) {
        const latLngs = layer.getLatLngs()[0] as L.LatLng[];
        return latLngs.map((p) => [p.lat, p.lng]);
      }
    }
    return [];
  };

  const handleCreateGeofence = () => {
    setCreateError('');
    const polygon = drawnPolygon.length > 0 ? drawnPolygon : extractDrawnPolygons();

    if (!zoneName.trim()) {
      setCreateError('Le nom de la zone est requis.');
      return;
    }
    if (polygon.length < 3) {
      setCreateError('Dessinez une zone (carre/polygone) sur la carte.');
      return;
    }

    createMutation.mutate({
      name: zoneName.trim(),
      polygon: polygon,
      enabled: true,
    });
  };

  const toggleVehicleSelection = (vehicleId: number) => {
    setSelectedVehicles((prev) =>
      prev.includes(vehicleId) ? prev.filter((id) => id !== vehicleId) : [...prev, vehicleId]
    );
  };

  const centerToCurrentLocation = (
    map: L.Map | null,
    markerRef: React.MutableRefObject<L.CircleMarker | null>,
    popupLabel: string,
    setLoading: (loading: boolean) => void
  ) => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by this browser.');
      return;
    }
    if (!map) {
      alert('Map is still loading. Please try again in a second.');
      return;
    }

    setLoading(true);

    const applyPosition = (pos: GeolocationPosition) => {
      const { latitude, longitude } = pos.coords;
      map.setView([latitude, longitude], 16);

      if (markerRef.current) {
        markerRef.current.setLatLng([latitude, longitude]);
      } else {
        markerRef.current = L.circleMarker([latitude, longitude], {
          radius: 8,
          color: '#1a56db',
          fillColor: '#3b82f6',
          fillOpacity: 0.9,
          weight: 2,
        }).bindPopup(popupLabel).addTo(map);
      }

      markerRef.current.bindPopup(`${popupLabel}<br/>Accuracy: ~${Math.round(pos.coords.accuracy)}m`);
      setLoading(false);
    };

    const fallbackLocate = () => {
      navigator.geolocation.getCurrentPosition(
        applyPosition,
        () => {
          alert('Unable to retrieve your location. Check GPS/permission and try again.');
          setLoading(false);
        },
        {
          enableHighAccuracy: false,
          timeout: 25000,
          maximumAge: 60000,
        }
      );
    };

    navigator.geolocation.getCurrentPosition(
      applyPosition,
      (error) => {
        if (error.code === error.TIMEOUT || error.code === error.POSITION_UNAVAILABLE) {
          fallbackLocate();
          return;
        }

        if (error.code === error.PERMISSION_DENIED) {
          alert('Permission denied. Enable location for this site in browser settings.');
        } else {
          alert('Unable to retrieve your location.');
        }
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 0,
      }
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
    setupMutation.mutate({
      geofence_id: selectedGeofenceId,
      vehicle_ids: selectedVehicles,
      notification_email: '',
    });
  };

  const handleDeleteSelectedGeofence = () => {
    if (!selectedGeofenceId) return;
    const selectedGeofence = geofences.find((g) => g.id === selectedGeofenceId);
    const zoneLabel = selectedGeofence?.name ?? 'cette geocloture';

    if (!window.confirm(`Supprimer ${zoneLabel} ?`)) return;

    deleteMutation.mutate(selectedGeofenceId, {
      onSuccess: () => {
        setSelectedGeofenceId('');
        setSelectedVehicles([]);
        setSetupError('');
        setSetupFeedback('Geocloture supprimee avec succes.');
        queryClient.invalidateQueries({ queryKey: ['geofences'] });
      },
    });
  };

  const geofences = geofencesQuery.data?.items ?? [];
  const vehicles = vehiclesQuery.data?.items ?? [];
  const polygonForCreate = drawnPolygon.length > 0 ? drawnPolygon : extractDrawnPolygons();
  const isCreateFormValid = zoneName.trim().length > 0 && polygonForCreate.length >= 3;
  const isMonitoringFormValid = Boolean(selectedGeofenceId) && selectedVehicles.length > 0;

  return (
    <section>
      <h2>Geofences</h2>
      <p className="subtitle">Dessinez une zone sur la carte — une alerte in-app sera déclenchée automatiquement à chaque sortie de zone.</p>

      {/* MAIN PAGE MAP */}
      <div className="panel table-shell" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3>Map</h3>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn-secondary" onClick={() => setShowCreateModal(true)}>
              ➕ New Geofence
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                centerToCurrentLocation(mapRef.current, userMarkerRef, 'My location', setIsLocatingMain);
              }}
              disabled={isLocatingMain}
            >
              {isLocatingMain ? 'Locating...' : '📍 My Location'}
            </button>
          </div>
        </div>
        <div
          ref={mapContainerRef}
          style={{ width: '100%', height: 500, border: '1px solid #d4d4d4', borderRadius: 8 }}
        />
      </div>

      {/* CREATE MODAL - Complete window with ALL content */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            zIndex: 9999,
            overflowY: 'auto',
            paddingTop: 16,
          }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: 12,
              padding: 24,
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
              maxWidth: 1200,
              width: '95%',
              minHeight: 'auto',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* MODAL HEADER */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>Create Geofence</h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setZoneName('');
                  setDrawnPolygon([]);
                  setCreateError('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 24,
                  cursor: 'pointer',
                  color: '#999',
                }}
              >
                ✕
              </button>
            </div>

            {/* SECTION 1: CREER GEOCLOTURE */}
            <div style={{ marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid #eee' }}>
              <h3 style={{ marginTop: 0, marginBottom: 12 }}>
Create a geofence</h3>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 500, fontSize: 14 }}>
                  Draw your zone
                </label>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      centerToCurrentLocation(modalMapRef.current, modalUserMarkerRef, 'Ma localisation', setIsLocatingModal);
                    }}
                    disabled={isLocatingModal}
                    style={{ fontSize: 12, padding: '6px 12px' }}
                  >
                    {isLocatingModal ? 'Locating...' : '📍 Ma localisation'}
                  </button>
                </div>
                <div
                  ref={modalMapContainerRef}
                  style={{
                    width: '100%',
                    height: 500,
                    border: '1px solid #d4d4d4',
                    borderRadius: 8,
                    backgroundColor: '#f5f5f5',
                    position: 'relative',
                  }}
                />

                <div style={{ marginTop: 14 }}>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 500, fontSize: 14 }}>
                    Zone name
                  </label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                    <input
                      className="toolbar-input"
                      placeholder="Ex: Main Depot"
                      value={zoneName}
                      onChange={(e) => setZoneName(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button
                      className="btn-primary"
                      onClick={handleCreateGeofence}
                      disabled={createMutation.isPending || !isCreateFormValid}
                      title={!isCreateFormValid ? 'Enter the name + draw the zone first' : undefined}
                      style={{ minWidth: 140, width: 'auto' }}
                    >
                      {createMutation.isPending ? 'Creating...' : 'Create Zone'}
                    </button>
                  </div>
                </div>

                {!isCreateFormValid && (
                  <p className="muted-note" style={{ marginTop: 0, marginBottom: 10 }}>
                    Enter the name and draw the zone before creating.
                  </p>
                )}

                {createError && <p className="form-error" style={{ marginBottom: 12 }}>{createError}</p>}
              </div>
              {createFeedback && <p className="muted-note" style={{ marginTop: 12, marginBottom: 0 }}>{createFeedback}</p>}
            </div>

            {/* SECTION 2: MONITORING */}
            <div style={{ marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid #eee' }}>
              <h3 style={{ marginTop: 0, marginBottom: 12 }}>Monitoring — alertes in-app</h3>
              <div className="toolbar-row" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                <select
                  className="toolbar-input"
                  value={selectedGeofenceId}
                  onChange={(e) => setSelectedGeofenceId(e.target.value)}
                  style={{ flex: '1 1 220px' }}
                >
                  <option value="">Select a geofence...</option>
                  {geofences.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <button
                  className="btn-primary"
                  onClick={handleSetupMonitoring}
                  disabled={setupMutation.isPending || !isMonitoringFormValid}
                  title={!selectedGeofenceId ? 'Selectionnez une geocloture d abord' : undefined}
                >
                  {setupMutation.isPending ? 'Sauvegarde...' : 'Activer monitoring'}
                </button>
                <button
                  className="btn-link"
                  onClick={handleDeleteSelectedGeofence}
                  disabled={!selectedGeofenceId || deleteMutation.isPending}
                  style={{ color: 'var(--danger, #dc3545)' }}
                  title={!selectedGeofenceId ? 'Selectionnez une geocloture a supprimer' : undefined}
                >
                  {deleteMutation.isPending ? 'Suppression...' : 'Delete selected area'}
                </button>
              </div>

              {!selectedGeofenceId && (
                <p className="muted-note" style={{ marginTop: 0, marginBottom: 10 }}>
                 Sélectionnez une zone pour activer le monitoring. Les alertes in-app sont déclenchées automatiquement à chaque sortie de zone.
                </p>
              )}

              {selectedGeofenceId && (
                <div style={{ marginBottom: 12, padding: 12, background: '#f7f7f7', borderRadius: 6 }}>
                  <strong>Monitored Vehicles:</strong>
                  <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', marginTop: 8 }}>
                    {vehicles.map((v) => (
                      <label key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                        <input
                          type="checkbox"
                          checked={selectedVehicles.includes(v.id)}
                          onChange={() => toggleVehicleSelection(v.id)}
                        />
                        <span>Vehicle {v.id} - {v.license_plate || 'N/A'}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {setupError && <p className="form-error">{setupError}</p>}
              {setupFeedback && <p className="muted-note">{setupFeedback}</p>}
            </div>

            {/* SECTION 3: ZONES EXISTANTES - REMOVED FROM MODAL */}
            {/* This section is now only on the main page below */}

            {/* MODAL FOOTER */}
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #eee', textAlign: 'right' }}>
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowCreateModal(false);
                  setZoneName('');
                  setDrawnPolygon([]);
                  setCreateError('');
                }}
              >
                close 
              </button>
            </div>
          </div>
        </div>
      )}

      {createFeedback && <p className="muted-note" style={{ marginBottom: 16 }}>{createFeedback}</p>}
    </section>
  );
}
