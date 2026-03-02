import { useQuery } from '@tanstack/react-query';
import { StatCard } from '../components/StatCard';
import { listAlerts, listDtc, listVehicles } from '../lib/api/endpoints';

export function DashboardPage() {
  const vehiclesQuery = useQuery({ queryKey: ['vehicles'], queryFn: listVehicles });
  const alertsQuery = useQuery({ queryKey: ['alerts'], queryFn: listAlerts });
  const dtcQuery = useQuery({ queryKey: ['dtc'], queryFn: () => listDtc(20) });

  const latestAlerts = alertsQuery.data?.alerts?.slice(0, 5) ?? [];
  const watchVehicles = (vehiclesQuery.data?.items ?? [])
    .filter((vehicle) => ['warning', 'critical'].includes(vehicle.status))
    .slice(0, 5);

  return (
    <section>
      <h2>Operational Dashboard</h2>
      <p className="subtitle">Quick operational view inspired by AutoPi fleet/device/data flow.</p>

      <div className="stats-grid">
        <StatCard title="Vehicles" value={vehiclesQuery.data?.count ?? 0} />
        <StatCard title="Pending Alerts" value={alertsQuery.data?.pending ?? 0} tone="warning" />
        <StatCard title="Active DTC" value={dtcQuery.data?.count ?? 0} tone="critical" />
        <StatCard title="Last Sync" value={new Date().toLocaleTimeString()} />
      </div>

      <div className="panel-grid">
        <article className="panel">
          <h3>Latest Alerts</h3>
          <ul>
            {latestAlerts.map((alert) => (
              <li key={alert.id}>#{alert.vehicle_id} {alert.title} ({alert.status})</li>
            ))}
          </ul>
        </article>
        <article className="panel">
          <h3>Vehicles to Watch</h3>
          <ul>
            {watchVehicles.map((vehicle) => (
              <li key={vehicle.id}>#{vehicle.id} {vehicle.license_plate} - {vehicle.status}</li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}
