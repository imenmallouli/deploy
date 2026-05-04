import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listAlerts, listDtc, listVehicles } from '../lib/api/endpoints';
import { useI18n } from '../lib/i18n';

export function GetStartedPage() {
  const { t } = useI18n();
  const [showWelcome, setShowWelcome] = useState(true);
  const vehiclesQuery = useQuery({ queryKey: ['vehicles'], queryFn: listVehicles });
  const alertsQuery = useQuery({ queryKey: ['alerts'], queryFn: listAlerts });
  const dtcQuery = useQuery({ queryKey: ['dtc'], queryFn: () => listDtc(20) });
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').trim();
  const swaggerUrl = `${apiBaseUrl.replace(/\/$/, '')}/docs`;
  const documentationUrl = `${apiBaseUrl.replace(/\/$/, '')}/redoc`;

  const totalVehicles = vehiclesQuery.data?.count ?? 0;
  const pendingAlerts = alertsQuery.data?.pending ?? 0;

  return (
    <section className="overview-page panel get-started-shell">
      <div className="panel-title-row">
        <h2>{t('getStarted.title')}</h2>
        {showWelcome && (
          <button className="btn-link" type="button" onClick={() => setShowWelcome(false)}>
            {t('common.close')}
          </button>
        )}
      </div>

      {showWelcome && (
        <article className="get-started-hero">
          <div className="get-started-hero-main">
            <p className="get-started-hero-kicker">Cloud Fleet Platform</p>
            <h3 className="get-started-hero-title">{t('getStarted.heroTitle')}</h3>
            <div className="get-started-hero-stats" aria-label="Fleet summary metrics">
              <div className="get-started-hero-stat">
                <strong>{totalVehicles}</strong>
                <span>{t('getStarted.vehicles')}</span>
              </div>
              <div className="get-started-hero-stat">
                <strong>{pendingAlerts}</strong>
                <span>{t('getStarted.openAlerts')}</span>
              </div>
              <div className="get-started-hero-stat">
                <strong>{dtcQuery.data?.count ?? 0}</strong>
                <span>{t('getStarted.activeDtc')}</span>
              </div>
            </div>
            <button className="get-started-hero-cta" type="button">{t('getStarted.guidance')} ↗</button>
          </div>
          <div className="get-started-hero-side">
            <p className="get-started-hero-kicker">{t('getStarted.activeConnector')}</p>
            <p className="get-started-hero-side-title">OBD-II</p>
            <p className="get-started-hero-side-sub">{t('getStarted.realtimeDiagnostics')}</p>
          </div>
        </article>
      )}

      <h3 className="get-started-section-title">{t('getStarted.shortcuts')}</h3>
      <div className="get-started-shortcuts">
        <a className="get-started-tile" href={documentationUrl} target="_blank" rel="noreferrer">
          <span>📘</span>
          <p>{t('getStarted.documentation')}</p>
        </a>
        <a className="get-started-tile" href={swaggerUrl} target="_blank" rel="noreferrer">
          <span>💻</span>
          <p>{t('getStarted.apiReference')}</p>
        </a>
      </div>

      <h3 className="get-started-section-title">{t('getStarted.telematics')}</h3>
      <h3 className="get-started-subtitle">{t('getStarted.realtimeVehicleIntel')}</h3>
      <article className="get-started-banner">
        <div className="get-started-banner-image" aria-hidden="true">{t('getStarted.device')}</div>
        <div>
          <h3>{t('getStarted.strugglingTitle')}</h3>
          <p>{t('getStarted.strugglingBody')}</p>
          
        </div>
      </article>

      <h3 className="get-started-section-title">{t('getStarted.business')}</h3>
      <h3 className="get-started-subtitle">{t('getStarted.iotSolutions')}</h3>
      <div className="get-started-business-grid">
        <article className="get-started-business-card">{t('getStarted.dataManagement')}</article>
        <article className="get-started-business-card">{t('getStarted.deviceManagement')}</article>
        <article className="get-started-business-card">{t('getStarted.streaming')}</article>
        <article className="get-started-business-card">{t('getStarted.vehicleTelematics')}</article>
      </div>

      <h3 className="get-started-section-title">{t('getStarted.blog')}</h3>
      <h3 className="get-started-subtitle">{t('getStarted.latestPosts')}</h3>
      <div className="get-started-blog-grid">
        <article className="get-started-blog-card"><h4>{t('getStarted.blogCanTitle')}</h4><p>{t('getStarted.blogCanBody')}</p></article>
        <article className="get-started-blog-card"><h4>{t('getStarted.blogPiTitle')}</h4><p>{t('getStarted.blogPiBody')}</p></article>
        <article className="get-started-blog-card"><h4>{t('getStarted.blogObdTitle')}</h4><p>{t('getStarted.blogObdBody')}</p></article>
      </div>
    </section>
  );
}
