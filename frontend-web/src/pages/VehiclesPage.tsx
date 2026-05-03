import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { createVehicle, deleteVehicle, listAlertsByVehicle, listIotLogs, listVehicles, updateVehicle } from '../lib/api/endpoints';

type IotLogItem = {
  event_type?: string;
  event_at?: string;
  created_at?: string;
  metadata?: Record<string, unknown>;
};

type RoutePoint = {
  lat: number;
  lng: number;
  at: string;
};

function extractRoutePoint(log: IotLogItem): RoutePoint | null {
  const metadata = log.metadata ?? {};
  const loc = (metadata.loc ?? {}) as Record<string, unknown>;
  const rawLat = loc.lat ?? metadata.lat;
  const rawLng = loc.lon ?? metadata.lon ?? metadata.lng;
  const at = String(log.event_at ?? log.created_at ?? '');

  const lat = Number(rawLat);
  const lng = Number(rawLng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || at.length === 0) {
    return null;
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }

  return { lat, lng, at };
}

function formatMileage(value: number) {
  return new Intl.NumberFormat('fr-FR').format(value);
}

function getVehicleStatusMeta(status: string) {
  switch (status) {
    case 'healthy':
      return { label: 'Active', className: 'fleet-status active' };
    case 'warning':
      return { label: 'Maintenance', className: 'fleet-status maintenance' };
    case 'critical':
      return { label: 'Critical', className: 'fleet-status critical' };
    default:
      return { label: 'Pending', className: 'fleet-status pending' };
  }
}

function getVehicleEmoji(make: string, model: string) {
  const signature = `${make} ${model}`.toLowerCase();
  if (signature.includes('master') || signature.includes('van') || signature.includes('utilitaire')) return '🚚';
  if (signature.includes('tucson') || signature.includes('suv') || signature.includes('sportage')) return '🚙';
  return '🚗';
}

