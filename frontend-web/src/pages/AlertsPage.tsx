import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { ackAlert, deleteAlert, getAiRiskScore, listAlerts, listVehicles, resolveAlert } from '../lib/api/endpoints';
import { useI18n } from '../lib/i18n';

type SearchAliasRule = {
  key: string;
  synonyms: string[];
  signals: string[];
};

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

function normalizeSearchText(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesNormalizedQuery(source: string, query: string) {
  if (!query) return true;
  const words = normalizeSearchText(source)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  return words.some((word) => word.startsWith(query));
}

const SEARCH_ALIAS_RULES: SearchAliasRule[] = [
  {
    key: 'temperature',
    synonyms: ['temperature', 'temp', 'thermique', 'thermal', 'surchauffe', 'refroidissement', 'cooling'],
    signals: ['temperature', 'temp', 'thermal', 'thermique', 'surchauffe', 'cooling', 'refroid', 'engine over-temperature', 'device_cpu_temp', 'ambient_air_temp', 'intake_temp', 'engine_temp'],
  },
  {
    key: 'battery',
    synonyms: ['battery', 'batterie', 'voltage', 'tension', 'charge batterie'],
    signals: ['battery', 'batterie', 'voltage', 'tension', 'nominal_voltage', 'battery_voltage', 'battery_charge_level', 'system voltage low'],
  },
];

function buildAliasTokens(raw: string) {
  const text = normalizeSearchText(raw);
  if (!text) return '';

  const aliases = SEARCH_ALIAS_RULES
    .filter((rule) => rule.signals.some((signal) => text.includes(normalizeSearchText(signal))))
    .flatMap((rule) => [rule.key, ...rule.synonyms]);

  if (!aliases.length) return '';
  return normalizeSearchText(aliases.join(' '));
}

function resolveAliasKeys(raw: string) {
  const text = normalizeSearchText(raw);
  if (!text) return [] as string[];

  return SEARCH_ALIAS_RULES
    .filter((rule) => rule.signals.some((signal) => text.includes(normalizeSearchText(signal))))
    .map((rule) => rule.key);
}

function resolveQueryAliasKey(query: string) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return null;

  const matchedRule = SEARCH_ALIAS_RULES.find((rule) =>
    rule.synonyms.some((synonym) => {
      const normalizedSynonym = normalizeSearchText(synonym);
      return normalizedSynonym.startsWith(normalizedQuery) || normalizedQuery.startsWith(normalizedSynonym);
    }),
  );

  return matchedRule?.key ?? null;
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

  const normalizedTranslations = Object.entries(translations).reduce<Record<string, string>>((acc, [key, value]) => {
    acc[key.trim().toLowerCase()] = value;
    return acc;
  }, {});

  const translateCore = (input: string) => {
    const clean = input.replace(/\s+/g, ' ').trim();
    const lower = clean.toLowerCase();
    return normalizedTranslations[lower] ?? clean;
  };

  // Handles messages like "P0087: Fuel rail/system pressure too low".
  const dtcPrefixed = message.match(/^([A-Za-z]\d{4})\s*:\s*(.+)$/);
  if (dtcPrefixed) {
    const code = dtcPrefixed[1].toUpperCase();
    const translatedCore = translateCore(dtcPrefixed[2]);
    return `${code}: ${translatedCore}`;
  }

  return translateCore(message);
}

function formatAlertTitle(
  severity: string | null | undefined,
  type: string | undefined,
  locale: 'fr' | 'en',
  t: (key: string) => string,
) {
  return `${severityBadge(severity, t).toUpperCase()} - ${localizeAlertType(type, locale)}`;
}

function alertStateLabel(state: string | null | undefined, t: (key: string) => string) {
  const normalized = String(state ?? 'pending').trim().toLowerCase();
  if (normalized === 'resolved') return t('alerts.status.resolved');
  if (normalized === 'acknowledged') return t('alerts.status.acknowledged');
  return t('alerts.status.pending');
}

