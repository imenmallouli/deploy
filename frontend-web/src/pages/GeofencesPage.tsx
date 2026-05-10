import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw';
import {
  createLocation,
  createGeofence,
  deleteGeofence,
  deleteLocation,
  listGeofenceVehiclePositions,
  listGeofences,
  listLocations,
  listVehicles,
  setupGeofenceMonitoring,
  updateGeofence,
  updateLocation,
} from '../lib/api/endpoints';

type LocationItem = {
  id: string;
  name: string;
  notes?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  onEnter?: string;
  onExit?: string;
  latitude?: number;
  longitude?: number;
};

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
  const [zoneNotes, setZoneNotes] = useState('');
  const [zoneContactEmail, setZoneContactEmail] = useState('');
  const [zoneContactPhone, setZoneContactPhone] = useState('');
  const [zoneAddress, setZoneAddress] = useState('');
  const [zoneOnEnter, setZoneOnEnter] = useState('');
  const [zoneOnExit, setZoneOnExit] = useState('');
  const [drawnPolygon, setDrawnPolygon] = useState<number[][]>([]);
  const [createError, setCreateError] = useState('');
  const [createFeedback, setCreateFeedback] = useState('');
  const [isLocatingMain, setIsLocatingMain] = useState(false);
  const [isLocatingModal, setIsLocatingModal] = useState(false);

  const [selectedGeofenceId, setSelectedGeofenceId] = useState('');
  const [selectedVehicles, setSelectedVehicles] = useState<number[]>([]);
  const [setupError, setSetupError] = useState('');
  const [setupFeedback, setSetupFeedback] = useState('');
  const [editLocationId, setEditLocationId] = useState<string | null>(null);
  const [editGeofenceId, setEditGeofenceId] = useState<string | null>(null);
  const [editLocationName, setEditLocationName] = useState('');
  const [editLocationNotes, setEditLocationNotes] = useState('');
  const [editLocationEmail, setEditLocationEmail] = useState('');
  const [editLocationPhone, setEditLocationPhone] = useState('');
  const [editLocationAddress, setEditLocationAddress] = useState('');
  const [editLocationOnEnter, setEditLocationOnEnter] = useState('');
  const [editLocationOnExit, setEditLocationOnExit] = useState('');
  const [locationActionError, setLocationActionError] = useState('');
  const [locationActionFeedback, setLocationActionFeedback] = useState('');

  const geofencesQuery = useQuery({
    queryKey: ['geofences'],
    queryFn: () => listGeofences(),
  });

  const vehiclesQuery = useQuery({
    queryKey: ['vehicles'],
    queryFn: listVehicles,
  });

  const locationsQuery = useQuery({
    queryKey: ['locations', 'geofences-page'],
    queryFn: () => listLocations(),
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
    mutationFn: async (payload: {
      geofence: { name: string; polygon: number[][]; enabled: boolean; on_enter?: string; on_exit?: string };
      location: { name: string; notes?: string; contactEmail?: string; contactPhone?: string; address?: string; onEnter?: string; onExit?: string; latitude?: number; longitude?: number };
    }) => {
      const geofenceResult = await createGeofence(payload.geofence);
      await createLocation(payload.location);
      return geofenceResult;
    },
    onSuccess: () => {
      setZoneName('');
      setZoneNotes('');
      setZoneContactEmail('');
      setZoneContactPhone('');
      setZoneAddress('');
      setZoneOnEnter('');
      setZoneOnExit('');
      setDrawnPolygon([]);
      if (modalDrawLayerRef.current) modalDrawLayerRef.current.clearLayers();
      setCreateError('');
      setCreateFeedback('Geocloture creee avec succes.');
      queryClient.invalidateQueries({ queryKey: ['geofences'] });
      queryClient.invalidateQueries({ queryKey: ['locations', 'geofences-page'] });
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

  const updateLocationMutation = useMutation({
    mutationFn: async ({
      locationId,
      geofenceId,
      payload,
    }: {
      locationId: string;
      geofenceId: string;
      payload: Partial<LocationItem>;
    }) => {
      await updateGeofence(geofenceId, {
        name: payload.name,
        on_enter: payload.onEnter,
        on_exit: payload.onExit,
      });
      return updateLocation(locationId, payload);
    },
    onSuccess: () => {
      setEditLocationId(null);
      setEditGeofenceId(null);
      setLocationActionError('');
      setLocationActionFeedback('Geofence and location updated successfully.');
      queryClient.invalidateQueries({ queryKey: ['geofences'] });
      queryClient.invalidateQueries({ queryKey: ['locations', 'geofences-page'] });
    },
    onError: (error) => {
      setLocationActionFeedback('');
      setLocationActionError(getErrorMessage(error));
    },
  });

  const deleteLocationMutation = useMutation({
    mutationFn: async ({ locationId, geofenceId }: { locationId: string; geofenceId: string }) => {
      await deleteGeofence(geofenceId);
      return deleteLocation(locationId);
    },
    onSuccess: () => {
      setLocationActionError('');
      setLocationActionFeedback('Geofence and location deleted successfully.');
      queryClient.invalidateQueries({ queryKey: ['geofences'] });
      queryClient.invalidateQueries({ queryKey: ['locations', 'geofences-page'] });
    },
    onError: (error) => {
      setLocationActionFeedback('');
      setLocationActionError(getErrorMessage(error));
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

    const centerLat = polygon.reduce((sum, point) => sum + point[0], 0) / polygon.length;
    const centerLng = polygon.reduce((sum, point) => sum + point[1], 0) / polygon.length;

    createMutation.mutate({
      geofence: {
        name: zoneName.trim(),
        polygon,
        enabled: true,
        on_enter: zoneOnEnter || undefined,
        on_exit: zoneOnExit || undefined,
      },
      location: {
        name: zoneName.trim(),
        notes: zoneNotes.trim() || undefined,
        contactEmail: zoneContactEmail.trim() || undefined,
        contactPhone: zoneContactPhone.trim() || undefined,
        address: zoneAddress.trim() || undefined,
        onEnter: zoneOnEnter || undefined,
        onExit: zoneOnExit || undefined,
        latitude: Number.isFinite(centerLat) ? centerLat : undefined,
        longitude: Number.isFinite(centerLng) ? centerLng : undefined,
      },
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
  const locations = locationsQuery.data?.items ?? [];
  const polygonForCreate = drawnPolygon.length > 0 ? drawnPolygon : extractDrawnPolygons();
  const isCreateFormValid = zoneName.trim().length > 0 && polygonForCreate.length >= 3;
  const isMonitoringFormValid = Boolean(selectedGeofenceId) && selectedVehicles.length > 0;

  const startEditLocation = (item: LocationItem) => {
    const matchedGeofence = geofences.find(
      (g) => g.name.trim().toLowerCase() === (item.name ?? '').trim().toLowerCase()
    );

    setEditLocationId(item.id);
    setEditGeofenceId(matchedGeofence?.id ?? null);
    setEditLocationName(item.name ?? '');
    setEditLocationNotes(item.notes ?? '');
    setEditLocationEmail(item.contactEmail ?? '');
    setEditLocationPhone(item.contactPhone ?? '');
    setEditLocationAddress(item.address ?? '');
    setEditLocationOnEnter(item.onEnter ?? '');
    setEditLocationOnExit(item.onExit ?? '');
    setLocationActionError('');
    setLocationActionFeedback('');
  };

  const handleUpdateLocation = () => {
    if (!editLocationId) return;
    if (!editGeofenceId) {
      setLocationActionFeedback('');
      setLocationActionError('No matching geofence found for this row.');
      return;
    }
    if (!editLocationName.trim()) {
      setLocationActionFeedback('');
      setLocationActionError('Location name is required.');
      return;
    }

    updateLocationMutation.mutate({
      locationId: editLocationId,
      geofenceId: editGeofenceId,
      payload: {
        name: editLocationName.trim(),
        notes: editLocationNotes.trim() || undefined,
        contactEmail: editLocationEmail.trim() || undefined,
        contactPhone: editLocationPhone.trim() || undefined,
        address: editLocationAddress.trim() || undefined,
        onEnter: editLocationOnEnter.trim() || undefined,
        onExit: editLocationOnExit.trim() || undefined,
      },
    });
  };

  const handleDeleteLocation = (item: LocationItem) => {
    const matchedGeofence = geofences.find(
      (g) => g.name.trim().toLowerCase() === (item.name ?? '').trim().toLowerCase()
    );
    if (!matchedGeofence) {
      setLocationActionFeedback('');
      setLocationActionError('No matching geofence found for this row.');
      return;
    }

    if (!window.confirm(`Delete geofence and location "${item.name}" ?`)) return;
    deleteLocationMutation.mutate({ locationId: item.id, geofenceId: matchedGeofence.id });
  };

  return (
    <section>
      <h2>Geofences</h2>
      <p className="subtitle">Dessinez une zone sur la carte — une alerte in-app sera déclenchée automatiquement à chaque sortie de zone.</p>

      {editLocationId && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 20,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setEditLocationId(null);
              setEditGeofenceId(null);
              setLocationActionError('');
            }
          }}
        >
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 980, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>Update location</h3>
              <button className="btn-link" type="button" onClick={() => {
                setEditLocationId(null);
                setEditGeofenceId(null);
              }}>Close</button>
            </div>
            <div className="toolbar-row" style={{ marginBottom: 10 }}>
              <input className="toolbar-input" placeholder="Name" value={editLocationName} onChange={(e) => setEditLocationName(e.target.value)} />
              <input className="toolbar-input" placeholder="Notes" value={editLocationNotes} onChange={(e) => setEditLocationNotes(e.target.value)} />
              <input className="toolbar-input" placeholder="Contact email" value={editLocationEmail} onChange={(e) => setEditLocationEmail(e.target.value)} />
              <input className="toolbar-input" placeholder="Contact phone" value={editLocationPhone} onChange={(e) => setEditLocationPhone(e.target.value)} />
            </div>
            <div className="toolbar-row" style={{ marginBottom: 16 }}>
              <input className="toolbar-input" placeholder="Address" value={editLocationAddress} onChange={(e) => setEditLocationAddress(e.target.value)} />
              <select className="toolbar-input" value={editLocationOnEnter} onChange={(e) => setEditLocationOnEnter(e.target.value)}>
                <option value="">On enter alert level</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="critical">Critical</option>
              </select>
              <select className="toolbar-input" value={editLocationOnExit} onChange={(e) => setEditLocationOnExit(e.target.value)}>
                <option value="">On exit alert level</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            {locationActionError && <p className="form-error">{locationActionError}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn-secondary" type="button" onClick={() => {
                setEditLocationId(null);
                setEditGeofenceId(null);
              }}>Cancel</button>
              <button className="btn-primary" type="button" onClick={handleUpdateLocation} disabled={updateLocationMutation.isPending}>
                {updateLocationMutation.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                  setZoneNotes('');
                  setZoneContactEmail('');
                  setZoneContactPhone('');
                  setZoneAddress('');
                  setZoneOnEnter('');
                  setZoneOnExit('');
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
                    Name
                  </label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                    <input
                      className="toolbar-input"
                      placeholder="Name"
                      value={zoneName}
                      onChange={(e) => setZoneName(e.target.value)}
                      style={{ flex: 1 }}
                    />
                  </div>
                  <div className="toolbar-row" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                    <input
                      className="toolbar-input"
                      placeholder="Notes"
                      value={zoneNotes}
                      onChange={(e) => setZoneNotes(e.target.value)}
                      style={{ flex: '1 1 220px' }}
                    />
                    <input
                      className="toolbar-input"
                      placeholder="Contact email"
                      value={zoneContactEmail}
                      onChange={(e) => setZoneContactEmail(e.target.value)}
                      style={{ flex: '1 1 220px' }}
                    />
                    <input
                      className="toolbar-input"
                      placeholder="Contact phone"
                      value={zoneContactPhone}
                      onChange={(e) => setZoneContactPhone(e.target.value)}
                      style={{ flex: '1 1 220px' }}
                    />
                  </div>
                  <div className="toolbar-row" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                    <input
                      className="toolbar-input"
                      placeholder="Address"
                      value={zoneAddress}
                      onChange={(e) => setZoneAddress(e.target.value)}
                      style={{ flex: '2 1 280px' }}
                    />
                    <select className="toolbar-input" value={zoneOnEnter} onChange={(e) => setZoneOnEnter(e.target.value)} style={{ flex: '1 1 180px' }}>
                      <option value="">On enter alert level</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="critical">Critical</option>
                    </select>
                    <select className="toolbar-input" value={zoneOnExit} onChange={(e) => setZoneOnExit(e.target.value)} style={{ flex: '1 1 180px' }}>
                      <option value="">On exit alert level</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
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
                  setZoneNotes('');
                  setZoneContactEmail('');
                  setZoneContactPhone('');
                  setZoneAddress('');
                  setZoneOnEnter('');
                  setZoneOnExit('');
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

      <div className="panel table-shell">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div />
          <button
            className="btn-link"
            type="button"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['locations', 'geofences-page'] })}
          >
            Refresh
          </button>
        </div>

        {locationActionError && <p className="form-error">{locationActionError}</p>}

        <table className="vehicles-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Notes</th>
              <th>Contact Email</th>
              <th>Contact Phone</th>
              <th>Address</th>
              <th>On Enter</th>
              <th>On Exit</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {locations.length === 0 && (
              <tr>
                <td colSpan={8} className="empty-cell">No locations to display</td>
              </tr>
            )}
            {locations.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.notes ?? '-'}</td>
                <td>{item.contactEmail ?? '-'}</td>
                <td>{item.contactPhone ?? '-'}</td>
                <td>{item.address ?? (item.latitude != null && item.longitude != null ? `${item.latitude}, ${item.longitude}` : '-')}</td>
                <td>{item.onEnter ?? '-'}</td>
                <td>{item.onExit ?? '-'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn-link" type="button" onClick={() => startEditLocation(item)}>Update</button>
                  <button
                    className="btn-link"
                    type="button"
                    style={{ color: 'var(--danger, #dc3545)', marginLeft: 8 }}
                    onClick={() => handleDeleteLocation(item)}
                    disabled={deleteLocationMutation.isPending}
                  >
                    {deleteLocationMutation.isPending ? 'Deleting...' : 'Delete'}
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
