import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  assignVehicleToFleet,
  createFleet,
  deleteFleet,
  getFleet,
  listFleetVehicles,
  listFleets,
  updateFleet,
} from '../lib/api/endpoints';

export function FleetsPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editFleetId, setEditFleetId] = useState<number | null>(null);
  const [selectedFleetId, setSelectedFleetId] = useState<number | null>(null);
  const [vehicleToAssign, setVehicleToAssign] = useState<number>(1);

  const fleetsQuery = useQuery({ queryKey: ['fleets'], queryFn: listFleets });
  const fleetDetailsQuery = useQuery({
    queryKey: ['fleet', selectedFleetId],
    queryFn: () => getFleet(selectedFleetId as number),
    enabled: selectedFleetId !== null,
  });
  const fleetVehiclesQuery = useQuery({
    queryKey: ['fleetVehicles', selectedFleetId],
    queryFn: () => listFleetVehicles(selectedFleetId as number),
    enabled: selectedFleetId !== null,
  });

  const createMutation = useMutation({
    mutationFn: createFleet,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fleets'] });
      setName('');
      setDescription('');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: { name: string; description?: string } }) => updateFleet(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fleets'] });
      setEditFleetId(null);
      setName('');
      setDescription('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFleet,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fleets'] });
      queryClient.invalidateQueries({ queryKey: ['fleetVehicles'] });
      if (selectedFleetId) {
        queryClient.invalidateQueries({ queryKey: ['fleet', selectedFleetId] });
      }
    },
  });

  const assignMutation = useMutation({
    mutationFn: ({ fleetId, vehicleId }: { fleetId: number; vehicleId: number }) =>
      assignVehicleToFleet(fleetId, { vehicle_id: vehicleId }),
    onSuccess: () => {
      if (selectedFleetId) {
        queryClient.invalidateQueries({ queryKey: ['fleetVehicles', selectedFleetId] });
      }
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    },
  });

  const fleets = fleetsQuery.data?.items ?? [];

  return (
    <section>
      <h2>Fleets</h2>
      <p className="subtitle">Overview of fleet-level operations.</p>
      <form className="panel form-grid" onSubmit={(e) => {
        e.preventDefault();
        if (editFleetId) {
          updateMutation.mutate({ id: editFleetId, payload: { name, description } });
        } else {
          createMutation.mutate({ name, description });
        }
      }}>
        <h3>{editFleetId ? 'Update Fleet (PUT)' : 'Create Fleet (POST)'}</h3>
        <input placeholder="Fleet name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <button className="btn-primary" type="submit">
          {editFleetId ? 'Update Fleet' : 'Add Fleet'}
        </button>
      </form>

      <div className="panel">
        <table className="vehicles-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Description</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {fleets.map((fleet) => (
              <tr key={fleet.id}>
                <td>{fleet.id}</td>
                <td>{fleet.name}</td>
                <td>{fleet.description ?? '-'}</td>
                <td className="actions-cell">
                  <button
                    className="inline-link-btn"
                    type="button"
                    onClick={() => {
                      setEditFleetId(fleet.id);
                      setName(fleet.name);
                      setDescription(fleet.description ?? '');
                    }}
                  >
                    Edit (PUT)
                  </button>
                  <button
                    className="inline-link-btn"
                    type="button"
                    onClick={() => setSelectedFleetId(fleet.id)}
                  >
                    Details
                  </button>
                  <button className="inline-danger" type="button" onClick={() => deleteMutation.mutate(fleet.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedFleetId ? (
        <>
          <div className="panel">
            <h3>Fleet Details (GET /fleets/{selectedFleetId})</h3>
            <pre className="json-preview">{JSON.stringify(fleetDetailsQuery.data ?? {}, null, 2)}</pre>
          </div>

          <form
            className="panel form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              assignMutation.mutate({ fleetId: selectedFleetId, vehicleId: vehicleToAssign });
            }}
          >
            <h3>Assign Vehicle to Fleet (POST)</h3>
            <input
              type="number"
              placeholder="Vehicle ID"
              value={vehicleToAssign}
              onChange={(e) => setVehicleToAssign(Number(e.target.value))}
              required
            />
            <button className="btn-primary" type="submit" disabled={assignMutation.isPending}>
              {assignMutation.isPending ? 'Assigning...' : 'Assign Vehicle'}
            </button>
          </form>

          <div className="panel">
            <h3>Fleet Vehicles (GET /fleets/{selectedFleetId}/vehicles)</h3>
            <table className="vehicles-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Plate</th>
                  <th>Make/Model</th>
                  <th>Status</th>
                  <th>Driver</th>
                </tr>
              </thead>
              <tbody>
                {(fleetVehiclesQuery.data?.items ?? []).map((vehicle) => (
                  <tr key={vehicle.id}>
                    <td>{vehicle.id}</td>
                    <td>{vehicle.license_plate}</td>
                    <td>{vehicle.make} {vehicle.model}</td>
                    <td>{vehicle.status}</td>
                    <td>{vehicle.driver_id ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}
