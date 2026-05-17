import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { createGroup, deleteGroup, listGroups, listVehicles, updateGroup } from '../lib/api/endpoints';
import { useI18n } from '../lib/i18n';

function getErrorMessage(error: unknown, locale: 'fr' | 'en' = 'en') {
  const data = (error as { response?: { data?: { message?: string; detail?: string } } })?.response?.data;
  return data?.message ?? data?.detail ?? (locale === 'fr' ? 'Echec de la requete. Veuillez reessayer.' : 'Request failed. Please try again.');
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
  const { locale } = useI18n();
  const text = locale === 'fr'
    ? {
        requiredName: 'Le nom est requis.',
        title: 'Modifier le groupe',
        name: 'Nom',
        searchVehicle: 'Rechercher un vehicule',
        loadingVehicles: 'Chargement des vehicules...',
        noVehicles: 'Aucun vehicule trouve',
        vehicles: 'Vehicules',
        cancel: 'Annuler',
        saving: 'Sauvegarde...',
        update: 'Mettre a jour',
        colName: 'Nom',
        colVin: 'VIN',
        colMake: 'Marque',
        colModel: 'Modele',
        colYear: 'Annee',
      }
    : {
        requiredName: 'Name is required.',
        title: 'Edit group',
        name: 'Name',
        searchVehicle: 'Search for vehicle',
        loadingVehicles: 'Loading vehicles...',
        noVehicles: 'No vehicles found',
        vehicles: 'Vehicles',
        cancel: 'Cancel',
        saving: 'Saving...',
        update: 'Update',
        colName: 'Name',
        colVin: 'VIN',
        colMake: 'Make',
        colModel: 'Model',
        colYear: 'Year',
      };
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
    onError: (error) => setModalError(getErrorMessage(error, locale)),
  });

  const handleUpdate = () => {
    if (!editName.trim()) { setModalError(text.requiredName); return; }
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
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{text.title}</h3>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#888', lineHeight: 1 }}>✕</button>
        </div>

        {/* Name field */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
            {text.name} <span style={{ color: 'red' }}>*</span>
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
            placeholder={text.searchVehicle}
            value={vehicleSearch}
            onChange={(e) => setVehicleSearch(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', fontSize: 14 }}
          />
        </div>

        {/* Vehicles table */}
        <table className="vehicles-table" style={{ marginBottom: 12 }}>
          <thead>
            <tr>
              <th>{text.colName}</th>
              <th>{text.colVin}</th>
              <th>{text.colMake}</th>
              <th>{text.colModel}</th>
              <th>{text.colYear}</th>
            </tr>
          </thead>
          <tbody>
            {vehiclesQuery.isLoading && (
              <tr><td colSpan={5} className="empty-cell">{text.loadingVehicles}</td></tr>
            )}
            {!vehiclesQuery.isLoading && filtered.length === 0 && (
              <tr><td colSpan={5} className="empty-cell">{text.noVehicles}</td></tr>
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
        <p style={{ margin: '0 0 16px', color: '#888', fontSize: 13 }}>{text.vehicles}: {allVehicles.length}</p>

        {modalError && <p className="form-error" style={{ marginBottom: 12 }}>{modalError}</p>}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn-link" type="button" onClick={onClose}>{text.cancel}</button>
          <button
            className="btn-primary"
            type="button"
            disabled={updateMutation.isPending}
            onClick={handleUpdate}
          >
            {updateMutation.isPending ? text.saving : text.update}
          </button>
        </div>
      </div>
    </div>
  );
}

export function GroupsPage() {
  const { locale } = useI18n();
  const text = locale === 'fr'
    ? {
        requiredName: 'Le nom est requis.',
        created: 'Groupe cree avec succes.',
        updated: 'Groupe mis a jour avec succes.',
        title: 'Groupes',
        searchGroups: 'Rechercher des groupes',
        search: 'Chercher',
        newGroupName: 'Nouveau nom de groupe',
        creating: 'Creation...',
        create: 'Creer',
        colName: 'Nom',
        colVehicles: 'Vehicules',
        colDelete: 'Supprimer',
        noData: 'Aucune donnee a afficher',
        clickToEdit: 'Cliquer pour modifier',
        delete: 'Supprimer',
        confirmDeleteGroup: 'Supprimer le groupe',
      }
    : {
        requiredName: 'Name is required.',
        created: 'Group created successfully.',
        updated: 'Group updated successfully.',
        title: 'Groups',
        searchGroups: 'Search for groups',
        search: 'Search',
        newGroupName: 'New group name',
        creating: 'Creating...',
        create: 'Create',
        colName: 'Name',
        colVehicles: 'Vehicles',
        colDelete: 'Delete',
        noData: 'No data to display',
        clickToEdit: 'Click to edit',
        delete: 'Delete',
        confirmDeleteGroup: 'Delete group',
      };
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
      setCreateSuccess(text.created);
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: (error) => {
      setCreateSuccess('');
      setCreateError(getErrorMessage(error, locale));
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
    if (!name.trim()) { setCreateError(text.requiredName); return; }
    setCreateError('');
    createMutation.mutate({ name: name.trim() });
  };

  return (
    <section>
      <h2>{text.title}</h2>

      {editGroup && (
        <EditGroupModal
          group={editGroup}
          onClose={() => setEditGroup(null)}
          onUpdated={() => {
            setCreateSuccess(text.updated);
            queryClient.invalidateQueries({ queryKey: ['groups'] });
          }}
        />
      )}

      <div className="panel table-shell">
        <div className="toolbar-row">
          <input className="toolbar-input" placeholder={text.searchGroups} value={searchInput} onChange={(e) => setSearchInput(e.target.value)} onKeyDown={handleSearchKeyDown} />
          <button className="btn-link" type="button" onClick={handleSearch}>{text.search}</button>
          <input className="toolbar-input" placeholder={text.newGroupName} value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn-primary" type="button" onClick={handleCreate} disabled={createMutation.isPending}>
            {createMutation.isPending ? text.creating : text.create}
          </button>
        </div>

        {createError && <p className="form-error">{createError}</p>}
        {createSuccess && <p className="muted-note">{createSuccess}</p>}

        <table className="vehicles-table">
          <thead>
            <tr>
              <th>{text.colName}</th>
              <th>{text.colVehicles}</th>
              <th>{text.colDelete}</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={3} className="empty-cell">{text.noData}</td></tr>
            )}
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <span
                    style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--primary, #2563eb)' }}
                    onClick={() => { setEditGroup(item); setCreateSuccess(''); setCreateError(''); }}
                    title={text.clickToEdit}
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
                    onClick={() => { if (window.confirm(`${text.confirmDeleteGroup} "${item.name}"?`)) deleteMutation.mutate(item.id); }}
                  >
                    {text.delete}
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
