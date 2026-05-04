import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { createDevice, deleteDevice, getDevicesOverview, listDevices, listVehicles } from '../lib/api/endpoints';
import { useI18n } from '../lib/i18n';

function formatDate(value?: string | null) {
  if (!value) return '-';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  } catch {
    return value;
  }
}

function getStatusTone(status?: string): 'ok' | 'warn' | 'danger' {
  const normalized = String(status ?? 'offline').toLowerCase();
  if (normalized === 'offline') return 'danger';
  if (normalized === 'warning') return 'warn';
  return 'ok';
}

export function DevicesPage() {
  const { locale } = useI18n();
  const text = locale === 'fr'
    ? {
        createFailed: 'Echec de creation du device',
        createSuccess: 'Appareil ajoute avec succes.',
        deleteFailed: 'Echec de suppression du device',
        deleteSuccess: 'Appareil supprime avec succes.',
        deleteConfirm: "Supprimer l'appareil",
        deleteIrreversible: 'Cette action est irreversible.',
        title: 'Gestion des appareils',
        subtitle: 'Configuration et supervision des dongles OBD',
        refreshing: 'Actualisation...',
        refresh: 'Actualiser',
        registered: 'Appareils enregistres',
        totalDongles: 'Nombre total de dongles',
        online: 'En ligne',
        connectedNow: 'Connectes en ce moment',
        offline: 'Hors ligne',
        unavailable: 'Non disponibles',
        warning: 'Avertissements',
        needsAttention: 'Necessitant attention',
        addDevice: 'Ajouter un appareil',
        deviceIdPlaceholder: 'ID du dongle exact (ex: dongle_001)',
        assignLater: 'Associer plus tard (optionnel)',
        plateNA: 'Plaque N/A',
        vinOptional: 'VIN optionnel (17 caracteres)',
        creating: 'Creation...',
        addDeviceButton: 'Ajouter appareil',
        listDevices: 'Liste des appareils',
        total: 'Total',
        searchByIdOrVin: 'Rechercher par ID ou VIN...',
        search: 'Chercher',
        noDeviceFound: 'Aucun appareil trouve',
        vehicle: 'Vehicule',
        unassigned: 'Non associe',
        deleting: 'Suppression...',
        delete: 'Supprimer',
      }
    : {
        createFailed: 'Device creation failed',
        createSuccess: 'Device added successfully.',
        deleteFailed: 'Device deletion failed',
        deleteSuccess: 'Device deleted successfully.',
        deleteConfirm: 'Delete device',
        deleteIrreversible: 'This action is irreversible.',
        title: 'Device Management',
        subtitle: 'Configuration and supervision of OBD dongles',
        refreshing: 'Refreshing...',
        refresh: 'Refresh',
        registered: 'Registered devices',
        totalDongles: 'Total number of dongles',
        online: 'Online',
        connectedNow: 'Connected now',
        offline: 'Offline',
        unavailable: 'Unavailable',
        warning: 'Warnings',
        needsAttention: 'Needs attention',
        addDevice: 'Add device',
        deviceIdPlaceholder: 'Exact dongle ID (e.g. dongle_001)',
        assignLater: 'Associate later (optional)',
        plateNA: 'No plate',
        vinOptional: 'Optional VIN (17 characters)',
        creating: 'Creating...',
        addDeviceButton: 'Add device',
        listDevices: 'Devices list',
        total: 'Total',
        searchByIdOrVin: 'Search by ID or VIN...',
        search: 'Search',
        noDeviceFound: 'No device found',
        vehicle: 'Vehicle',
        unassigned: 'Unassigned',
        deleting: 'Deleting...',
        delete: 'Delete',
      };
  const queryClient = useQueryClient();
  const [deviceId, setDeviceId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [vin, setVin] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const devicesQuery = useQuery({ queryKey: ['devices'], queryFn: () => listDevices() });
  const overviewQuery = useQuery({ queryKey: ['devices-overview'], queryFn: getDevicesOverview });
  const vehiclesQuery = useQuery({ queryKey: ['vehicles', 'devices-page'], queryFn: listVehicles });

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await createDevice({
        device_id: deviceId,
        vehicle_id: vehicleId.trim() === '' ? undefined : Number(vehicleId),
        vin: vin.trim() === '' ? undefined : vin,
      });

      if (response.status !== 'success') {
        throw new Error(response.message || text.createFailed);
      }

      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['devices-overview'] });
      setDeviceId('');
      setVehicleId('');
      setVin('');
      setActionMessage(text.createSuccess);
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : text.createFailed;
      setActionMessage(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await deleteDevice(id);
      if (response.status !== 'success') {
        throw new Error(response.message || text.deleteFailed);
      }
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['devices-overview'] });
      setActionMessage(text.deleteSuccess);
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : text.deleteFailed;
      setActionMessage(message);
    },
  });

  const allDevices = devicesQuery.data?.items ?? [];
  const vehicleOptions = vehiclesQuery.data?.items ?? [];
  const devices = useMemo(() => {
    if (!search.trim()) return allDevices;
    const q = search.trim().toLowerCase();
    return allDevices.filter((device) => {
      const deviceIdStr = String(device.device_id ?? '').toLowerCase();
      const vinStr = String(device.vin ?? '').toLowerCase();
      return deviceIdStr.includes(q) || vinStr.includes(q);
    });
  }, [allDevices, search]);

  const stats = useMemo(() => {
    const overview = overviewQuery.data;
    return {
      total: overview?.total ?? 0,
      online: overview?.online ?? 0,
      offline: overview?.offline ?? 0,
      warning: overview?.warning ?? 0,
    };
  }, [overviewQuery.data]);

  const handleSearch = () => {
    setSearch(searchInput.trim());
  };

  const handleSearchKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSearch();
    }
  };

  const handleDeleteDevice = (id: string, label: string) => {
    const confirmed = window.confirm(`${text.deleteConfirm} ${label} ? ${text.deleteIrreversible}`);
    if (!confirmed) {
      return;
    }
    setActionMessage('');
    deleteMutation.mutate(id);
  };

  return (
    <section className="devices-page">
      <div className="devices-topbar">
        <div className="devices-header">
          <h2 className="devices-title">{text.title}</h2>
          <p className="devices-subtitle">{text.subtitle}</p>
        </div>
        <div className="devices-top-actions">
          <button
            type="button"
            className="devices-action-btn"
            onClick={() => devicesQuery.refetch()}
            disabled={devicesQuery.isFetching}
          >
            {devicesQuery.isFetching ? text.refreshing : text.refresh}
          </button>
        </div>
      </div>

      <div className="devices-kpi-grid">
        <article className="devices-kpi-card">
          <p className="devices-kpi-label">{text.registered}</p>
          <p className="devices-kpi-value">{stats.total}</p>
          <p className="devices-kpi-note">{text.totalDongles}</p>
        </article>
        <article className="devices-kpi-card">
          <p className="devices-kpi-label">{text.online}</p>
          <p className="devices-kpi-value">{stats.online}</p>
          <p className="devices-kpi-note">{text.connectedNow}</p>
        </article>
        <article className="devices-kpi-card">
          <p className="devices-kpi-label">{text.offline}</p>
          <p className="devices-kpi-value">{stats.offline}</p>
          <p className="devices-kpi-note">{text.unavailable}</p>
        </article>
        <article className="devices-kpi-card">
          <p className="devices-kpi-label">{text.warning}</p>
          <p className="devices-kpi-value">{stats.warning}</p>
          <p className="devices-kpi-note">{text.needsAttention}</p>
        </article>
      </div>

      <div className="devices-main-grid">
        <div className="devices-create-panel">
          <h3 className="devices-panel-title">{text.addDevice}</h3>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setActionMessage('');
              createMutation.mutate();
            }}
          >
            <input
              className="devices-input"
              placeholder={text.deviceIdPlaceholder}
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              required
            />
            <select
              className="devices-input"
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
            >
              <option value="">{text.assignLater}</option>
              {vehicleOptions.map((vehicle) => (
                <option key={vehicle.id} value={String(vehicle.id)}>
                  #{vehicle.id} · {vehicle.license_plate || text.plateNA} · {vehicle.make} {vehicle.model}
                </option>
              ))}
            </select>
            <input
              className="devices-input"
              placeholder={text.vinOptional}
              value={vin}
              onChange={(e) => setVin(e.target.value)}
            />
            <button className="devices-btn-primary" type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? text.creating : text.addDeviceButton}
            </button>
            {actionMessage && <p className="devices-message">{actionMessage}</p>}
          </form>
        </div>

        <div className="devices-feed-panel">
          <div className="devices-feed-head">
            <h3 className="devices-panel-title">{text.listDevices}</h3>
            <p className="devices-panel-sub">{text.total}: {devices.length}</p>
          </div>

          <div className="devices-search-row">
            <input
              className="devices-search-input"
              placeholder={text.searchByIdOrVin}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
            <button type="button" className="devices-search-btn" onClick={handleSearch}>
              {text.search}
            </button>
          </div>

          {devices.length === 0 && (
            <div className="devices-empty">
              <p className="devices-empty-text">{text.noDeviceFound}</p>
            </div>
          )}

          {devices.map((device) => {
            const statusTone = getStatusTone(device.status);
            const lastComm = (device as { updated_at?: string; created_at?: string }).updated_at
              ?? (device as { updated_at?: string; created_at?: string }).created_at;
            return (
              <div key={device.id} className="devices-item-row">
                <Link
                  to={`/devices/${encodeURIComponent(device.device_id)}`}
                  className="devices-item-link"
                >
                  <article className="devices-item">
                    <div className="devices-item-header">
                      <div className="devices-item-info">
                        <h4 className="devices-item-name">{device.device_id}</h4>
                        <p className="devices-item-meta">
                          {device.vehicle_id ? `${text.vehicle} #${device.vehicle_id}` : text.unassigned}
                          {device.vin ? ` · VIN: ${device.vin}` : ''}
                        </p>
                      </div>
                      <span className={`devices-status-badge devices-status-badge-${statusTone}`}>
                        {String(device.status ?? 'offline')}
                      </span>
                    </div>
                    <div className="devices-item-footer">
                      <span className="devices-item-date">{formatDate(lastComm)}</span>
                    </div>
                  </article>
                </Link>
                <div className="devices-item-actions">
                  <button
                    type="button"
                    className="devices-delete-btn"
                    onClick={() => handleDeleteDevice(String(device.id), device.device_id)}
                    disabled={deleteMutation.isPending}
                  >
                    {deleteMutation.isPending ? text.deleting : text.delete}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
