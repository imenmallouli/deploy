import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { listAlerts, listDtc, listVehicles } from '../lib/api/endpoints';
import { useI18n } from '../lib/i18n';

function localizeAlertType(rawType: string | undefined, locale: 'fr' | 'en') {
  const value = String(rawType ?? '').trim().toLowerCase();

  const labelsFr: Record<string, string> = {
    thermal_delta: 'ecart thermique',
    fuel: 'carburant',
    engine_load: 'charge moteur',
    dtc: 'code defaut',
    device_cpu_temp: 'temperature CPU appareil',
    cooling: 'refroidissement',
  };

  const labelsEn: Record<string, string> = {
    thermal_delta: 'thermal delta',
    fuel: 'fuel',
    engine_load: 'engine load',
    dtc: 'DTC code',
    device_cpu_temp: 'device CPU temperature',
    cooling: 'cooling',
  };

  if (!value) return locale === 'fr' ? 'alerte' : 'alert';
  const label = locale === 'fr' ? labelsFr[value] : labelsEn[value];
  if (label) return label;
  return value.replace(/_/g, ' ');
}

function localizeAlertSeverity(rawSeverity: string | undefined, t: (key: string) => string) {
  const severity = String(rawSeverity ?? '').toLowerCase();
  if (severity === 'critical') return t('severity.critical');
  if (severity === 'warning') return t('severity.warning');
  return t('severity.info');
}

function formatOpenAlertLine(
  alert: { id: number; vehicle_id: number; type?: string; title?: string; severity?: string },
  locale: 'fr' | 'en',
  t: (key: string) => string,
) {
  const type = localizeAlertType(alert.type, locale);
  const severity = localizeAlertSeverity(alert.severity, t).toLowerCase();
  return `#${alert.vehicle_id} ${type} (${severity})`;
}

export function DashboardPage() {
  const { t, locale } = useI18n();
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
      <h2>{t('dashboard.title')}</h2>

      <div className="overview-layout">
        <div>
          <article className="panel getting-started-panel">
            <div className="getting-started-title-row">
              <h3>{t('dashboard.gettingStarted')}</h3>
              <span className="getting-started-info" aria-hidden="true">ⓘ</span>
            </div>
            <ol>
              <li><Link className="getting-started-link" to="/vehicles/list">{t('dashboard.step1')}</Link></li>
              <li><Link className="getting-started-link" to="/alerts">{t('dashboard.step2')}</Link></li>
              <li>
                {t('dashboard.step3a')} <Link className="getting-started-link" to="/locations">{t('dashboard.step3b')}</Link> {t('dashboard.step3c')}
              </li>
            </ol>
          </article>

          <article className="panel fleet-overview-panel">
            <div className="panel-title-row">
              <h3>{t('dashboard.title')}</h3>
            </div>

            <div className="overview-cards-grid">
              <div className="overview-stat-card">
                <p className="overview-stat-title">{t('dashboard.drivingNow')}</p>
                <p className="overview-stat-value">{drivingNow} {t('dashboard.of')} {totalVehicles}</p>
              </div>
              <div className="overview-stat-card is-highlight">
                <p className="overview-stat-title">{t('dashboard.drivenToday')}</p>
                <p className="overview-stat-value">{drivenToday} {t('dashboard.of')} {totalVehicles}</p>
              </div>
              <div className="overview-stat-card">
                <p className="overview-stat-title">{t('dashboard.driven30')}</p>
                <p className="overview-stat-value">{drivenLast30Days} {t('dashboard.of')} {totalVehicles}</p>
              </div>
              <div className="overview-stat-card">
                <p className="overview-stat-title">{t('dashboard.notDriven30')}</p>
                <p className="overview-stat-value">{notDrivenLast30Days} {t('dashboard.of')} {totalVehicles}</p>
              </div>
            </div>
          </article>

          <article className="panel open-alerts-panel">
            <div className="panel-title-row">
              <h3>{t('dashboard.openAlerts')}</h3>
              <span className="muted-note">{t('dashboard.pending')} {pendingAlerts}</span>
            </div>
            <ul>
              {latestAlerts.length === 0 && <li>{t('dashboard.noOpenAlerts')}</li>}
              {latestAlerts.map((alert) => (
                <li key={alert.id}>{formatOpenAlertLine(alert, locale, t)}</li>
              ))}
            </ul>
          </article>
        </div>

        <aside className="panel fleet-tracking-panel">
          <div className="panel-title-row">
            <h3>{t('dashboard.fleetTracking')}</h3>
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