export function VehiclesPage() {
  const queryClient = useQueryClient();
  const routeMapRef = useRef<L.Map | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const routeMapContainerRef = useRef<HTMLDivElement | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [createVin, setCreateVin] = useState('');
  const [createLicensePlate, setCreateLicensePlate] = useState('');
  const [createMake, setCreateMake] = useState('');
  const [createModel, setCreateModel] = useState('');
  const [createYear, setCreateYear] = useState('');
  const [createMileage, setCreateMileage] = useState('');
  const [createDongleId, setCreateDongleId] = useState('');
  const [updateVin, setUpdateVin] = useState('');
  const [updateLicensePlate, setUpdateLicensePlate] = useState('');
  const [updateMake, setUpdateMake] = useState('');
  const [updateModel, setUpdateModel] = useState('');
  const [updateYear, setUpdateYear] = useState('');
  const [updateMileage, setUpdateMileage] = useState('');
  const [updateDongleId, setUpdateDongleId] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [hasManualSelection, setHasManualSelection] = useState(false);

  const vehiclesQuery = useQuery({
    queryKey: ['vehicles'],
    queryFn: listVehicles,
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  });
  const vehicleAlertsQuery = useQuery({
    queryKey: ['vehicle-alerts', selectedVehicleId],
    queryFn: () => listAlertsByVehicle(selectedVehicleId as number),
    enabled: selectedVehicleId !== null,
  });
  const gpsRouteQuery = useQuery({
    queryKey: ['vehicle-gps-route', selectedVehicleId],
    queryFn: () =>
      listIotLogs({
        vehicle_id: selectedVehicleId as number,
        limit: 500,
      }),
    enabled: selectedVehicleId !== null,
    refetchInterval: 10000,
    refetchIntervalInBackground: true,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: Parameters<typeof createVehicle>[0]) => {
      const response = await createVehicle(payload);
      if (response.status !== 'success') {
        throw new Error(response.message || 'Failed to create vehicle');
      }
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      setIsCreateModalOpen(false);
      setCreateVin('');
      setCreateLicensePlate('');
      setCreateMake('');
      setCreateModel('');
      setCreateYear('');
      setCreateMileage('');
      setCreateDongleId('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteVehicle,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vehicles'] }),
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: { vehicleId: number; data: Parameters<typeof updateVehicle>[1] }) => {
      const response = await updateVehicle(payload.vehicleId, payload.data);
      if (response.status !== 'success') {
        throw new Error(response.message || 'Failed to update vehicle');
      }
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      setIsUpdateModalOpen(false);
      setUpdateVin('');
      setUpdateLicensePlate('');
      setUpdateMake('');
      setUpdateModel('');
      setUpdateYear('');
      setUpdateMileage('');
      setUpdateDongleId('');
    },
  });

  const vehicles = vehiclesQuery.data?.items ?? [];
  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId) ?? null;
  const activeAlertCount = vehicleAlertsQuery.data?.pending ?? 0;
  const latestVehicleAlert = vehicleAlertsQuery.data?.alerts?.[0] ?? null;
  const gpsRoutePoints = useMemo(() => {
    const logs = ((gpsRouteQuery.data as { items?: IotLogItem[] } | undefined)?.items ?? []).filter(
      (item) => (item.event_type ?? '').toLowerCase() === 'gps'
    );
    const points = logs
      .map(extractRoutePoint)
      .filter((point): point is RoutePoint => point !== null)
      .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

    // Keep order stable while removing exact duplicates sent by the device.
    const unique: RoutePoint[] = [];
    let previousKey = '';
    for (const point of points) {
      const key = `${point.lat.toFixed(6)}:${point.lng.toFixed(6)}:${point.at}`;
      if (key === previousKey) {
        continue;
      }
      unique.push(point);
      previousKey = key;
    }
    return unique;
  }, [gpsRouteQuery.data]);

  useEffect(() => {
    if (vehicles.length === 0) {
      setSelectedVehicleId(null);
      setHasManualSelection(false);
      return;
    }
    // Keep detail navigation usable by default with first vehicle selected.
    setSelectedVehicleId((current) => (current && vehicles.some((v) => v.id === current) ? current : vehicles[0].id));
  }, [vehicles]);

  useEffect(() => {
    if (!routeMapContainerRef.current || routeMapRef.current) {
      return;
    }

    const map = L.map(routeMapContainerRef.current).setView([35.8256, 10.6084], 12);
    routeMapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const routeLayer = L.layerGroup().addTo(map);
    routeLayerRef.current = routeLayer;

    return () => {
      map.remove();
      routeMapRef.current = null;
      routeLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = routeMapRef.current;
    const routeLayer = routeLayerRef.current;
    if (!map || !routeLayer) {
      return;
    }

    routeLayer.clearLayers();

    if (gpsRoutePoints.length === 0) {
      return;
    }

    const latLngs = gpsRoutePoints.map((point) => [point.lat, point.lng] as [number, number]);
    L.polyline(latLngs, {
      color: '#0f5bd7',
      weight: 4,
      opacity: 0.9,
    }).addTo(routeLayer);

    const startPoint = gpsRoutePoints[0];
    const endPoint = gpsRoutePoints[gpsRoutePoints.length - 1];

    L.circleMarker([startPoint.lat, startPoint.lng], {
      radius: 6,
      color: '#15803d',
      fillColor: '#22c55e',
      fillOpacity: 0.95,
      weight: 2,
    })
      .bindPopup(`Start<br/>${new Date(startPoint.at).toLocaleString()}`)
      .addTo(routeLayer);

    L.circleMarker([endPoint.lat, endPoint.lng], {
      radius: 7,
      color: '#9a3412',
      fillColor: '#f97316',
      fillOpacity: 0.95,
      weight: 2,
    })
      .bindPopup(`Now<br/>${new Date(endPoint.at).toLocaleString()}`)
      .addTo(routeLayer);

    if (latLngs.length === 1) {
      map.setView(latLngs[0], 15);
    } else {
      map.fitBounds(L.latLngBounds(latLngs), { padding: [24, 24] });
    }
  }, [gpsRoutePoints, selectedVehicleId]);

  const onCreate: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    createMutation.mutate({
      vin: createVin,
      license_plate: createLicensePlate,
      make: createMake,
      model: createModel,
      year: Number(createYear),
      mileage: Number(createMileage),
      status: 'healthy',
      dongle_id: createDongleId.trim() === '' ? null : createDongleId,
    });
  };

  const onOpenUpdateModal = () => {
    const vehicle = vehicles.find((v) => v.id === selectedVehicleId);
    if (!vehicle) return;
    setUpdateMake(vehicle.make);
    setUpdateModel(vehicle.model);
    setUpdateYear(String(vehicle.year));
    setUpdateMileage(String(vehicle.mileage));
    setUpdateVin(vehicle.vin);
    setUpdateLicensePlate(vehicle.license_plate);
    setUpdateDongleId(vehicle.dongle_id || '');
    setIsUpdateModalOpen(true);
  };

  const onSelectUpdateVehicle = (vehicleId: number) => {
    setSelectedVehicleId(vehicleId);
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    if (!vehicle) return;
    setUpdateMake(vehicle.make);
    setUpdateModel(vehicle.model);
    setUpdateYear(String(vehicle.year));
    setUpdateMileage(String(vehicle.mileage));
    setUpdateVin(vehicle.vin);
    setUpdateLicensePlate(vehicle.license_plate);
    setUpdateDongleId(vehicle.dongle_id || '');
  };

  const onUpdate: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    if (!selectedVehicleId) return;
    updateMutation.mutate({
      vehicleId: selectedVehicleId,
      data: {
        make: updateMake,
        model: updateModel,
        year: Number(updateYear),
        mileage: Number(updateMileage),
        vin: updateVin,
        license_plate: updateLicensePlate,
        dongle_id: updateDongleId.trim() === '' ? null : updateDongleId,
      },
    });
  };

  return (
    <section className="vehicles-page-shell">
      <div className="vehicles-header-row">
        <div>
          <h2 className="vehicles-title">Vehicle Management</h2>
          <p className="vehicles-subtitle">
            {vehicles.length} vehicle{vehicles.length > 1 ? 's' : ''} registered
          </p>
        </div>
        <button className="vehicle-add-trigger" type="button" onClick={() => setIsCreateModalOpen(true)}>
          + Add vehicle
        </button>
      </div>

      {isUpdateModalOpen ? (
        <div className="vehicle-create-overlay" role="dialog" aria-modal="true" aria-label="Update vehicle">
          <form className="vehicle-create-modal" onSubmit={onUpdate}>
            <h3>Update vehicle</h3>
            <div className="vehicle-create-grid">
              <label className="vehicle-field vehicle-field-full">
                <span>Select vehicle</span>
                <select
                  value={selectedVehicleId ?? ''}
                  onChange={(e) => {
                    const nextId = Number(e.target.value);
                    if (!Number.isFinite(nextId)) return;
                    onSelectUpdateVehicle(nextId);
                  }}
                  required
                >
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.make} {vehicle.model} ({vehicle.license_plate})
                    </option>
                  ))}
                </select>
              </label>
              <label className="vehicle-field">
                <span>Make</span>
                <input placeholder="Toyota" value={updateMake} onChange={(e) => setUpdateMake(e.target.value)} required />
              </label>
              <label className="vehicle-field">
                <span>Model</span>
                <input placeholder="Corolla" value={updateModel} onChange={(e) => setUpdateModel(e.target.value)} required />
              </label>
              <label className="vehicle-field">
                <span>Year</span>
                <input type="number" placeholder="2022" value={updateYear} onChange={(e) => setUpdateYear(e.target.value)} required />
              </label>
              <label className="vehicle-field">
                <span>VIN</span>
                <input placeholder="VF1AAAAA123456789" value={updateVin} onChange={(e) => setUpdateVin(e.target.value)} required />
              </label>
              <label className="vehicle-field vehicle-field-full">
                <span>License plate</span>
                <input placeholder="TN 123 456" value={updateLicensePlate} onChange={(e) => setUpdateLicensePlate(e.target.value)} required />
              </label>
              <label className="vehicle-field">
                <span>Mileage</span>
                <input type="number" placeholder="45000" value={updateMileage} onChange={(e) => setUpdateMileage(e.target.value)} required />
              </label>
              <label className="vehicle-field">
                <span>Dongle ID (optional)</span>
                <input placeholder="dongle_001" value={updateDongleId} onChange={(e) => setUpdateDongleId(e.target.value)} />
              </label>
            </div>
            {updateMutation.isError ? <p className="error-text">{(updateMutation.error as Error).message}</p> : null}
            <div className="vehicle-modal-actions">
              <button className="btn-secondary" type="button" onClick={() => setIsUpdateModalOpen(false)}>
                Cancel
              </button>
              <button className="btn-primary" type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Updating...' : 'Update'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {isCreateModalOpen ? (
        <div className="vehicle-create-overlay" role="dialog" aria-modal="true" aria-label="Add vehicle">
          <form className="vehicle-create-modal" onSubmit={onCreate}>
            <h3>New vehicle</h3>
            <div className="vehicle-create-grid">
              <label className="vehicle-field">
                <span>Make</span>
                    <input placeholder="Toyota" value={createMake} onChange={(e) => setCreateMake(e.target.value)} required />
              </label>
              <label className="vehicle-field">
                <span>Model</span>
                    <input placeholder="Corolla" value={createModel} onChange={(e) => setCreateModel(e.target.value)} required />
              </label>
              <label className="vehicle-field">
                <span>Year</span>
                    <input type="number" placeholder="2022" value={createYear} onChange={(e) => setCreateYear(e.target.value)} required />
              </label>
              <label className="vehicle-field">
                <span>VIN</span>
                    <input placeholder="VF1AAAAA123456789" value={createVin} onChange={(e) => setCreateVin(e.target.value)} required />
              </label>
              <label className="vehicle-field vehicle-field-full">
                <span>License plate</span>
                    <input placeholder="TN 123 456" value={createLicensePlate} onChange={(e) => setCreateLicensePlate(e.target.value)} required />
              </label>
              <label className="vehicle-field">
                <span>Mileage</span>
                    <input type="number" placeholder="45000" value={createMileage} onChange={(e) => setCreateMileage(e.target.value)} required />
              </label>
              <label className="vehicle-field">
                <span>Dongle ID (optional)</span>
                    <input placeholder="dongle_001" value={createDongleId} onChange={(e) => setCreateDongleId(e.target.value)} />
              </label>
            </div>
            {createMutation.isError ? <p className="error-text">{(createMutation.error as Error).message}</p> : null}
            <div className="vehicle-modal-actions">
              <button className="btn-secondary" type="button" onClick={() => setIsCreateModalOpen(false)}>
                Cancel
              </button>
              <button className="btn-primary" type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="vehicles-content-layout">
        <div className="panel fleet-list-shell">
          <div className="fleet-list-header">
            <div className="fleet-list-heading">CURRENT FLEET</div>
            <div className="fleet-top-actions">
              <select
                className="toolbar-input"
                value={selectedVehicleId ?? ''}
                onChange={(e) => {
                  setHasManualSelection(true);
                  setSelectedVehicleId(e.target.value === '' ? null : Number(e.target.value));
                }}
                style={{ minWidth: 220 }}
              >
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.make} {vehicle.model} ({vehicle.license_plate})
                  </option>
                ))}
              </select>
              <button
                className="btn-primary"
                type="button"
                disabled={!selectedVehicleId || updateMutation.isPending}
                onClick={onOpenUpdateModal}
              >
                {updateMutation.isPending ? 'Updating...' : 'Update'}
              </button>
              <button
                className="btn-danger"
                type="button"
                disabled={!selectedVehicleId || !hasManualSelection || deleteMutation.isPending}
                onClick={() => {
                  if (!selectedVehicleId) return;
                  if (!window.confirm('Delete this vehicle?')) return;
                  deleteMutation.mutate(selectedVehicleId);
                }}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
          {vehiclesQuery.isLoading ? <p>Loading vehicles...</p> : null}
          {!vehiclesQuery.isLoading && vehicles.length === 0 ? <p className="empty-cell">No vehicles available.</p> : null}
          <div className="fleet-cards">
            {vehicles.map((vehicle) => {
              const statusMeta = getVehicleStatusMeta(vehicle.status);
              return (
                <article key={vehicle.id} className="fleet-vehicle-card">
                  <div className="fleet-vehicle-icon">{getVehicleEmoji(vehicle.make, vehicle.model)}</div>
                  <div className="fleet-vehicle-main">
                    <div className="fleet-vehicle-head">
                      <div className="fleet-vehicle-title">{vehicle.make} {vehicle.model} {vehicle.year}</div>
                    </div>
                    <div className="fleet-vehicle-meta">
                      #{vehicle.id} • {vehicle.license_plate} • VIN {vehicle.vin.slice(-6)}
                      {vehicle.dongle_id ? ` • Dongle ${vehicle.dongle_id}` : ''}
                    </div>
                  </div>
                  <div className="fleet-vehicle-side">
                    <span className={statusMeta.className}>{statusMeta.label}</span>
                    <span className="fleet-vehicle-mileage">{formatMileage(vehicle.mileage)} km</span>
                    <Link to={`/vehicles/${vehicle.id}`} className="fleet-view-details-btn">
                      View Details
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="vehicles-tracking-stats">
            <article className="vehicles-tracking-stat-card">
              <p className="vehicles-tracking-stat-label">Kilometrage</p>
              <p className="vehicles-tracking-stat-value">
                {selectedVehicle ? formatMileage(selectedVehicle.mileage) : '0'}
              </p>
              <p className="vehicles-tracking-stat-note">
                {selectedVehicle
                  ? `${selectedVehicle.make} ${selectedVehicle.model}${selectedVehicle.dongle_id ? ` · Dongle ${selectedVehicle.dongle_id}` : ''}`
                  : 'No vehicle selected'}
              </p>
            </article>
            <article className="vehicles-tracking-stat-card">
              <p className="vehicles-tracking-stat-label">Alertes actives</p>
              <p className="vehicles-tracking-stat-value">{activeAlertCount}</p>
              <p className="vehicles-tracking-stat-note">
                {latestVehicleAlert ? latestVehicleAlert.title : 'Aucune alerte active'}
              </p>
            </article>
          </div>
        </div>

        <aside className="panel fleet-tracking-panel vehicles-tracking-panel">
          <div className="panel-title-row">
            <h3>Fleet Tracking</h3>
            <span className="muted-note">{selectedVehicle ? selectedVehicle.license_plate : 'No vehicle selected'}</span>
          </div>
          <div ref={routeMapContainerRef} className="fleet-map" aria-label="Vehicle trip map" />
          <p className="vehicles-map-note">
            {gpsRoutePoints.length > 1
              ? `Route tracee avec ${gpsRoutePoints.length} points GPS du dongle.`
              : 'Trip routes will appear here once GPS points are available from the dongle.'}
          </p>
        </aside>
      </div>
    </section>
  );
}
