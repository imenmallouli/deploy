import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { ackAlert, getAiRiskScore, listAlerts } from '../lib/api/endpoints';
import { useI18n } from '../lib/i18n';

function getErrorMessage(error: unknown, fallback = 'Request failed.') {
  const data = (error as { response?: { data?: { message?: string; detail?: string } } })?.response?.data;
  return data?.message ?? data?.detail ?? fallback;
}

function formatDate(value?: string | null) {
  if (!value) return '0';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return `${String(parsed.getDate()).padStart(2, '0')}/${String(parsed.getMonth() + 1).padStart(2, '0')} ${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`;
}

function normalizeSeverity(value?: string | null): 'critical' | 'warning' | 'info' {
  const severity = String(value ?? '').toLowerCase();
  if (severity === 'critical') return 'critical';
  if (severity === 'warning' || severity === 'high' || severity === 'medium') return 'warning';
  return 'info';
}

function severityBadge(value: string | null | undefined, t: (key: string) => string) {
  const tone = normalizeSeverity(value);
  if (tone === 'critical') return t('severity.critical');
  if (tone === 'warning') return t('severity.warning');
  return t('severity.info');
}

function formatRelative(value: string | null | undefined, t: (key: string) => string) {
  if (!value) return '0';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const diff = Date.now() - parsed.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return t('time.minutesAgo').replace('{value}', String(Math.max(1, minutes)));
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('time.hoursAgo').replace('{value}', String(hours));
  const days = Math.floor(hours / 24);
  return t('time.daysAgo').replace('{value}', String(days));
}

function localizeAlertType(rawType: string | undefined, locale: 'fr' | 'en') {
  const value = String(rawType ?? '').trim().toLowerCase();
  const labelsFr: Record<string, string> = {
    thermal_delta: 'ecart thermique',
    fuel: 'carburant',
    engine_load: 'charge moteur',
    dtc: 'code defaut',
    device_cpu_temp: 'temperature CPU',
    cooling: 'refroidissement',
  };
  const labelsEn: Record<string, string> = {
    thermal_delta: 'thermal delta',
    fuel: 'fuel',
    engine_load: 'engine load',
    dtc: 'DTC code',
    device_cpu_temp: 'CPU temperature',
    cooling: 'cooling',
  };

  if (!value) return locale === 'fr' ? 'alerte' : 'alert';
  const label = locale === 'fr' ? labelsFr[value] : labelsEn[value];
  return label ?? value.replace(/_/g, ' ');
}

function localizeAlertMessage(rawMessage: string | undefined, locale: 'fr' | 'en') {
  const message = String(rawMessage ?? '').trim();
  if (!message || locale === 'en') return message;

  const translations: Record<string, string> = {
    'Engine over-temperature condition': 'Condition de surchauffe moteur',
    'System voltage low': 'Tension systeme faible',
    'Fuel rail/system pressure too low': 'Pression carburant trop basse',
    'Random/multiple cylinder misfire detected': 'Rate moteur aleatoire/multi-cylindre detecte',
    'Fuel level low': 'Niveau de carburant faible',
    'High engine load': 'Charge moteur elevee',
    'Engine cooling issue detected': 'Probleme de refroidissement moteur detecte',
    'High CPU temperature detected': 'Temperature CPU elevee detectee',
  };

  return translations[message] ?? message;
}

function formatAlertTitle(
  severity: string | null | undefined,
  type: string | undefined,
  locale: 'fr' | 'en',
  t: (key: string) => string,
) {
  return `${severityBadge(severity, t).toUpperCase()} - ${localizeAlertType(type, locale)}`;
}

