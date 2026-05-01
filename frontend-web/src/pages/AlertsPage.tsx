import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { ackAlert, getAiRiskScore, listAlerts } from '../lib/api/endpoints';

function getErrorMessage(error: unknown) {
  const data = (error as { response?: { data?: { message?: string; detail?: string } } })?.response?.data;
  return data?.message ?? data?.detail ?? 'Request failed.';
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

function severityBadge(value?: string | null) {
  const tone = normalizeSeverity(value);
  if (tone === 'critical') return 'Critique';
  if (tone === 'warning') return 'Avertiss.';
  return 'Info';
}

function formatRelative(value?: string | null) {
  if (!value) return '0';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const diff = Date.now() - parsed.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `il y a ${Math.max(1, minutes)} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days} j`;
}

export function AlertsPage() {
  const queryClient = useQueryClient();
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
      setActionMessage('Alert acknowledged.');
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
    onError: (error) => {
      setActionMessage('');
      setActionError(getErrorMessage(error));
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
        title: `${item.title || 'Alerte critique'} · V${item.vehicle_id}`,
        message: item.message || 'Intervention rapide recommandee.',
      }));

    const warningList = alerts
      .filter((item) => normalizeSeverity(item.severity) === 'warning')
      .slice(0, 1)
      .map((item) => ({
        tone: 'warning' as const,
        title: `${item.title || 'Avertissement'} · V${item.vehicle_id}`,
        message: item.message || 'Surveillance conseillee.',
      }));

    const stableInsight = {
      tone: 'ok' as const,
      title: 'Flotte globalement stable',
      message: criticalVisible === 0 ? 'Aucun risque critique detecte actuellement.' : 'Des alertes critiques restent ouvertes.',
    };

    return [...criticalList, ...warningList, stableInsight].slice(0, 4);
  }, [alerts, criticalVisible]);

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
    setActionMessage('Rafraichissement IA...');
    alertsQuery.refetch().then(async () => {
      await Promise.all(aiRiskQueries.map((query) => query.refetch()));
      setActionMessage('Analyse IA rafraichie.');
    }).catch((error) => {
      setActionMessage('');
      setActionError(getErrorMessage(error));
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
      setActionMessage(`${ids.length} alerte(s) marquee(s) comme lue(s).`);
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    } catch (error) {
      setActionError(getErrorMessage(error));
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
          <h2 className="ai-alerts-title">Alertes intelligentes</h2>
          <p className="ai-alerts-subtitle">Surveillance IA de la flotte · Moteur de detection v2.1</p>
        </div>
        <div className="ai-alerts-header-actions">
          <span className="ai-alerts-status-pill">Surveillance active</span>
          <button type="button" className="ai-alerts-btn" onClick={acknowledgeVisible} disabled={ackMutation.isPending}>Tout marquer lu</button>
          <button
            type="button"
            className="ai-alerts-btn"
            onClick={() => {
              const node = document.getElementById('ai-rules-panel');
              if (node) node.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          >
            Configurer les regles
          </button>
        </div>
      </div>

      <div className="ai-alerts-kpi-grid">
        <article className="ai-alerts-kpi-card critical">
          <p className="ai-alerts-kpi-label">Alertes critiques</p>
          <p className="ai-alerts-kpi-value">{stats.critical}</p>
          <p className="ai-alerts-kpi-note">Intervention requise</p>
        </article>
        <article className="ai-alerts-kpi-card warning">
          <p className="ai-alerts-kpi-label">Avertissements</p>
          <p className="ai-alerts-kpi-value">{stats.warning}</p>
          <p className="ai-alerts-kpi-note">A surveiller</p>
        </article>
        <article className="ai-alerts-kpi-card ok">
          <p className="ai-alerts-kpi-label">Resolues (7 jours)</p>
          <p className="ai-alerts-kpi-value">{stats.resolved7d}</p>
          <p className="ai-alerts-kpi-note">Taux resolution {stats.total ? Math.round((stats.resolved / Math.max(1, stats.total)) * 100) : 0}%</p>
        </article>
        <article className="ai-alerts-kpi-card fleet">
          <p className="ai-alerts-kpi-label">Score IA flotte</p>
          <p className="ai-alerts-kpi-value">{avgFleetAiScore}<span>/100</span></p>
          <p className="ai-alerts-kpi-note">Attention recommandee</p>
        </article>
      </div>

      <div className="ai-alerts-filter-row">
        <button type="button" className={`ai-tab-btn ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>Toutes ({alerts.length})</button>
        <button type="button" className={`ai-tab-btn ${activeTab === 'critical' ? 'active' : ''}`} onClick={() => setActiveTab('critical')}>Critiques ({criticalVisible})</button>
        <button type="button" className={`ai-tab-btn ${activeTab === 'warning' ? 'active' : ''}`} onClick={() => setActiveTab('warning')}>Avertissements ({warningVisible})</button>
        <button type="button" className={`ai-tab-btn ${activeTab === 'resolved' ? 'active' : ''}`} onClick={() => setActiveTab('resolved')}>Resolues ({resolvedVisible})</button>
        <input
          className="ai-alerts-search"
          placeholder="Chercher une alerte..."
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          onKeyDown={handleSearchKeyDown}
        />
        <button type="button" className="ai-search-btn" onClick={handleSearch}>Chercher</button>
      </div>

      {actionError && <p className="form-error">{actionError}</p>}
      {actionMessage && <p className="muted-note">{actionMessage}</p>}

      <div className="ai-alerts-main-grid">
        <section className="panel ai-alerts-feed-panel">
          <div className="ai-panel-header">
            <div>
              <h3>Fil des alertes</h3>
              <p>Triees par severite IA · {alerts.length} alertes</p>
            </div>
            <button type="button" className="ai-alerts-btn">Exporter</button>
          </div>

          <div className="ai-alerts-feed-list">
            {alertsQuery.isLoading ? <p className="muted-note">Chargement des alertes...</p> : null}
            {!alertsQuery.isLoading && alerts.length === 0 ? <p className="muted-note">Aucune alerte a afficher.</p> : null}

            {alerts.map((alert) => {
              const tone = normalizeSeverity(alert.severity);
              const risk = aiRiskByVehicleId[alert.vehicle_id] ?? null;
              const score = typeof risk?.predicted_risk_score === 'number' ? risk.predicted_risk_score.toFixed(1) : '0.0';

              return (
                <article key={alert.id} className={`ai-alert-row ${tone}`}>
                  <div className="ai-alert-row-main">
                    <div className="ai-alert-title-row">
                      <h4>{alert.title || alert.type || 'Alerte'}</h4>
                      <span className={`ai-severity-pill ${tone}`}>{severityBadge(alert.severity)}</span>
                    </div>
                    <p className="ai-alert-message">{alert.message || 'Detail indisponible'}</p>
                    <div className="ai-alert-meta">
                      <span>{formatRelative(alert.created_at)}</span>
                      <span className="ai-vehicle-chip">Vehicule {alert.vehicle_id}</span>
                    </div>
                  </div>
                  <div className="ai-alert-side">
                    <span>Score IA: {score}/10</span>
                    <button type="button" className="inline-link-btn" onClick={() => rowAck(alert.id)}>Marquer lu</button>
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
                <h3>Analyse IA de la flotte</h3>
                <p>Insights generes automatiquement</p>
              </div>
              <button type="button" className="ai-alerts-btn" onClick={handleRefreshAi}>Rafraichir</button>
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
            <button type="button" className="ai-insight-link">Analyse approfondie avec l'IA</button>
          </section>

          <section className="panel ai-rules-panel" id="ai-rules-panel">
            <h3>Regles de notification</h3>
            <div className="ai-rules-list">
              <label className="ai-rule-item">
                <div>
                  <strong>Temperature moteur {'>'} 90C</strong>
                  <p>SMS + Push immediat</p>
                </div>
                <input type="checkbox" checked={rules.engineTemp} onChange={() => toggleRule('engineTemp')} />
              </label>
              <label className="ai-rule-item">
                <div>
                  <strong>Code DTC detecte</strong>
                  <p>Email + Push</p>
                </div>
                <input type="checkbox" checked={rules.dtcDetected} onChange={() => toggleRule('dtcDetected')} />
              </label>
              <label className="ai-rule-item">
                <div>
                  <strong>Carburant {'<'} 25%</strong>
                  <p>Push uniquement</p>
                </div>
                <input type="checkbox" checked={rules.lowFuel} onChange={() => toggleRule('lowFuel')} />
              </label>
              <label className="ai-rule-item">
                <div>
                  <strong>Rappel revision annuelle</strong>
                  <p>Email 30j avant</p>
                </div>
                <input type="checkbox" checked={rules.revisionReminder} onChange={() => toggleRule('revisionReminder')} />
              </label>
            </div>
          </section>

          <section className="panel ai-chart-panel">
            <h3>Statistiques alertes (7 jours)</h3>
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
              <span><i className="critical" />Critiques</span>
              <span><i className="warning" />Avertiss.</span>
              <span><i className="info" />Info</span>
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}
