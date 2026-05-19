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
import { useI18n } from '../lib/i18n';

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
  const { locale } = useI18n();
  const text = locale === 'fr'
    ? {
        title: 'Geofences',
        subtitle: 'Dessinez une zone sur la carte - une alerte in-app sera declenchee automatiquement a chaque sortie de zone.',
        operationFailed: 'Operation echouee. Veuillez reessayer.',
        geolocDenied: 'Permission refusee. Veuillez autoriser la localisation dans les parametres du navigateur.',
        geolocUnsupported: 'Geolocalisation non supportee par votre navigateur.',
        geolocUnsupportedBrowser: 'La geolocalisation n\'est pas prise en charge par ce navigateur.',
        mapLoading: 'La carte est en cours de chargement. Reessayez dans un instant.',
        geolocUnavailable: 'Impossible de recuperer votre position. Verifiez le GPS/permissions puis reessayez.',
        geolocDeniedShort: 'Permission refusee. Activez la localisation pour ce site dans les parametres du navigateur.',
        geolocUnavailableShort: 'Impossible de recuperer votre position.',
        selectGeofence: 'Selectionnez une geocloture.',
        selectVehicles: 'Selectionnez au moins un vehicule.',
        vehicleLabel: 'Vehicule',
        myLocation: 'Ma localisation',
        locating: 'Localisation...',
        accuracy: 'Precision',
        deleteGeofence: 'Supprimer',
        thisGeofence: 'cette geocloture',
        geofenceCreated: 'Geocloture creee avec succes.',
        monitoringSaved: 'Monitoring sauvegarde avec succes.',
        geofenceDeleted: 'Geocloture supprimee avec succes.',
        geofenceLocationUpdated: 'Geocloture et localisation mises a jour avec succes.',
        geofenceLocationDeleted: 'Geocloture et localisation supprimees avec succes.',
        zoneNameRequired: 'Le nom de la zone est requis.',
        drawZoneRequired: 'Dessinez une zone (carre/polygone) sur la carte.',
        noMatchingGeofence: 'Aucune geocloture correspondante trouvee pour cette ligne.',
        locationNameRequired: 'Le nom du lieu est requis.',
        confirmDeleteBoth: 'Supprimer la geocloture et la localisation',
        updateLocation: 'Modifier le lieu',
        close: 'Fermer',
        cancel: 'Annuler',
        save: 'Enregistrer',
        saving: 'Enregistrement...',
        map: 'Carte',
        newGeofence: 'Nouvelle geocloture',
        createGeofence: 'Creer une geocloture',
        createAZone: 'Creer une geocloture',
        drawZone: 'Dessinez votre zone',
        name: 'Nom',
        notes: 'Notes',
        contactEmail: 'Email de contact',
        contactPhone: 'Telephone de contact',
        address: 'Adresse',
        onEnterAlertLevel: 'Niveau alerte entree',
        onExitAlertLevel: 'Niveau alerte sortie',
        low: 'Faible',
        medium: 'Moyen',
        critical: 'Critique',
        createZone: 'Creer la zone',
        creating: 'Creation...',
        createHint: 'Saisissez le nom et dessinez la zone avant de creer.',
        createHintTitle: 'Saisissez le nom + dessinez la zone d\'abord',
        monitoringTitle: 'Monitoring - alertes in-app',
        selectGeofencePlaceholder: 'Selectionnez une geocloture...',
        monitoringEnable: 'Activer monitoring',
        deleting: 'Suppression...',
        deleteSelectedArea: 'Supprimer la zone selectionnee',
        selectGeofenceFirst: 'Selectionnez une geocloture d\'abord',
        selectGeofenceDeleteHint: 'Selectionnez une geocloture a supprimer',
        monitoringHint: 'Selectionnez une zone pour activer le monitoring. Les alertes in-app sont declenchees automatiquement a chaque sortie de zone.',
        monitoredVehicles: 'Vehicules surveilles',
        notAvailable: 'N/A',
        actions: 'Actions',
        onEnter: 'A l\'entree',
        onExit: 'A la sortie',
        noLocations: 'Aucun lieu a afficher',
        update: 'Modifier',
        delete: 'Supprimer',
      }
    : {
        title: 'Geofences',
        subtitle: 'Draw a zone on the map - an in-app alert will be triggered automatically when a vehicle exits the zone.',
        operationFailed: 'Operation failed. Please try again.',
        geolocDenied: 'Permission denied. Please allow location access in browser settings.',
        geolocUnsupported: 'Geolocation is not supported by your browser.',
        geolocUnsupportedBrowser: 'Geolocation is not supported by this browser.',
        mapLoading: 'Map is still loading. Please try again in a second.',
        geolocUnavailable: 'Unable to retrieve your location. Check GPS/permissions and try again.',
        geolocDeniedShort: 'Permission denied. Enable location for this site in browser settings.',
        geolocUnavailableShort: 'Unable to retrieve your location.',
        selectGeofence: 'Select a geofence.',
        selectVehicles: 'Select at least one vehicle.',
        vehicleLabel: 'Vehicle',
        myLocation: 'My location',
        locating: 'Locating...',
        accuracy: 'Accuracy',
        deleteGeofence: 'Delete',
        thisGeofence: 'this geofence',
        geofenceCreated: 'Geofence created successfully.',
        monitoringSaved: 'Monitoring saved successfully.',
        geofenceDeleted: 'Geofence deleted successfully.',
        geofenceLocationUpdated: 'Geofence and location updated successfully.',
        geofenceLocationDeleted: 'Geofence and location deleted successfully.',
        zoneNameRequired: 'Zone name is required.',
        drawZoneRequired: 'Draw a zone (square/polygon) on the map.',
        noMatchingGeofence: 'No matching geofence found for this row.',
        locationNameRequired: 'Location name is required.',
        confirmDeleteBoth: 'Delete geofence and location',
        updateLocation: 'Update location',
        close: 'Close',
        cancel: 'Cancel',
        save: 'Save',
        saving: 'Saving...',
        map: 'Map',
        newGeofence: 'New Geofence',
        createGeofence: 'Create Geofence',
        createAZone: 'Create a geofence',
        drawZone: 'Draw your zone',
        name: 'Name',
        notes: 'Notes',
        contactEmail: 'Contact email',
        contactPhone: 'Contact phone',
        address: 'Address',
        onEnterAlertLevel: 'On enter alert level',
        onExitAlertLevel: 'On exit alert level',
        low: 'Low',
        medium: 'Medium',
        critical: 'Critical',
        createZone: 'Create Zone',
        creating: 'Creating...',
        createHint: 'Enter the name and draw the zone before creating.',
        createHintTitle: 'Enter the name + draw the zone first',
        monitoringTitle: 'Monitoring - in-app alerts',
        selectGeofencePlaceholder: 'Select a geofence...',
        monitoringEnable: 'Enable monitoring',
        deleting: 'Deleting...',
        deleteSelectedArea: 'Delete selected area',
        selectGeofenceFirst: 'Select a geofence first',
        selectGeofenceDeleteHint: 'Select a geofence to delete',
        monitoringHint: 'Select a zone to enable monitoring. In-app alerts are automatically triggered each time a vehicle exits the zone.',
        monitoredVehicles: 'Monitored vehicles',
        notAvailable: 'N/A',
        actions: 'Actions',
        onEnter: 'On Enter',
        onExit: 'On Exit',
        noLocations: 'No locations to display',
        update: 'Update',
        delete: 'Delete',
      };
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
            }).bindPopup(text.myLocation).addTo(map);
          }
        },
        (error) => {
          console.error('Geolocation error:', error.message);
          if (error.code === 1) {
            alert(text.geolocDenied);
          }
        },
        geoOptions
      );
    } else {
      alert(text.geolocUnsupported);
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
          .bindPopup(`<strong>${locale === 'fr' ? 'Vehicule' : 'Vehicle'} ${p.vehicle_id}${plateLabel}</strong><br/>${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`)
        .addTo(vehicleLayer);
    });
        }, [vehiclePositionsQuery.data, vehiclesQuery.data, locale]);

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
      setCreateFeedback(text.geofenceCreated);
      queryClient.invalidateQueries({ queryKey: ['geofences'] });
      queryClient.invalidateQueries({ queryKey: ['locations', 'geofences-page'] });
      setTimeout(() => setCreateFeedback(''), 3000);
    },
    onError: (error) => {
      setCreateFeedback('');
      setCreateError(getErrorMessage(error, text.operationFailed));
    },
  });

  const setupMutation = useMutation({
    mutationFn: setupGeofenceMonitoring,
    onSuccess: () => {
      setSelectedVehicles([]);
      setSetupError('');
      setSetupFeedback(text.monitoringSaved);
      setTimeout(() => setSetupFeedback(''), 3000);
    },
    onError: (error) => {
      setSetupFeedback('');
      setSetupError(getErrorMessage(error, text.operationFailed));
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
      setLocationActionFeedback(text.geofenceLocationUpdated);
      queryClient.invalidateQueries({ queryKey: ['geofences'] });
      queryClient.invalidateQueries({ queryKey: ['locations', 'geofences-page'] });
    },
    onError: (error) => {
      setLocationActionFeedback('');
      setLocationActionError(getErrorMessage(error, text.operationFailed));
    },
  });

  const deleteLocationMutation = useMutation({
    mutationFn: async ({ locationId, geofenceId }: { locationId: string; geofenceId: string }) => {
      await deleteGeofence(geofenceId);
      return deleteLocation(locationId);
    },
    onSuccess: () => {
      setLocationActionError('');
      setLocationActionFeedback(text.geofenceLocationDeleted);
      queryClient.invalidateQueries({ queryKey: ['geofences'] });
      queryClient.invalidateQueries({ queryKey: ['locations', 'geofences-page'] });
    },
    onError: (error) => {
      setLocationActionFeedback('');
      setLocationActionError(getErrorMessage(error, text.operationFailed));
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
      setCreateError(text.zoneNameRequired);
      return;
    }
    if (polygon.length < 3) {
      setCreateError(text.drawZoneRequired);
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
      alert(text.geolocUnsupportedBrowser);
      return;
    }
    if (!map) {
      alert(text.mapLoading);
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

      markerRef.current.bindPopup(`${popupLabel}<br/>${text.accuracy}: ~${Math.round(pos.coords.accuracy)}m`);
      setLoading(false);
    };

    const fallbackLocate = () => {
      navigator.geolocation.getCurrentPosition(
        applyPosition,
        () => {
          alert(text.geolocUnavailable);
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
          alert(text.geolocDeniedShort);
        } else {
          alert(text.geolocUnavailableShort);
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
      setSetupError(text.selectGeofence);
      return;
    }
    if (selectedVehicles.length === 0) {
      setSetupError(text.selectVehicles);
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
    const zoneLabel = selectedGeofence?.name ?? text.thisGeofence;

    if (!window.confirm(`${text.deleteGeofence} ${zoneLabel} ?`)) return;

    deleteMutation.mutate(selectedGeofenceId, {
      onSuccess: () => {
        setSelectedGeofenceId('');
        setSelectedVehicles([]);
        setSetupError('');
        setSetupFeedback(text.geofenceDeleted);
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

  const formatAlertLevel = (value?: string) => {
    if (!value) return '-';
    const normalized = value.toLowerCase();
    if (normalized === 'low') return text.low;
    if (normalized === 'medium') return text.medium;
    if (normalized === 'critical') return text.critical;
    return value;
  };

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
      setLocationActionError(text.noMatchingGeofence);
      return;
    }
    if (!editLocationName.trim()) {
      setLocationActionFeedback('');
      setLocationActionError(text.locationNameRequired);
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
      setLocationActionError(text.noMatchingGeofence);
      return;
    }

    if (!window.confirm(`${text.confirmDeleteBoth} "${item.name}" ?`)) return;
    deleteLocationMutation.mutate({ locationId: item.id, geofenceId: matchedGeofence.id });
  };

  return (
    <section>
      <h2>{text.title}</h2>
      <p className="subtitle">{text.subtitle}</p>

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
              <h3 style={{ margin: 0 }}>{text.updateLocation}</h3>
              <button className="btn-link" type="button" onClick={() => {
                setEditLocationId(null);
                setEditGeofenceId(null);
              }}>{text.close}</button>
            </div>
            <div className="toolbar-row" style={{ marginBottom: 10 }}>
              <input className="toolbar-input" placeholder={text.name} value={editLocationName} onChange={(e) => setEditLocationName(e.target.value)} />
              <input className="toolbar-input" placeholder={text.notes} value={editLocationNotes} onChange={(e) => setEditLocationNotes(e.target.value)} />
              <input className="toolbar-input" placeholder={text.contactEmail} value={editLocationEmail} onChange={(e) => setEditLocationEmail(e.target.value)} />
              <input className="toolbar-input" placeholder={text.contactPhone} value={editLocationPhone} onChange={(e) => setEditLocationPhone(e.target.value)} />
            </div>
            <div className="toolbar-row" style={{ marginBottom: 16 }}>
              <input className="toolbar-input" placeholder={text.address} value={editLocationAddress} onChange={(e) => setEditLocationAddress(e.target.value)} />
              <select className="toolbar-input" value={editLocationOnEnter} onChange={(e) => setEditLocationOnEnter(e.target.value)}>
                <option value="">{text.onEnterAlertLevel}</option>
                <option value="low">{text.low}</option>
                <option value="medium">{text.medium}</option>
                <option value="critical">{text.critical}</option>
              </select>
              <select className="toolbar-input" value={editLocationOnExit} onChange={(e) => setEditLocationOnExit(e.target.value)}>
                <option value="">{text.onExitAlertLevel}</option>
                <option value="low">{text.low}</option>
                <option value="medium">{text.medium}</option>
                <option value="critical">{text.critical}</option>
              </select>
            </div>
            {locationActionError && <p className="form-error">{locationActionError}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn-secondary" type="button" onClick={() => {
                setEditLocationId(null);
                setEditGeofenceId(null);
              }}>{text.cancel}</button>
              <button className="btn-primary" type="button" onClick={handleUpdateLocation} disabled={updateLocationMutation.isPending}>
                {updateLocationMutation.isPending ? text.saving : text.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN PAGE MAP */}
      <div className="panel table-shell" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3>{text.map}</h3>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn-secondary" onClick={() => setShowCreateModal(true)}>
              ➕ {text.newGeofence}
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                centerToCurrentLocation(mapRef.current, userMarkerRef, text.myLocation, setIsLocatingMain);
              }}
              disabled={isLocatingMain}
            >
              {isLocatingMain ? text.locating : `📍 ${text.myLocation}`}
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
              <h3 style={{ margin: 0 }}>{text.createGeofence}</h3>
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
{text.createAZone}</h3>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 500, fontSize: 14 }}>
                  {text.drawZone}
                </label>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      centerToCurrentLocation(modalMapRef.current, modalUserMarkerRef, text.myLocation, setIsLocatingModal);
                    }}
                    disabled={isLocatingModal}
                    style={{ fontSize: 12, padding: '6px 12px' }}
                  >
                    {isLocatingModal ? text.locating : `📍 ${text.myLocation}`}
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
                    {text.name}
                  </label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                    <input
                      className="toolbar-input"
                      placeholder={text.name}
                      value={zoneName}
                      onChange={(e) => setZoneName(e.target.value)}
                      style={{ flex: 1 }}
                    />
                  </div>
                  <div className="toolbar-row" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                    <input
                      className="toolbar-input"
                      placeholder={text.notes}
                      value={zoneNotes}
                      onChange={(e) => setZoneNotes(e.target.value)}
                      style={{ flex: '1 1 220px' }}
                    />
                    <input
                      className="toolbar-input"
                      placeholder={text.contactEmail}
                      value={zoneContactEmail}
                      onChange={(e) => setZoneContactEmail(e.target.value)}
                      style={{ flex: '1 1 220px' }}
                    />
                    <input
                      className="toolbar-input"
                      placeholder={text.contactPhone}
                      value={zoneContactPhone}
                      onChange={(e) => setZoneContactPhone(e.target.value)}
                      style={{ flex: '1 1 220px' }}
                    />
                  </div>
                  <div className="toolbar-row" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                    <input
                      className="toolbar-input"
                      placeholder={text.address}
                      value={zoneAddress}
                      onChange={(e) => setZoneAddress(e.target.value)}
                      style={{ flex: '2 1 280px' }}
                    />
                    <select className="toolbar-input" value={zoneOnEnter} onChange={(e) => setZoneOnEnter(e.target.value)} style={{ flex: '1 1 180px' }}>
                      <option value="">{text.onEnterAlertLevel}</option>
                      <option value="low">{text.low}</option>
                      <option value="medium">{text.medium}</option>
                      <option value="critical">{text.critical}</option>
                    </select>
                    <select className="toolbar-input" value={zoneOnExit} onChange={(e) => setZoneOnExit(e.target.value)} style={{ flex: '1 1 180px' }}>
                      <option value="">{text.onExitAlertLevel}</option>
                      <option value="low">{text.low}</option>
                      <option value="medium">{text.medium}</option>
                      <option value="critical">{text.critical}</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                    <button
                      className="btn-primary"
                      onClick={handleCreateGeofence}
                      disabled={createMutation.isPending || !isCreateFormValid}
                      title={!isCreateFormValid ? text.createHintTitle : undefined}
                      style={{ minWidth: 140, width: 'auto' }}
                    >
                      {createMutation.isPending ? text.creating : text.createZone}
                    </button>
                  </div>
                </div>

                {!isCreateFormValid && (
                  <p className="muted-note" style={{ marginTop: 0, marginBottom: 10 }}>
                    {text.createHint}
                  </p>
                )}

                {createError && <p className="form-error" style={{ marginBottom: 12 }}>{createError}</p>}
              </div>
              {createFeedback && <p className="muted-note" style={{ marginTop: 12, marginBottom: 0 }}>{createFeedback}</p>}
            </div>

            {/* SECTION 2: MONITORING */}
            <div style={{ marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid #eee' }}>
              <h3 style={{ marginTop: 0, marginBottom: 12 }}>{text.monitoringTitle}</h3>
              <div className="toolbar-row" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                <select
                  className="toolbar-input"
                  value={selectedGeofenceId}
                  onChange={(e) => setSelectedGeofenceId(e.target.value)}
                  style={{ flex: '1 1 220px' }}
                >
                  <option value="">{text.selectGeofencePlaceholder}</option>
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
                  title={!selectedGeofenceId ? text.selectGeofenceFirst : undefined}
                >
                  {setupMutation.isPending ? text.saving : text.monitoringEnable}
                </button>
                <button
                  className="btn-link"
                  onClick={handleDeleteSelectedGeofence}
                  disabled={!selectedGeofenceId || deleteMutation.isPending}
                  style={{ color: 'var(--danger, #dc3545)' }}
                  title={!selectedGeofenceId ? text.selectGeofenceDeleteHint : undefined}
                >
                  {deleteMutation.isPending ? text.deleting : text.deleteSelectedArea}
                </button>
              </div>

              {!selectedGeofenceId && (
                <p className="muted-note" style={{ marginTop: 0, marginBottom: 10 }}>
                 {text.monitoringHint}
                </p>
              )}

              {selectedGeofenceId && (
                <div style={{ marginBottom: 12, padding: 12, background: '#f7f7f7', borderRadius: 6 }}>
                  <strong>{text.monitoredVehicles}:</strong>
                  <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', marginTop: 8 }}>
                    {vehicles.map((v) => (
                      <label key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                        <input
                          type="checkbox"
                          checked={selectedVehicles.includes(v.id)}
                          onChange={() => toggleVehicleSelection(v.id)}
                        />
                        <span>{text.vehicleLabel} {v.id} - {v.license_plate || text.notAvailable}</span>
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
                {text.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {createFeedback && <p className="muted-note" style={{ marginBottom: 16 }}>{createFeedback}</p>}

      <div className="panel table-shell">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div />
        </div>

        {locationActionError && <p className="form-error">{locationActionError}</p>}

        <table className="vehicles-table">
          <thead>
            <tr>
              <th>{text.name}</th>
              <th>{text.notes}</th>
              <th>{text.contactEmail}</th>
              <th>{text.contactPhone}</th>
              <th>{text.address}</th>
              <th>{text.onEnter}</th>
              <th>{text.onExit}</th>
              <th>{text.actions}</th>
            </tr>
          </thead>
          <tbody>
            {locations.length === 0 && (
              <tr>
                <td colSpan={8} className="empty-cell">{text.noLocations}</td>
              </tr>
            )}
            {locations.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.notes ?? '-'}</td>
                <td>{item.contactEmail ?? '-'}</td>
                <td>{item.contactPhone ?? '-'}</td>
                <td>{item.address ?? (item.latitude != null && item.longitude != null ? `${item.latitude}, ${item.longitude}` : '-')}</td>
                <td>{formatAlertLevel(item.onEnter)}</td>
                <td>{formatAlertLevel(item.onExit)}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn-link" type="button" onClick={() => startEditLocation(item)}>{text.update}</button>
                  <button
                    className="btn-link"
                    type="button"
                    style={{ color: 'var(--danger, #dc3545)', marginLeft: 8 }}
                    onClick={() => handleDeleteLocation(item)}
                    disabled={deleteLocationMutation.isPending}
                  >
                    {deleteLocationMutation.isPending ? text.deleting : text.delete}
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
