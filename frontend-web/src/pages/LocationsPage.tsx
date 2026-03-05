import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { createLocation, listLocations } from '../lib/api/endpoints';

export function LocationsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');

  const locationsQuery = useQuery({ queryKey: ['locations', search], queryFn: () => listLocations(search || undefined) });
  const createMutation = useMutation({
    mutationFn: createLocation,
    onSuccess: () => {
      setName('');
      queryClient.invalidateQueries({ queryKey: ['locations'] });
    },
  });

  const items = locationsQuery.data?.items ?? [];

  return (
    <section>
      <h2>Locations</h2>

      <div className="panel map-panel">
        <iframe
          title="Locations map"
          className="fleet-map compact"
          src="https://www.openstreetmap.org/export/embed.html?bbox=-3.8%2C43.8%2C3.8%2C49.2&amp;layer=mapnik"
        />
      </div>

      <div className="panel table-shell">
        <div className="toolbar-row">
          <input className="toolbar-input" placeholder="Search for locations" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="btn-link" type="button">Filters</button>
          <input className="toolbar-input" placeholder="New location name" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn-primary" type="button" onClick={() => name.trim() && createMutation.mutate({ name })}>Create</button>
        </div>
        <table className="vehicles-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Latitude</th>
              <th>Longitude</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-cell">No data to display</td>
              </tr>
            )}
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.type ?? '-'}</td>
                <td>{item.latitude ?? '-'}</td>
                <td>{item.longitude ?? '-'}</td>
                <td>-</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
