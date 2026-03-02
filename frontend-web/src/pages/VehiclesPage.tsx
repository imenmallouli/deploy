import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { createVehicle, deleteVehicle, listVehicles } from '../lib/api/endpoints';

export function VehiclesPage() {
  const queryClient = useQueryClient();
  const [vin, setVin] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState<number>(2024);
  const [status, setStatus] = useState('pending');

  const vehiclesQuery = useQuery({ queryKey: ['vehicles'], queryFn: listVehicles });

  const createMutation = useMutation({
    mutationFn: createVehicle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      setVin('');
      setLicensePlate('');
      setMake('');
      setModel('');
      setYear(2024);
      setStatus('pending');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteVehicle,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vehicles'] }),
  });

  const vehicles = vehiclesQuery.data?.items ?? [];

  const onCreate: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    createMutation.mutate({
      vin,
      license_plate: licensePlate,
      make,
      model,
      year,
      mileage: 0,
      status,
    });
  };

  return (
    <section>
      <h2>Vehicles</h2>
      <p className="subtitle">List, filter and inspect vehicle health and assignment data.</p>

      <form className="panel form-grid" onSubmit={onCreate}>
        <h3>Create Vehicle</h3>
        <input placeholder="VIN" value={vin} onChange={(e) => setVin(e.target.value)} required />
        <input placeholder="License plate" value={licensePlate} onChange={(e) => setLicensePlate(e.target.value)} required />
        <input placeholder="Make" value={make} onChange={(e) => setMake(e.target.value)} required />
        <input placeholder="Model" value={model} onChange={(e) => setModel(e.target.value)} required />
        <input type="number" placeholder="Year" value={year} onChange={(e) => setYear(Number(e.target.value))} required />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="pending">pending</option>
          <option value="healthy">healthy</option>
          <option value="warning">warning</option>
          <option value="critical">critical</option>
        </select>
        <button className="btn-primary" type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? 'Creating...' : 'Add Vehicle'}
        </button>
      </form>

      <div className="panel">
        {vehiclesQuery.isLoading ? <p>Loading vehicles...</p> : null}
        <table className="vehicles-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Plate</th>
              <th>Model</th>
              <th>Year</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((vehicle) => (
              <tr key={vehicle.id}>
                <td>{vehicle.id}</td>
                <td>{vehicle.license_plate}</td>
                <td>{vehicle.make} {vehicle.model}</td>
                <td>{vehicle.year}</td>
                <td>
                  <span className={`status-pill ${vehicle.status}`}>{vehicle.status}</span>
                </td>
                <td className="actions-cell">
                  <Link to={`/vehicles/${vehicle.id}`} className="inline-link">
                    Voir détail
                  </Link>
                  <Link to={`/vehicle-status/${vehicle.id}`} className="inline-link">
                    Voir status
                  </Link>
                  <button className="inline-danger" type="button" onClick={() => deleteMutation.mutate(vehicle.id)}>
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
