import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { listAlerts, listDtc, listVehicles } from '../lib/api/endpoints';

export function DashboardPage() {
  const vehiclesQuery = useQuery({ queryKey: ['vehicles'], queryFn: listVehicles });
  const alertsQuery = useQuery({ queryKey: ['alerts'], queryFn: listAlerts });
  const dtcQuery = useQuery({ queryKey: ['dtc'], queryFn: () => listDtc(20) });

  const vehicles = vehiclesQuery.data?.items ?? [];
  const totalVehicles = vehiclesQuery.data?.count ?? 0;
  const pendingAlerts = alertsQuery.data?.pending ?? 0;
  const latestAlerts = alertsQuery.data?.alerts?.slice(0, 6) ?? [];

  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
  const fifteenMinutesAgo = now - (15 * 60 * 1000);

  const getLastSeenMs = (lastAutopiSeen?: string | null, lastConnection?: string | null) => {
    const source = lastAutopiSeen ?? lastConnection;
    if (!source) return null;
    const parsed = Date.parse(source);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const drivingNow = vehicles.filter((vehicle) => {
    const status = (vehicle.status ?? '').toLowerCase();
    const lastSeenMs = getLastSeenMs(vehicle.last_autopi_seen, vehicle.last_connection);
    return status === 'active' || (lastSeenMs !== null && lastSeenMs >= fifteenMinutesAgo);
  }).length;

  const drivenToday = vehicles.filter((vehicle) => {
    const lastSeenMs = getLastSeenMs(vehicle.last_autopi_seen, vehicle.last_connection);
    return lastSeenMs !== null && lastSeenMs >= startOfToday.getTime();
  }).length;

  const drivenLast30Days = vehicles.filter((vehicle) => {
    const lastSeenMs = getLastSeenMs(vehicle.last_autopi_seen, vehicle.last_connection);
    return lastSeenMs !== null && lastSeenMs >= thirtyDaysAgo;
  }).length;

  const notDrivenLast30Days = Math.max(totalVehicles - drivenLast30Days, 0);

  return (
    <section className="overview-page">
      <h2>Fleet Overview</h2>

      <div className="overview-layout">
        <div>
          <article className="panel getting-started-panel">
            <div className="getting-started-title-row">
              <h3>Getting started</h3>
              <span className="getting-started-info" aria-hidden="true">ⓘ</span>
            </div>
            <ol>
              <li><Link className="getting-started-link" to="/vehicles/list">Create / Import vehicles and start managing them</Link></li>
              <li><Link className="getting-started-link" to="/alerts">Review alerts detected across your fleet</Link></li>
              <li>
                Create and assign <Link className="getting-started-link" to="/locations">locations</Link> to vehicles
              </li>
            </ol>
          </article>

          <article className="panel fleet-overview-panel">
            <div className="panel-title-row">
              <h3>Fleet Overview</h3>
            </div>

            <div className="overview-cards-grid">
              <div className="overview-stat-card">
                <p className="overview-stat-title">Driving now</p>
                <p className="overview-stat-value">{drivingNow} of {totalVehicles}</p>
              </div>
              <div className="overview-stat-card is-highlight">
                <p className="overview-stat-title">Driven today</p>
                <p className="overview-stat-value">{drivenToday} of {totalVehicles}</p>
              </div>
              <div className="overview-stat-card">
                <p className="overview-stat-title">Driven last 30 days</p>
                <p className="overview-stat-value">{drivenLast30Days} of {totalVehicles}</p>
              </div>
              <div className="overview-stat-card">
                <p className="overview-stat-title">Not driven last 30 days</p>
                <p className="overview-stat-value">{notDrivenLast30Days} of {totalVehicles}</p>
              </div>
            </div>
          </article>

          <article className="panel open-alerts-panel">
            <div className="panel-title-row">
              <h3>Open Alerts</h3>
              <span className="muted-note">vehicles · pending {pendingAlerts}</span>
            </div>
            <ul>
              {latestAlerts.length === 0 && <li>No open alerts</li>}
              {latestAlerts.map((alert) => (
                <li key={alert.id}>#{alert.vehicle_id} {alert.title} ({alert.severity})</li>
              ))}
            </ul>
          </article>
        </div>

        <aside className="panel fleet-tracking-panel">
          <div className="panel-title-row">
            <h3>Fleet Tracking</h3>
            <span className="muted-note">DTC: {dtcQuery.data?.count ?? 0}</span>
          </div>
          <iframe
            title="Fleet map"
            className="fleet-map"
            src="https://www.openstreetmap.org/export/embed.html?bbox=-3.8%2C43.8%2C3.8%2C49.2&amp;layer=mapnik"
          />
        </aside>
      </div>
    </section>
  );
}
