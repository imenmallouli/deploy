import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { createVehicle, deleteVehicle, listVehicles, updateVehicle } from '../lib/api/endpoints';

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

  const vehiclesQuery = useQuery({ queryKey: ['vehicles'], queryFn: listVehicles });

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

  useEffect(() => {
    if (vehicles.length === 0) {
      setSelectedVehicleId(null);
      setHasManualSelection(false);
      return;
    }
    // Keep detail navigation usable by default with first vehicle selected.
    setSelectedVehicleId((current) => (current && vehicles.some((v) => v.id === current) ? current : vehicles[0].id));
  }, [vehicles]);

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
                  <div className="fleet-vehicle-meta">{vehicle.license_plate} • VIN {vehicle.vin.slice(-6)}</div>
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
      </div>
    </section>
  );
}
