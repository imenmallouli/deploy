import { useQuery } from '@tanstack/react-query';
import { getDevicesOverview } from '../lib/api/endpoints';
import { useI18n } from '../lib/i18n';

export function DeviceOverviewPage() {
  const { t } = useI18n();
  const overviewQuery = useQuery({ queryKey: ['devices-overview'], queryFn: getDevicesOverview });

  return (
    <section>
      <h2>{t('deviceOverview.title')}</h2>

      <div className="stats-grid">
        <article className="stat-card">
          <p className="stat-title">{t('deviceOverview.registered')}</p>
          <p className="stat-value">{overviewQuery.data?.total ?? 0}</p>
        </article>
        <article className="stat-card">
          <p className="stat-title">{t('deviceOverview.connectivity')}</p>
          <p className="stat-value">{overviewQuery.data?.online ?? 0}</p>
        </article>
        <article className="stat-card">
          <p className="stat-title">{t('deviceOverview.offline')}</p>
          <p className="stat-value">{overviewQuery.data?.offline ?? 0}</p>
        </article>
      </div>
    </section>
  );
}
