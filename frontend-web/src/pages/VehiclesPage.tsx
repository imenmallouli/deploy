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
  const [year, setYear] = useState('');
  const [mileage, setMileage] = useState('');
  const [status, setStatus] = useState('pending');

  const [dongleId, setDongleId] = useState('');

  const vehiclesQuery = useQuery({ queryKey: ['vehicles'], queryFn: listVehicles });

  const createMutation = useMutation({
    mutationFn: async (payload: Parameters<typeof createVehicle>[0]) => {
      const response = await createVehicle(payload);
      if (response.status !== 'success') {
        throw new Error(response.message || 'Échec de création du véhicule');
      }
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      setVin('');
      setLicensePlate('');
      setMake('');
      setModel('');
      setYear('');
      setMileage('');
      setStatus('pending');
      setDongleId('');
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
      year: Number(year),
      mileage: Number(mileage),
      status,
      dongle_id: dongleId.trim() === '' ? null : dongleId,
    });
  };

  return (
    <section>
      <h2>Vehicles</h2>
     <br></br>

      <form className="panel form-grid" onSubmit={onCreate}>
        <h3>Create Vehicle</h3>
        <input placeholder="VIN (17 caractères, ex: VF1AAAAA123456789)" value={vin} onChange={(e) => setVin(e.target.value)} required />
        <input placeholder="License plate (ex: 12345-A-1)" value={licensePlate} onChange={(e) => setLicensePlate(e.target.value)} required />
        <input placeholder="Make (ex: Renault)" value={make} onChange={(e) => setMake(e.target.value)} required />
        <input placeholder="Model (ex: Clio 5)" value={model} onChange={(e) => setModel(e.target.value)} required />
        <input type="number" placeholder="Year (ex: 2024)" value={year} onChange={(e) => setYear(e.target.value)} required />
        <input type="number" placeholder="Mileage in km (ex: 125000)" value={mileage} onChange={(e) => setMileage(e.target.value)} required />
        <input placeholder=" dongle ID (ex: dongle_001)" value={dongleId} onChange={(e) => setDongleId(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="pending">pending</option>
          <option value="healthy">healthy</option>
          <option value="warning">warning</option>
          <option value="critical">critical</option>
        </select>
        <button className="btn-primary" type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? 'Creating...' : 'Add Vehicle'}
        </button>
        {createMutation.isError ? <p className="error-text">{(createMutation.error as Error).message}</p> : null}
        {createMutation.isSuccess ? <p className="success-text">Véhicule ajouté avec succès.</p> : null}
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
