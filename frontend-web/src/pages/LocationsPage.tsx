import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { listGeofenceVehiclePositions, listVehicles } from '../lib/api/endpoints';
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
  const [latitudeInput, setLatitudeInput] = useState('');
  const [longitudeInput, setLongitudeInput] = useState('');
  const [locationError, setLocationError] = useState('');
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [myPosition, setMyPosition] = useState<{ latitude: number; longitude: number } | null>(null);

  const vehiclesQuery = useQuery({ queryKey: ['vehicles', 'locations-page'], queryFn: listVehicles });
  const positionsQuery = useQuery({
    queryKey: ['vehicle-positions', 'locations-page'],
    queryFn: listGeofenceVehiclePositions,
    refetchInterval: 15000,
  });

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
    queryClient.invalidateQueries({ queryKey: ['vehicles', 'locations-page'] });
    queryClient.invalidateQueries({ queryKey: ['vehicle-positions', 'locations-page'] });
  };

  return (
    <section>
      <h2>Locations</h2>

      <div className="panel map-panel locations-map-panel">
        <div className="panel-title-row">
          <h3>Locations map</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-link" type="button" onClick={handleUseMyLocation} disabled={isLocating}>
              {isLocating ? 'Locating...' : 'Use my location'}
            </button>
            <button className="btn-link" type="button" onClick={handleRefresh}>Refresh</button>
          </div>
        </div>
        <div className="locations-map-shell">
          <div title="Locations map" className="fleet-map locations-hero-map" ref={mapNodeRef} />
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

      {locationError && <p className="form-error">{locationError}</p>}
      {locationAccuracy !== null && (
        <p className="muted-note">📍 Location accuracy: ~{locationAccuracy}m {locationAccuracy > 100 ? '(WiFi/IP — limited accuracy on PC)' : '(good)'}</p>
      )}
    </section>
  );
}
