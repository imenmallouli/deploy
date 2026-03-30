import { useQuery } from '@tanstack/react-query';
import { getDevicesOverview, listDtc } from '../lib/api/endpoints';

export function DeviceOverviewPage() {
  const overviewQuery = useQuery({ queryKey: ['devices-overview'], queryFn: getDevicesOverview });
  const dtcQuery = useQuery({ queryKey: ['dtc-overview'], queryFn: () => listDtc(20) });

  return (
    <section>
      <h2>Device Overview</h2>
      <p className="subtitle">Global view of connected devices and OBD health.</p>

      <div className="stats-grid">
        <article className="stat-card">
          <p className="stat-title">Registered Devices</p>
          <p className="stat-value">{overviewQuery.data?.total ?? 0}</p>
        </article>
        <article className="stat-card warning">
          <p className="stat-title">DTC Events</p>
          <p className="stat-value">{dtcQuery.data?.count ?? 0}</p>
        </article>
        <article className="stat-card">
          <p className="stat-title">Connectivity</p>
          <p className="stat-value">{overviewQuery.data?.online ?? 0}</p>
        </article>
        <article className="stat-card">
          <p className="stat-title">Offline</p>
          <p className="stat-value">{overviewQuery.data?.offline ?? 0}</p>
        </article>
      </div>
    </section>
  );
}