export function AlertsPage() {
  const queryClient = useQueryClient();
  const { t, locale } = useI18n();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'critical' | 'warning' | 'resolved'>('all');
  const [rules, setRules] = useState({
    engineTemp: true,
    dtcDetected: true,
    lowFuel: true,
    revisionReminder: false,
  });
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');

  const alertsQuery = useQuery({ queryKey: ['alerts'], queryFn: listAlerts });
  const ackMutation = useMutation({
    mutationFn: ackAlert,
    onSuccess: () => {
      setActionError('');
      setActionMessage(t('alerts.message.acknowledged'));
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
    onError: (error) => {
      setActionMessage('');
      setActionError(getErrorMessage(error, t('alerts.requestFailed')));
    },
  });

  const allAlerts = alertsQuery.data?.alerts ?? [];
  const vehicleIds = Array.from(
    new Set(
      allAlerts
        .map((item) => item.vehicle_id)
        .filter((id): id is number => Number.isFinite(id)),
    ),
  );

  const aiRiskQueries = useQueries({
    queries: vehicleIds.map((vehicleId) => ({
      queryKey: ['ai-risk-score', vehicleId],
      queryFn: () => getAiRiskScore(vehicleId),
      retry: false,
      staleTime: 60_000,
    })),
  });

  const aiRiskByVehicleId = vehicleIds.reduce<Record<number, { predicted_severity?: string; predicted_risk_score?: number }>>(
    (acc, vehicleId, index) => {
      const query = aiRiskQueries[index];
      if (query?.data) {
        acc[vehicleId] = {
          predicted_severity: query.data.predicted_severity,
          predicted_risk_score: query.data.predicted_risk_score,
        };
      }
      return acc;
    },
    {},
  );

  const avgFleetAiScore = useMemo(() => {
    const scores = Object.values(aiRiskByVehicleId)
      .map((item) => item.predicted_risk_score)
      .filter((score): score is number => typeof score === 'number' && Number.isFinite(score));

    if (!scores.length) return 0;
    return Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10;
  }, [aiRiskByVehicleId]);

  const now = Date.now();
  const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
  const resolved7d = allAlerts.filter((item) => {
    const state = (item.status ?? 'pending').toLowerCase();
    if (state !== 'resolved') return false;
    const createdAtMs = Date.parse(item.created_at ?? '');
    return !Number.isNaN(createdAtMs) && createdAtMs >= sevenDaysAgo;
  }).length;

  const stats = {
    total: allAlerts.length,
    critical: allAlerts.filter((item) => normalizeSeverity(item.severity) === 'critical').length,
    warning: allAlerts.filter((item) => normalizeSeverity(item.severity) === 'warning').length,
    info: allAlerts.filter((item) => normalizeSeverity(item.severity) === 'info').length,
    resolved: allAlerts.filter((item) => (item.status ?? '').toLowerCase() === 'resolved').length,
    resolved7d,
  };

  const alerts = allAlerts.filter((item) => {
    const stateValue = (item.status ?? 'pending').toLowerCase().trim();
    const severityValue = normalizeSeverity(item.severity);
    const typeValue = (item.type ?? '').toLowerCase();
    const vehicleValue = String(item.vehicle_id ?? '');
    const titleValue = (item.title ?? '').toLowerCase();
    const messageValue = (item.message ?? '').toLowerCase();
    const query = search.trim().toLowerCase();

    const tabMatch = activeTab === 'all'
      || (activeTab === 'critical' && severityValue === 'critical')
      || (activeTab === 'warning' && severityValue === 'warning')
      || (activeTab === 'resolved' && stateValue === 'resolved');

    const queryMatch = !query
      || typeValue.includes(query)
      || titleValue.includes(query)
      || messageValue.includes(query)
      || vehicleValue.includes(query)
      || String(severityValue).includes(query)
      || stateValue.includes(query);

    return tabMatch && queryMatch;
  });

  const criticalVisible = alerts.filter((item) => normalizeSeverity(item.severity) === 'critical').length;
  const warningVisible = alerts.filter((item) => normalizeSeverity(item.severity) === 'warning').length;
  const resolvedVisible = alerts.filter((item) => (item.status ?? '').toLowerCase() === 'resolved').length;

  const fleetInsights = useMemo(() => {
    const criticalList = alerts
      .filter((item) => normalizeSeverity(item.severity) === 'critical')
      .slice(0, 2)
      .map((item) => ({
        tone: 'critical' as const,
        title: `${formatAlertTitle(item.severity, item.type, locale, t)} · V${item.vehicle_id}`,
        message: localizeAlertMessage(item.message, locale) || t('alerts.insights.quickAction'),
      }));

    const warningList = alerts
      .filter((item) => normalizeSeverity(item.severity) === 'warning')
      .slice(0, 1)
      .map((item) => ({
        tone: 'warning' as const,
        title: `${formatAlertTitle(item.severity, item.type, locale, t)} · V${item.vehicle_id}`,
        message: localizeAlertMessage(item.message, locale) || t('alerts.insights.monitoringAdvised'),
      }));

    const stableInsight = {
      tone: 'ok' as const,
      title: t('fleet.stable'),
      message: criticalVisible === 0 ? t('fleet.noCritical') : t('fleet.criticalOpen'),
    };

    return [...criticalList, ...warningList, stableInsight].slice(0, 4);
  }, [alerts, criticalVisible, locale, t]);

  const chartData = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const current = new Date();
      current.setHours(0, 0, 0, 0);
      current.setDate(current.getDate() - (6 - index));
      return {
        key: current.toISOString().slice(0, 10),
        label: `${String(current.getDate()).padStart(2, '0')}/${String(current.getMonth() + 1).padStart(2, '0')}`,
        critical: 0,
        warning: 0,
        info: 0,
      };
    });

    allAlerts.forEach((item) => {
      const parsed = new Date(item.created_at ?? '');
      if (Number.isNaN(parsed.getTime())) return;
      const key = parsed.toISOString().slice(0, 10);
      const bucket = days.find((entry) => entry.key === key);
      if (!bucket) return;
      const tone = normalizeSeverity(item.severity);
      if (tone === 'critical') bucket.critical += 1;
      else if (tone === 'warning') bucket.warning += 1;
      else bucket.info += 1;
    });

    return days;
  }, [allAlerts]);

  const maxStackValue = Math.max(1, ...chartData.map((item) => item.critical + item.warning + item.info));

  const handleSearch = () => {
    setSearch(searchInput.trim());
  };

  const handleRefreshAi = () => {
    setActionError('');
    setActionMessage(t('alerts.message.refreshing'));
    alertsQuery.refetch().then(async () => {
      await Promise.all(aiRiskQueries.map((query) => query.refetch()));
      setActionMessage(t('alerts.message.refreshed'));
    }).catch((error) => {
      setActionMessage('');
      setActionError(getErrorMessage(error, t('alerts.requestFailed')));
    });
  };

  const handleSearchKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSearch();
    }
  };

  const acknowledgeVisible = async () => {
    const ids = alerts
      .filter((item) => (item.status ?? 'pending').toLowerCase() !== 'resolved')
      .map((item) => item.id);
    if (!ids.length || ackMutation.isPending) return;

    setActionError('');
    setActionMessage('');
    try {
      await Promise.all(ids.map((id) => ackAlert({ alert_id: id })));
      setActionMessage(`${ids.length} ${t('alerts.message.markedRead')}`);
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    } catch (error) {
      setActionError(getErrorMessage(error, t('alerts.requestFailed')));
    }
  };

  const toggleRule = (key: keyof typeof rules) => {
    setRules((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const rowAck = (id: number) => {
    setActionError('');
    setActionMessage('');
    ackMutation.mutate({ alert_id: id });
  };

  return (
    <section className="ai-alerts-page overview-page">
      <div className="ai-alerts-header-row">
        <div>
          <h2 className="ai-alerts-title">{t('alerts.title')}</h2>
          <p className="ai-alerts-subtitle">{t('alerts.subtitle')}</p>
        </div>
        <div className="ai-alerts-header-actions">
          <span className="ai-alerts-status-pill">{t('alerts.activeMonitoring')}</span>
          <button type="button" className="ai-alerts-btn" onClick={acknowledgeVisible} disabled={ackMutation.isPending}>{t('alerts.markAllRead')}</button>
          <button
            type="button"
            className="ai-alerts-btn"
            onClick={() => {
              const node = document.getElementById('ai-rules-panel');
              if (node) node.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          >
            {t('alerts.configureRules')}
          </button>
        </div>
      </div>

      <div className="ai-alerts-kpi-grid">
        <article className="ai-alerts-kpi-card critical">
          <p className="ai-alerts-kpi-label">{t('alerts.kpi.critical')}</p>
          <p className="ai-alerts-kpi-value">{stats.critical}</p>
          <p className="ai-alerts-kpi-note">{t('alerts.kpi.noteCritical')}</p>
        </article>
        <article className="ai-alerts-kpi-card warning">
          <p className="ai-alerts-kpi-label">{t('alerts.kpi.warning')}</p>
          <p className="ai-alerts-kpi-value">{stats.warning}</p>
          <p className="ai-alerts-kpi-note">{t('alerts.kpi.noteWarning')}</p>
        </article>
        <article className="ai-alerts-kpi-card info">
          <p className="ai-alerts-kpi-label">{t('alerts.kpi.info')}</p>
          <p className="ai-alerts-kpi-value">{stats.info}</p>
          <p className="ai-alerts-kpi-note">{t('alerts.kpi.noteInfo')}</p>
        </article>
        <article className="ai-alerts-kpi-card ok">
          <p className="ai-alerts-kpi-label">{t('alerts.kpi.resolved7d')}</p>
          <p className="ai-alerts-kpi-value">{stats.resolved7d}</p>
          <p className="ai-alerts-kpi-note">{t('alerts.kpi.noteResolvedRate')} {stats.total ? Math.round((stats.resolved / Math.max(1, stats.total)) * 100) : 0}%</p>
        </article>
        <article className="ai-alerts-kpi-card fleet">
          <p className="ai-alerts-kpi-label">{t('alerts.kpi.fleetScore')}</p>
          <p className="ai-alerts-kpi-value">{avgFleetAiScore}<span>/100</span></p>
          <p className="ai-alerts-kpi-note">{t('alerts.kpi.noteFleet')}</p>
        </article>
      </div>

      <div className="ai-alerts-filter-row">
        <button type="button" className={`ai-tab-btn ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>{t('alerts.tabs.all')} ({alerts.length})</button>
        <button type="button" className={`ai-tab-btn ${activeTab === 'critical' ? 'active' : ''}`} onClick={() => setActiveTab('critical')}>{t('alerts.tabs.critical')} ({criticalVisible})</button>
        <button type="button" className={`ai-tab-btn ${activeTab === 'warning' ? 'active' : ''}`} onClick={() => setActiveTab('warning')}>{t('alerts.tabs.warning')} ({warningVisible})</button>
        <button type="button" className={`ai-tab-btn ${activeTab === 'resolved' ? 'active' : ''}`} onClick={() => setActiveTab('resolved')}>{t('alerts.tabs.resolved')} ({resolvedVisible})</button>
        <input
          className="ai-alerts-search"
          placeholder={t('alerts.searchPlaceholder')}
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          onKeyDown={handleSearchKeyDown}
        />
        <button type="button" className="ai-search-btn" onClick={handleSearch}>{t('alerts.searchButton')}</button>
      </div>

      {actionError && <p className="form-error">{actionError}</p>}
      {actionMessage && <p className="muted-note">{actionMessage}</p>}

      <div className="ai-alerts-main-grid">
        <section className="panel ai-alerts-feed-panel">
          <div className="ai-panel-header">
            <div>
              <h3>{t('alerts.feed.title')}</h3>
              <p>{t('alerts.feed.sortedBy')} · {alerts.length} {t('alerts.feed.count')}</p>
            </div>
            <button type="button" className="ai-alerts-btn">{t('alerts.feed.export')}</button>
          </div>

          <div className="ai-alerts-feed-list">
            {alertsQuery.isLoading ? <p className="muted-note">{t('alerts.loading')}</p> : null}
            {!alertsQuery.isLoading && alerts.length === 0 ? <p className="muted-note">{t('alerts.empty')}</p> : null}

            {alerts.map((alert) => {
              const tone = normalizeSeverity(alert.severity);
              const risk = aiRiskByVehicleId[alert.vehicle_id] ?? null;
              const score = typeof risk?.predicted_risk_score === 'number' ? risk.predicted_risk_score.toFixed(1) : '0.0';

              return (
                <article key={alert.id} className={`ai-alert-row ${tone}`}>
                  <div className="ai-alert-row-main">
                    <div className="ai-alert-title-row">
                      <h4>{formatAlertTitle(alert.severity, alert.type, locale, t)}</h4>
                      <span className={`ai-severity-pill ${tone}`}>{severityBadge(alert.severity, t)}</span>
                    </div>
                    <p className="ai-alert-message">{localizeAlertMessage(alert.message, locale) || t('alerts.item.noDetail')}</p>
                    <div className="ai-alert-meta">
                      <span>{formatRelative(alert.created_at, t)}</span>
                      <span className="ai-vehicle-chip">{t('alerts.item.vehicle')} {alert.vehicle_id}</span>
                    </div>
                  </div>
                  <div className="ai-alert-side">
                    <span>{t('alerts.item.aiScore')}: {score}/100</span>
                    <button type="button" className="inline-link-btn" onClick={() => rowAck(alert.id)}>{t('alerts.item.markRead')}</button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <aside className="ai-alerts-right-grid">
          <section className="panel ai-insights-panel">
            <div className="ai-panel-header">
              <div>
                <h3>{t('alerts.insights.title')}</h3>
                <p>{t('alerts.insights.subtitle')}</p>
              </div>
              <button type="button" className="ai-alerts-btn" onClick={handleRefreshAi}>{t('alerts.refreshAi')}</button>
            </div>

            <div className="ai-insights-list">
              {fleetInsights.map((insight, index) => (
                <article key={`${insight.title}-${index}`} className="ai-insight-item">
                  <span className={`ai-insight-dot ${insight.tone}`} />
                  <div>
                    <strong>{insight.title}</strong>
                    <p>{insight.message}</p>
                  </div>
                </article>
              ))}
            </div>
            <button type="button" className="ai-insight-link">{t('alerts.insights.deepAnalysis')}</button>
          </section>

          <section className="panel ai-rules-panel" id="ai-rules-panel">
            <h3>{t('alerts.rules.title')}</h3>
            <div className="ai-rules-list">
              <label className="ai-rule-item">
                <div>
                  <strong>{t('alerts.rules.engineTempLabel')}</strong>
                  <p>{t('alerts.rules.engineTempDesc')}</p>
                </div>
                <input type="checkbox" checked={rules.engineTemp} onChange={() => toggleRule('engineTemp')} />
              </label>
              <label className="ai-rule-item">
                <div>
                  <strong>{t('alerts.rules.dtcLabel')}</strong>
                  <p>{t('alerts.rules.dtcDesc')}</p>
                </div>
                <input type="checkbox" checked={rules.dtcDetected} onChange={() => toggleRule('dtcDetected')} />
              </label>
              <label className="ai-rule-item">
                <div>
                  <strong>{t('alerts.rules.fuelLabel')}</strong>
                  <p>{t('alerts.rules.fuelDesc')}</p>
                </div>
                <input type="checkbox" checked={rules.lowFuel} onChange={() => toggleRule('lowFuel')} />
              </label>
              <label className="ai-rule-item">
                <div>
                  <strong>{t('alerts.rules.revisionLabel')}</strong>
                  <p>{t('alerts.rules.revisionDesc')}</p>
                </div>
                <input type="checkbox" checked={rules.revisionReminder} onChange={() => toggleRule('revisionReminder')} />
              </label>
            </div>
          </section>

          <section className="panel ai-chart-panel">
            <h3>{t('alerts.chart.title')}</h3>
            <div className="ai-bars">
              {chartData.map((entry) => {
                const stackTotal = entry.critical + entry.warning + entry.info;
                const scale = stackTotal / maxStackValue;
                const criticalH = Math.max(0, Math.round((entry.critical / Math.max(1, stackTotal)) * 100));
                const warningH = Math.max(0, Math.round((entry.warning / Math.max(1, stackTotal)) * 100));
                const infoH = Math.max(0, 100 - criticalH - warningH);

                return (
                  <div key={entry.key} className="ai-bar-col">
                    <div className="ai-bar-stack" style={{ height: `${Math.max(6, Math.round(88 * scale))}%` }}>
                      <span className="critical" style={{ height: `${criticalH}%` }} />
                      <span className="warning" style={{ height: `${warningH}%` }} />
                      <span className="info" style={{ height: `${infoH}%` }} />
                    </div>
                    <small>{entry.label}</small>
                  </div>
                );
              })}
            </div>
            <div className="ai-chart-legend">
              <span><i className="critical" />{t('alerts.chart.legend.critical')}</span>
              <span><i className="warning" />{t('alerts.chart.legend.warning')}</span>
              <span><i className="info" />{t('alerts.chart.legend.info')}</span>
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}
