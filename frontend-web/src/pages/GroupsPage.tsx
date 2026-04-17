import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { createGroup, deleteGroup, listGroups, listVehicles, updateGroup } from '../lib/api/endpoints';

function getErrorMessage(error: unknown) {
  const data = (error as { response?: { data?: { message?: string; detail?: string } } })?.response?.data;
  return data?.message ?? data?.detail ?? 'Request failed. Please try again.';
}

type GroupItem = { id: string; name: string; vehicle_count?: number };

function EditGroupModal({
  group,
  onClose,
  onUpdated,
}: {
  group: GroupItem;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [editName, setEditName] = useState(group.name);
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [modalError, setModalError] = useState('');

  const vehiclesQuery = useQuery({ queryKey: ['vehicles'], queryFn: listVehicles });
  const allVehicles = vehiclesQuery.data?.items ?? [];
  const filtered = allVehicles.filter((v) => {
    const q = vehicleSearch.toLowerCase();
    return (
      !q ||
      `${v.make ?? ''} ${v.model ?? ''}`.toLowerCase().includes(q) ||
      (v.vin ?? '').toLowerCase().includes(q) ||
      (v.license_plate ?? '').toLowerCase().includes(q)
    );
  });

  const updateMutation = useMutation({
    mutationFn: () => updateGroup(group.id, { name: editName.trim() }),
    onSuccess: () => { onUpdated(); onClose(); },
    onError: (error) => setModalError(getErrorMessage(error)),
  });

  const handleUpdate = () => {
    if (!editName.trim()) { setModalError('Name is required.'); return; }
    setModalError('');
    updateMutation.mutate();
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#fff', borderRadius: 12, width: '100%', maxWidth: 680,
        padding: '28px 32px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', position: 'relative',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>✏️</span>
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Edit group</h3>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#888', lineHeight: 1 }}>✕</button>
        </div>

        {/* Name field */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
            Name <span style={{ color: 'red' }}>*</span>
          </label>
          <input
            className="toolbar-input"
            value={editName}
            autoFocus
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleUpdate(); if (e.key === 'Escape') onClose(); }}
            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', fontSize: 15 }}
          />
        </div>

        {/* Vehicle search */}
        <div style={{ marginBottom: 12 }}>
          <input
            className="toolbar-input"
            placeholder="Search for vehicle"
            value={vehicleSearch}
            onChange={(e) => setVehicleSearch(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', fontSize: 14 }}
          />
        </div>

        {/* Vehicles table */}
        <table className="vehicles-table" style={{ marginBottom: 12 }}>
          <thead>
            <tr>
              <th>Name</th>
              <th>VIN</th>
              <th>Make</th>
              <th>Model</th>
              <th>Year</th>
            </tr>
          </thead>
          <tbody>
            {vehiclesQuery.isLoading && (
              <tr><td colSpan={5} className="empty-cell">Loading vehicles...</td></tr>
            )}
            {!vehiclesQuery.isLoading && filtered.length === 0 && (
              <tr><td colSpan={5} className="empty-cell">No vehicles found</td></tr>
            )}
            {filtered.map((v) => (
              <tr key={v.id}>
                <td>
                  <Link to={`/vehicles/${v.id}`} onClick={onClose} style={{ color: 'var(--primary, #2563eb)' }}>
                    {v.make} {v.model} {v.year}
                  </Link>
                </td>
                <td>{v.vin ?? '-'}</td>
                <td>{v.make ?? '-'}</td>
                <td>{v.model ?? '-'}</td>
                <td>{v.year ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ margin: '0 0 16px', color: '#888', fontSize: 13 }}>Vehicles: {allVehicles.length}</p>

        {modalError && <p className="form-error" style={{ marginBottom: 12 }}>{modalError}</p>}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn-link" type="button" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            type="button"
            disabled={updateMutation.isPending}
            onClick={handleUpdate}
          >
            {updateMutation.isPending ? 'Saving...' : 'Update'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function GroupsPage() {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const [editGroup, setEditGroup] = useState<GroupItem | null>(null);

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
  const deleteMutation = useMutation({
    mutationFn: deleteGroup,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['groups'] }); },
  });

  const items = groupsQuery.data?.items ?? [];

  const handleSearch = () => setSearch(searchInput.trim());
  const handleSearchKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSearch(); }
  };

  const handleCreate = () => {
    setCreateSuccess('');
    if (!name.trim()) { setCreateError('Name is required.'); return; }
    setCreateError('');
    createMutation.mutate({ name: name.trim() });
  };

  return (
    <section>
      <h2>Groups</h2>

      {editGroup && (
        <EditGroupModal
          group={editGroup}
          onClose={() => setEditGroup(null)}
          onUpdated={() => {
            setCreateSuccess('Group updated successfully.');
            queryClient.invalidateQueries({ queryKey: ['groups'] });
          }}
        />
      )}

      <div className="panel table-shell">
        <div className="toolbar-row">
          <input className="toolbar-input" placeholder="Search for groups" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} onKeyDown={handleSearchKeyDown} />
          <button className="btn-link" type="button" onClick={handleSearch}>Search</button>
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
              <tr><td colSpan={3} className="empty-cell">No data to display</td></tr>
            )}
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <span
                    style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--primary, #2563eb)' }}
                    onClick={() => { setEditGroup(item); setCreateSuccess(''); setCreateError(''); }}
                    title="Click to edit"
                  >
                    {item.name}
                  </span>
                </td>
                <td>{item.vehicle_count ?? 0}</td>
                <td>
                  <button
                    className="btn-link"
                    type="button"
                    style={{ color: 'var(--danger, #dc3545)' }}
                    disabled={deleteMutation.isPending}
                    onClick={() => { if (window.confirm(`Delete group "${item.name}"?`)) deleteMutation.mutate(item.id); }}
                  >
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
