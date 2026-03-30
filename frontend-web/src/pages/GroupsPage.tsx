import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { createGroup, listGroups } from '../lib/api/endpoints';

function getErrorMessage(error: unknown) {
  const data = (error as { response?: { data?: { message?: string; detail?: string } } })?.response?.data;
  return data?.message ?? data?.detail ?? 'Request failed. Please try again.';
}

export function GroupsPage() {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');

  const groupsQuery = useQuery({ queryKey: ['groups', search], queryFn: () => listGroups(search || undefined) });
  const createMutation = useMutation({
    mutationFn: createGroup,
    onSuccess: () => {
      setName('');
      setCreateError('');
      setCreateSuccess('Group created successfully.');
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: (error) => {
      setCreateSuccess('');
      setCreateError(getErrorMessage(error));
    },
  });

  const items = groupsQuery.data?.items ?? [];

  const handleSearch = () => {
    setSearch(searchInput.trim());
  };

  const handleSearchKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSearch();
    }
  };

  const handleCreate = () => {
    setCreateSuccess('');
    if (!name.trim()) {
      setCreateError('Name is required.');
      return;
    }
    setCreateError('');
    createMutation.mutate({ name: name.trim() });
  };

  return (
    <section>
      <h2>Groups</h2>
      <div className="panel table-shell">
        <div className="toolbar-row">
          <input className="toolbar-input" placeholder="Search for groups" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} onKeyDown={handleSearchKeyDown} />
          <button className="btn-link" type="button" onClick={handleSearch}>
            Search
          </button>
          <input className="toolbar-input" placeholder="New group name" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn-primary" type="button" onClick={handleCreate} disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'Create'}
          </button>
        </div>

        {createError && <p className="form-error">{createError}</p>}
        {createSuccess && <p className="muted-note">{createSuccess}</p>}

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
