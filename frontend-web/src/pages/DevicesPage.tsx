import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { createDevice, getDevicesOverview, listDevices } from '../lib/api/endpoints';

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
  const queryClient = useQueryClient();
  const [deviceId, setDeviceId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [vin, setVin] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const devicesQuery = useQuery({ queryKey: ['devices'], queryFn: () => listDevices() });
  const overviewQuery = useQuery({ queryKey: ['devices-overview'], queryFn: getDevicesOverview });

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await createDevice({
        device_id: deviceId,
        vehicle_id: vehicleId.trim() === '' ? undefined : Number(vehicleId),
        vin: vin.trim() === '' ? undefined : vin,
      });

      if (response.status !== 'success') {
        throw new Error(response.message || 'Échec de création du device');
      }

      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['devices-overview'] });
      setDeviceId('');
      setVehicleId('');
      setVin('');
      setActionMessage('Appareil ajouté avec succès.');
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Échec de création du device';
      setActionMessage(message);
    },
  });

  const allDevices = devicesQuery.data?.items ?? [];
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

  return (
    <section className="devices-page">
      <div className="devices-topbar">
        <div className="devices-header">
          <h2 className="devices-title">Gestion des appareils</h2>
          <p className="devices-subtitle">Configuration et supervision des dongles OBD</p>
        </div>
        <div className="devices-top-actions">
          <button
            type="button"
            className="devices-action-btn"
            onClick={() => devicesQuery.refetch()}
            disabled={devicesQuery.isFetching}
          >
            {devicesQuery.isFetching ? 'Actualisation...' : 'Actualiser'}
          </button>
        </div>
      </div>

      <div className="devices-kpi-grid">
        <article className="devices-kpi-card">
          <p className="devices-kpi-label">Appareils enregistrés</p>
          <p className="devices-kpi-value">{stats.total}</p>
          <p className="devices-kpi-note">Nombre total de dongles</p>
        </article>
        <article className="devices-kpi-card">
          <p className="devices-kpi-label">En ligne</p>
          <p className="devices-kpi-value">{stats.online}</p>
          <p className="devices-kpi-note">Connectés en ce moment</p>
        </article>
        <article className="devices-kpi-card">
          <p className="devices-kpi-label">Hors ligne</p>
          <p className="devices-kpi-value">{stats.offline}</p>
          <p className="devices-kpi-note">Non disponibles</p>
        </article>
        <article className="devices-kpi-card">
          <p className="devices-kpi-label">Avertissements</p>
          <p className="devices-kpi-value">{stats.warning}</p>
          <p className="devices-kpi-note">Nécessitant attention</p>
        </article>
      </div>

      <div className="devices-main-grid">
        <div className="devices-create-panel">
          <h3 className="devices-panel-title">Ajouter un appareil</h3>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setActionMessage('');
              createMutation.mutate();
            }}
          >
            <input
              className="devices-input"
              placeholder="ID du dongle exact (ex: dongle_001)"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              required
            />
            <input
              className="devices-input"
              type="number"
              placeholder="ID du véhicule optionnel (ex: 5)"
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
            />
            <input
              className="devices-input"
              placeholder="VIN optionnel (17 caractères)"
              value={vin}
              onChange={(e) => setVin(e.target.value)}
            />
            <button className="devices-btn-primary" type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Création...' : 'Ajouter appareil'}
            </button>
            {actionMessage && <p className="devices-message">{actionMessage}</p>}
          </form>
        </div>

        <div className="devices-feed-panel">
          <div className="devices-feed-head">
            <h3 className="devices-panel-title">Liste des appareils</h3>
            <p className="devices-panel-sub">Total: {devices.length}</p>
          </div>

          <div className="devices-search-row">
            <input
              className="devices-search-input"
              placeholder="Rechercher par ID ou VIN..."
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
            <button type="button" className="devices-search-btn" onClick={handleSearch}>
              Chercher
            </button>
          </div>

          {devices.length === 0 && (
            <div className="devices-empty">
              <p className="devices-empty-text">Aucun appareil trouvé</p>
            </div>
          )}

          {devices.map((device) => {
            const statusTone = getStatusTone(device.status);
            const lastComm = (device as { updated_at?: string; created_at?: string }).updated_at
              ?? (device as { updated_at?: string; created_at?: string }).created_at;
            return (
              <Link
                key={device.id}
                to={`/devices/${encodeURIComponent(device.device_id)}`}
                className="devices-item-link"
              >
                <article className="devices-item">
                  <div className="devices-item-header">
                    <div className="devices-item-info">
                      <h4 className="devices-item-name">{device.device_id}</h4>
                      <p className="devices-item-meta">
                        {device.vehicle_id ? `Véhicule #${device.vehicle_id}` : 'Non associé'}
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
            );
          })}
        </div>
      </div>
    </section>
  );
}