export function AlertsPage() {
  const queryClient = useQueryClient();
  const { t, locale } = useI18n();
  const [selectedVehicleFilter, setSelectedVehicleFilter] = useState('all');
  const [activeTab, setActiveTab] = useState<'all' | 'critical' | 'warning' | 'resolved'>('all');
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');

  const syncAlertInCache = (updatedAlert: { id: number; [key: string]: unknown }) => {
    queryClient.setQueryData(['alerts'], (current: { alerts?: Array<Record<string, unknown>> } | undefined) => {
      if (!current?.alerts) return current;
      return {
        ...current,
        alerts: current.alerts.map((item) => (item.id === updatedAlert.id ? { ...item, ...updatedAlert } : item)),
      };
    });
  };

  const removeAlertFromCache = (alertId: number) => {
    queryClient.setQueryData(['alerts'], (current: { alerts?: Array<Record<string, unknown>> } | undefined) => {
      if (!current?.alerts) return current;
      return {
        ...current,
        alerts: current.alerts.filter((item) => item.id !== alertId),
      };
    });
  };

  const alertsQuery = useQuery({ queryKey: ['alerts'], queryFn: listAlerts, refetchInterval: 10000 });
  const vehiclesQuery = useQuery({ queryKey: ['alerts-vehicle-filter'], queryFn: listVehicles, staleTime: 60_000 });
  const ackMutation = useMutation({
    mutationFn: ackAlert,
    onSuccess: (response: { alert?: { id: number; [key: string]: unknown } }) => {
      setActionError('');
      setActionMessage(t('alerts.message.acknowledged'));
      if (response?.alert) syncAlertInCache(response.alert);
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
    onError: (error) => {
      setActionMessage('');
      setActionError(getErrorMessage(error, t('alerts.requestFailed')));
    },
  });

  const resolveMutation = useMutation({
    mutationFn: resolveAlert,
    onSuccess: (response: { alert?: { id: number; [key: string]: unknown } }) => {
      setActionError('');
      setActionMessage(t('alerts.message.resolved'));
      if (response?.alert) syncAlertInCache(response.alert);
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
    onError: (error) => {
      setActionMessage('');
      setActionError(getErrorMessage(error, t('alerts.requestFailed')));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAlert,
    onSuccess: (response: { alert_id?: number }) => {
      setActionError('');
      setActionMessage(t('alerts.message.deleted'));
      if (typeof response?.alert_id === 'number') removeAlertFromCache(response.alert_id);
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
  const allVehicleOptions = (vehiclesQuery.data?.items ?? [])
    .filter((vehicle) => Number.isFinite(vehicle.id))
    .sort((a, b) => a.id - b.id);
  const vehicleFilterOptions = allVehicleOptions.length
    ? allVehicleOptions.map((vehicle) => ({
      id: vehicle.id,
      label: vehicle.license_plate ? vehicle.license_plate : `${t('alerts.item.vehicle')} ${vehicle.id}`,
    }))
    : [...vehicleIds].sort((a, b) => a - b).map((id) => ({ id, label: `${t('alerts.item.vehicle')} ${id}` }));

  const vehicleSearchIndex = useMemo(() => {
    const index = new Map<number, string>();
    allVehicleOptions.forEach((vehicle) => {
      const blob = [
        vehicle.license_plate,
        vehicle.make,
        vehicle.model,
        String(vehicle.year ?? ''),
        String(vehicle.id),
      ].join(' ');
      index.set(vehicle.id, normalizeSearchText(blob));
    });
    return index;
  }, [allVehicleOptions]);

  const aiRiskQueries = useQueries({
    queries: vehicleIds.map((vehicleId) => ({
      queryKey: ['ai-risk-score', vehicleId],
      queryFn: () => getAiRiskScore(vehicleId),
      retry: false,
      staleTime: 10_000,
      refetchInterval: 15000,
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

    const tabMatch = activeTab === 'all'
      || (activeTab === 'critical' && severityValue === 'critical')
      || (activeTab === 'warning' && severityValue === 'warning')
      || (activeTab === 'resolved' && stateValue === 'resolved');

    const vehicleMatch = selectedVehicleFilter === 'all' || String(item.vehicle_id) === selectedVehicleFilter;

    return tabMatch && vehicleMatch;
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

  const rowAck = (id: number) => {
    setActionError('');
    setActionMessage('');
    ackMutation.mutate({ alert_id: id });
  };

  const rowResolve = (id: number, currentNote?: string | null) => {
    const defaultValue = currentNote ?? '';
    const note = window.prompt(t('alerts.resolvePrompt'), defaultValue);
    if (note === null) return;

    const trimmedNote = note.trim();
    if (!trimmedNote) {
      setActionMessage('');
      setActionError(t('alerts.resolveNoteRequired'));
      return;
    }

    setActionError('');
    setActionMessage('');
    resolveMutation.mutate({ alert_id: id, note: trimmedNote });
  };

  const rowDelete = (id: number) => {
    if (deleteMutation.isPending) return;
    const confirmed = window.confirm(t('alerts.confirmDelete'));
    if (!confirmed) return;
    setActionError('');
    setActionMessage('');
    deleteMutation.mutate(id);
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
            <select
              className="ai-alerts-vehicle-select"
              value={selectedVehicleFilter}
              onChange={(event) => setSelectedVehicleFilter(event.target.value)}
              aria-label={t('alerts.feed.vehicleFilterLabel')}
            >
              <option value="all">{t('alerts.feed.vehicleAll')}</option>
              {vehicleFilterOptions.map((vehicle) => (
                <option key={vehicle.id} value={String(vehicle.id)}>
                  {vehicle.label}
                </option>
              ))}
            </select>
          </div>

          <div className="ai-alerts-feed-list">
            {alertsQuery.isLoading ? <p className="muted-note">{t('alerts.loading')}</p> : null}
            {!alertsQuery.isLoading && alerts.length === 0 ? <p className="muted-note">{t('alerts.empty')}</p> : null}

            {alerts.map((alert) => {
              const tone = normalizeSeverity(alert.severity);
              const risk = aiRiskByVehicleId[alert.vehicle_id] ?? null;
              const score = typeof risk?.predicted_risk_score === 'number' ? risk.predicted_risk_score.toFixed(1) : '0.0';
              const state = (alert.status ?? 'pending').toLowerCase();
              const stateTone = state === 'resolved' ? 'resolved' : state === 'acknowledged' ? 'acknowledged' : 'pending';

              return (
                <article key={alert.id} className={`ai-alert-row ${tone}`}>
                  <div className="ai-alert-row-main">
                    <div className="ai-alert-title-row">
                      <h4>{formatAlertTitle(alert.severity, alert.type, locale, t)}</h4>
                      <div className="ai-alert-badges">
                        <span className={`ai-alert-state-pill ${stateTone}`}>{alertStateLabel(state, t)}</span>
                        <span className={`ai-severity-pill ${tone}`}>{severityBadge(alert.severity, t)}</span>
                      </div>
                    </div>
                    <p className="ai-alert-message">{localizeAlertMessage(alert.message, locale) || t('alerts.item.noDetail')}</p>
                    {alert.note ? <p className="ai-alert-note"><strong>{t('alerts.item.noteLabel')}</strong> {alert.note}</p> : null}
                    <div className="ai-alert-meta">
                      <span>{formatRelative(alert.created_at, t)}</span>
                    </div>
                  </div>
                  <div className="ai-alert-side">
                    <span>{t('alerts.item.aiScore')}: {score}/100</span>
                    {state === 'pending' ? (
                      <>
                        <button type="button" className="inline-link-btn" onClick={() => rowAck(alert.id)}>{t('alerts.item.markRead')}</button>
                        <button type="button" className="inline-link-btn" onClick={() => rowResolve(alert.id, alert.note)}>{t('alerts.item.resolve')}</button>
                      </>
                    ) : null}
                    {state === 'acknowledged' ? (
                      <button type="button" className="inline-link-btn" onClick={() => rowResolve(alert.id, alert.note)}>{t('alerts.item.resolve')}</button>
                    ) : null}
                    <button type="button" className="inline-link-btn" onClick={() => rowDelete(alert.id)} disabled={deleteMutation.isPending}>{t('alerts.item.delete')}</button>
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

          <section className="panel ai-chart-panel">
            <h3>{t('alerts.chart.title')}</h3>
            <div className="ai-bars">
              {chartData.map((entry) => {
                const stackTotal = entry.critical + entry.warning + entry.info;
                const scale = stackTotal / maxStackValue;
                const criticalH = stackTotal > 0 ? Math.max(0, Math.round((entry.critical / stackTotal) * 100)) : 0;
                const warningH = stackTotal > 0 ? Math.max(0, Math.round((entry.warning / stackTotal) * 100)) : 0;
                const infoH = stackTotal > 0 ? Math.max(0, 100 - criticalH - warningH) : 0;

                return (
                  <div key={entry.key} className="ai-bar-col">
                    <div className="ai-bar-stack" style={{ height: stackTotal > 0 ? `${Math.round(88 * scale)}%` : '6%', opacity: stackTotal > 0 ? 1 : 0.15 }}>
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
