import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { createGeofence, listGeofences } from '../lib/api/endpoints';

export function GeofencesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');

  const geofencesQuery = useQuery({ queryKey: ['geofences', search], queryFn: () => listGeofences(search || undefined) });
  const createMutation = useMutation({
    mutationFn: createGeofence,
    onSuccess: () => {
      setName('');
      queryClient.invalidateQueries({ queryKey: ['geofences'] });
    },
  });

  const items = geofencesQuery.data?.items ?? [];

  return (
    <section>
      <h2>Geofences</h2>
      <div className="panel map-panel">
        <iframe
          title="Geofences map"
          className="fleet-map compact"
          src="https://www.openstreetmap.org/export/embed.html?bbox=-3.8%2C43.8%2C3.8%2C49.2&amp;layer=mapnik"
        />
      </div>

      <div className="panel table-shell">
        <div className="toolbar-row">
          <input className="toolbar-input" placeholder="Search for geofences" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="btn-link" type="button">Filters</button>
          <button className="btn-link" type="button">Columns</button>
          <input className="toolbar-input" placeholder="New geofence name" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn-primary" type="button" onClick={() => name.trim() && createMutation.mutate({ name })}>Create</button>
        </div>

        <table className="vehicles-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>On Enter</th>
              <th>On Exit</th>
              <th>Vehicles</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="empty-cell">No data to display</td>
              </tr>
            )}
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.description ?? '-'}</td>
                <td>{item.on_enter ?? '-'}</td>
                <td>{item.on_exit ?? '-'}</td>
                <td>{item.vehicle_count ?? 0}</td>
                <td>-</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
