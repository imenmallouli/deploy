import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { deleteVehicle, getVehicle, updateVehicle } from '../lib/api/endpoints';

export function VehicleDetailsPage() {
  const { vehicleId } = useParams();
  const queryClient = useQueryClient();
  const id = Number(vehicleId);

  const vehicleQuery = useQuery({
    queryKey: ['vehicle', id],
    queryFn: () => getVehicle(id),
    enabled: Number.isFinite(id),
  });

  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [status, setStatus] = useState('pending');
  const [mileage, setMileage] = useState(0);

  useEffect(() => {
    const vehicle = vehicleQuery.data?.vehicle;
    if (vehicle) {
      setMake(vehicle.make ?? '');
      setModel(vehicle.model ?? '');
      setStatus(vehicle.status ?? 'pending');
      setMileage(vehicle.mileage ?? 0);
    }
  }, [vehicleQuery.data]);

  const updateMutation = useMutation({
    mutationFn: () => updateVehicle(id, { make, model, status, mileage }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle', id] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteVehicle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      window.location.href = '/vehicles';
    },
  });

  const vehicle = vehicleQuery.data?.vehicle;

  return (
    <section>
      <h2>Vehicle Details</h2>
      <p className="subtitle">Technical card and assignment data for vehicle #{vehicleId ?? '-'}</p>

      <div className="panel details-grid">
        <div>
          <h3>Identity</h3>
          <ul>
            <li>VIN: {vehicle?.vin ?? '-'}</li>
            <li>Plate: {vehicle?.license_plate ?? '-'}</li>
            <li>Make / Model: {vehicle?.make ?? '-'} {vehicle?.model ?? ''}</li>
            <li>Year: {vehicle?.year ?? '-'}</li>
          </ul>
        </div>
        <div>
          <h3>Assignment</h3>
          <ul>
            <li>Fleet ID: {vehicle?.fleet_id ?? '-'}</li>
            <li>Driver ID: {vehicle?.driver_id ?? '-'}</li>
            <li>Dongle ID: {vehicle?.dongle_id ?? '-'}</li>
          </ul>
        </div>
      </div>

      <form className="panel form-grid" onSubmit={(e) => { e.preventDefault(); updateMutation.mutate(); }}>
        <h3>Update vehicle</h3>
        <input placeholder="Make" value={make} onChange={(e) => setMake(e.target.value)} />
        <input placeholder="Model" value={model} onChange={(e) => setModel(e.target.value)} />
        <input type="number" placeholder="Mileage" value={mileage} onChange={(e) => setMileage(Number(e.target.value))} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="pending">pending</option>
          <option value="healthy">healthy</option>
          <option value="warning">warning</option>
          <option value="critical">critical</option>
        </select>
        <button type="submit" className="btn-primary" disabled={updateMutation.isPending}>
          {updateMutation.isPending ? 'Saving...' : 'PUT Update'}
        </button>
      </form>

      <div className="detail-actions">
        <button type="button" className="btn-danger" onClick={() => deleteMutation.mutate()}>
          DELETE Vehicle
        </button>
        <Link to={`/vehicle-status/${vehicleId ?? ''}`} className="btn-link">
          Go to Status
        </Link>
      </div>
    </section>
  );
}
