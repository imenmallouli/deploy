import { useQuery } from '@tanstack/react-query';
import { listAlerts, listDtc, listVehicles } from '../lib/api/endpoints';

export function DashboardPage() {
  const vehiclesQuery = useQuery({ queryKey: ['vehicles'], queryFn: listVehicles });
  const alertsQuery = useQuery({ queryKey: ['alerts'], queryFn: listAlerts });
  const dtcQuery = useQuery({ queryKey: ['dtc'], queryFn: () => listDtc(20) });

  const vehicles = vehiclesQuery.data?.items ?? [];
  const totalVehicles = vehiclesQuery.data?.count ?? 0;
  const pendingAlerts = alertsQuery.data?.pending ?? 0;
  const latestAlerts = alertsQuery.data?.alerts?.slice(0, 6) ?? [];

  const drivingNow = vehicles.filter((vehicle) => (vehicle.status ?? '').toLowerCase() === 'active').length;
  const drivenToday = vehicles.filter((vehicle) => ['active', 'warning'].includes((vehicle.status ?? '').toLowerCase())).length;
  const drivenLast30Days = Math.max(totalVehicles - pendingAlerts, 0);
  const notDrivenLast30Days = Math.max(totalVehicles - drivenLast30Days, 0);

  return (
    <section className="overview-page">
      <h2>Fleet Overview</h2>

      <div className="overview-layout">
        <div>
          <article className="panel getting-started-panel">
            <h3>Getting started</h3>
            <ol>
              <li>Create / Import vehicles and start managing them</li>
              <li>Invite team members</li>
              <li>Add details to vehicles in your fleet</li>
              <li>Create and assign locations and geofences</li>
            </ol>
          </article>

          <article className="panel fleet-overview-panel">
            <div className="panel-title-row">
              <h3>Fleet Overview</h3>
              <button className="inline-link-btn" type="button">Show all vehicles</button>
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
