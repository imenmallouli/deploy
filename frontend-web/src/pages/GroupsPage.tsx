import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { createGroup, listGroups } from '../lib/api/endpoints';

export function GroupsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');

  const groupsQuery = useQuery({ queryKey: ['groups', search], queryFn: () => listGroups(search || undefined) });
  const createMutation = useMutation({
    mutationFn: createGroup,
    onSuccess: () => {
      setName('');
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });

  const items = groupsQuery.data?.items ?? [];

  return (
    <section>
      <h2>Groups</h2>
      <div className="panel table-shell">
        <div className="toolbar-row">
          <input className="toolbar-input" placeholder="Search for groups" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="btn-link" type="button">Search</button>
          <input className="toolbar-input" placeholder="New group name" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn-primary" type="button" onClick={() => name.trim() && createMutation.mutate({ name })}>Create</button>
        </div>

        <table className="vehicles-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Vehicles</th>
              <th>Delete</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={3} className="empty-cell">No data to display</td>
              </tr>
            )}
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
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
