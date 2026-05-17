import { useParams } from 'react-router-dom';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createMaintenanceRecord,
  deleteMaintenanceRecord,
  deleteVehicle,
  getAiInsights,
  getAiRecommendations,
  getAiRiskScore,
  getVehicle,
  listMaintenanceRecords,
} from '../lib/api/endpoints';
import { useI18n } from '../lib/i18n';

function getErrorMessage(error: unknown, locale: 'fr' | 'en'): string {
  const maybeAxiosError = error as { response?: { data?: { message?: string; detail?: string } }; message?: string };
  const rawMessage = maybeAxiosError.response?.data?.message ?? maybeAxiosError.response?.data?.detail ?? maybeAxiosError.message ?? (locale === 'fr' ? 'Echec de la requete.' : 'Request failed.');
  if (
    rawMessage.includes('Model file not found')
    || rawMessage.includes('AI model not found')
    || rawMessage.includes('Modele IA introuvable')
  ) {
    return locale === 'fr'
      ? "Le modele IA n'est pas encore disponible. Lancez backend/scripts/train_alert_model.py puis cliquez sur Rafraichir IA."
      : 'AI model is not available yet. Run backend/scripts/train_alert_model.py and then click Refresh AI.';
  }
  return rawMessage;
}

function getStatusMeta(status: string | undefined, locale: 'fr' | 'en') {
  const labels = locale === 'fr'
    ? { active: 'Actif', maintenance: 'Maintenance', critical: 'Critique', pending: 'En attente' }
    : { active: 'Active', maintenance: 'Maintenance', critical: 'Critical', pending: 'Pending' };
  switch ((status ?? '').toLowerCase()) {
    case 'healthy':  return { label: labels.active, cls: 'vd-badge vd-badge-active' };
    case 'warning':  return { label: labels.maintenance, cls: 'vd-badge vd-badge-warning' };
    case 'critical': return { label: labels.critical, cls: 'vd-badge vd-badge-critical' };
    default:         return { label: labels.pending, cls: 'vd-badge vd-badge-pending' };
  }
}

function formatRiskSeverity(value: string | undefined, locale: 'fr' | 'en') {
  const normalized = (value ?? '').toLowerCase();
  if (locale === 'fr') {
    if (normalized === 'critical') return 'Critique';
    if (normalized === 'warning') return 'Avertissement';
    if (normalized === 'info') return 'Information';
  }
  if (normalized === 'critical') return 'Critical';
  if (normalized === 'warning') return 'Warning';
  if (normalized === 'info') return 'Info';
  return value ?? '-';
}

function localizeAiMessage(message: string, locale: 'fr' | 'en') {
  if (locale !== 'fr') return message;
  return message
    .replace('Investigate and resolve', 'Verifier et corriger')
    .replace('System voltage low', 'Tension systeme basse')
    .replace('Engine over-temperature condition', 'Condition de surchauffe moteur')
    .replace('Fuel rail/system pressure too low', 'Pression carburant trop basse')
    .replace('Random/multiple cylinder misfire detected', 'Rattes d allumage detectes');
}

function getRiskColor(severity?: string): string {
  switch ((severity ?? '').toLowerCase()) {
    case 'critical': return '#dc2626';
    case 'warning':  return '#f59e0b';
    default:         return '#16a34a';
  }
}

const INTERVENTION_TYPES = [
  { key: 'oil_service',    label: 'Vidange' },
  { key: 'spark_plugs',    label: 'Bougies' },
  { key: 'battery_system', label: 'Batterie' },
  { key: 'air_filter',     label: 'Filtre à air' },
  { key: 'fuel_filter',    label: 'Filtre carburant' },
  { key: 'brakes',         label: 'Freins' },
  { key: 'belt_system',    label: 'Courroie' },
  { key: 'tires',          label: 'Pneus' },
  { key: 'liquids',        label: 'Liquides' },
  { key: 'other',          label: 'Autre' },
] as const;

type UrgencyLevel = 'routine' | 'attention' | 'critique';

export function VehicleDetailsPage() {
  const { locale } = useI18n();
  const { vehicleId } = useParams();
  const queryClient = useQueryClient();
  const id = Number(vehicleId);
  const [taskTypes, setTaskTypes] = useState<string[]>([]);
  const [taskDtcInput, setTaskDtcInput] = useState('');
  const [taskDtcCodes, setTaskDtcCodes] = useState<string[]>([]);
  const [taskNote, setTaskNote] = useState('');
  const [taskUrgency, setTaskUrgency] = useState<UrgencyLevel>('routine');
  const [taskTechnicien, setTaskTechnicien] = useState('');
  const [taskDate, setTaskDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [taskError, setTaskError] = useState('');
  const [taskSuccess, setTaskSuccess] = useState('');

  const vehicleQuery = useQuery({
    queryKey: ['vehicle', id],
    queryFn: () => getVehicle(id),
    enabled: Number.isFinite(id),
  });

  const aiRiskQuery = useQuery({
    queryKey: ['ai-risk-score', id],
    queryFn: () => getAiRiskScore(id),
    enabled: Number.isFinite(id),
    retry: false,
  });

  const aiRecommendationsQuery = useQuery({
    queryKey: ['ai-recommendations', id],
    queryFn: () => getAiRecommendations(id),
    enabled: Number.isFinite(id),
    retry: false,
  });

  const aiInsightsQuery = useQuery({
    queryKey: ['ai-insights', id],
    queryFn: () => getAiInsights(id),
    enabled: Number.isFinite(id),
    retry: false,
  });

  const maintenanceQuery = useQuery({
    queryKey: ['maintenance-records', id],
    queryFn: () => listMaintenanceRecords(id),
    enabled: Number.isFinite(id),
  });

  const createTaskMutation = useMutation({
    mutationFn: createMaintenanceRecord,
    onSuccess: () => {
      setTaskError('');
      setTaskSuccess(locale === 'fr' ? "Fiche enregistree. L'IA prend en compte cette intervention." : 'Record saved. AI now takes this intervention into account.');
      setTaskTypes([]);
      setTaskDtcInput('');
      setTaskDtcCodes([]);
      setTaskNote('');
      setTaskUrgency('routine');
      setTaskTechnicien('');
      setTaskDate(new Date().toISOString().slice(0, 10));
      queryClient.invalidateQueries({ queryKey: ['maintenance-records', id] });
      queryClient.invalidateQueries({ queryKey: ['ai-risk-score', id] });
      queryClient.invalidateQueries({ queryKey: ['ai-recommendations', id] });
      queryClient.invalidateQueries({ queryKey: ['ai-insights', id] });
    },
    onError: (error: unknown) => {
      setTaskSuccess('');
      setTaskError(getErrorMessage(error, locale));
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: deleteMaintenanceRecord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-records', id] });
      queryClient.invalidateQueries({ queryKey: ['ai-risk-score', id] });
      queryClient.invalidateQueries({ queryKey: ['ai-recommendations', id] });
      queryClient.invalidateQueries({ queryKey: ['ai-insights', id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteVehicle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      window.location.href = '/vehicles';
    },
  });

  const vehicle = vehicleQuery.data?.vehicle;
  const statusMeta = getStatusMeta(vehicle?.status, locale);
  const riskSeverity = aiRiskQuery.data?.predicted_severity;
  const riskScore = aiRiskQuery.data?.predicted_risk_score;
  const riskColor = getRiskColor(riskSeverity);
  const nextAction = aiInsightsQuery.data?.insights?.next_action?.trim();
  const hasPredictedRisks = (aiInsightsQuery.data?.predicted_risks?.length ?? 0) > 0;
  const shouldShowNextAction = Boolean(nextAction)
    && !(nextAction === 'Continuer la maintenance préventive normale.' && !hasPredictedRisks);
  const maintenanceItems = maintenanceQuery.data?.items ?? [];

  const handleCreateTask = () => {
    setTaskSuccess('');

    if (taskTypes.length === 0) {
      setTaskError(locale === 'fr' ? "Selectionnez au moins un type d'intervention." : 'Select at least one intervention type.');
      return;
    }

    setTaskError('');
    createTaskMutation.mutate({
      vehicle_id: id,
      component: taskTypes[0],
      serviced_at_odometer: 0,
      valid_for_km: 0,
      resolved_dtc_codes: taskDtcCodes,
      note: taskNote.trim() || undefined,
      technicien: taskTechnicien.trim() || undefined,
      urgency: taskUrgency,
      date_intervention: taskDate || undefined,
    });
  };

  return (
    <section className="vd-page">
      {/* ── Page header ── */}
      <div className="vd-page-header">
        <h2 className="vd-page-title">{locale === 'fr' ? 'Details vehicule' : 'Vehicle Details'}</h2>
        <p className="vd-page-sub">{locale === 'fr' ? `Fiche technique et affectation — vehicule #${vehicleId ?? '-'}` : `Technical card and assignment — vehicle #${vehicleId ?? '-'}`}</p>
      </div>

      {/* ── Identity + Assignment cards ── */}
      <div className="vd-info-row">
        {/* Identity */}
        <div className="vd-card">
          <p className="vd-card-label">{locale === 'fr' ? 'Identite' : 'Identity'}</p>
          <div className="vd-fields">
            <div className="vd-field">
              <span className="vd-field-key">VIN</span>
              <span className="vd-field-val">{vehicle?.vin ?? '-'}</span>
            </div>
            <div className="vd-field">
              <span className="vd-field-key">{locale === 'fr' ? 'Plaque' : 'Plate'}</span>
              <span className="vd-field-val">{vehicle?.license_plate ?? '-'}</span>
            </div>
            <div className="vd-field">
              <span className="vd-field-key">{locale === 'fr' ? 'Marque' : 'Make'}</span>
              <span className="vd-field-val">{vehicle?.make ?? '-'} {vehicle?.model ?? ''}</span>
            </div>
            <div className="vd-field">
              <span className="vd-field-key">{locale === 'fr' ? 'Annee' : 'Year'}</span>
              <span className="vd-field-val">{vehicle?.year ?? '-'}</span>
            </div>
          </div>
        </div>

        {/* Assignment */}
        <div className="vd-card">
          <p className="vd-card-label">{locale === 'fr' ? 'Affectation' : 'Assignment'}</p>
          <div className="vd-fields">
            <div className="vd-field">
              <span className="vd-field-key">Dongle ID</span>
              <span className="vd-field-val">{vehicle?.dongle_id ?? '-'}</span>
            </div>
            <div className="vd-field">
              <span className="vd-field-key">{locale === 'fr' ? 'Statut' : 'Status'}</span>
              <span className={statusMeta.cls}>{statusMeta.label}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── AI Diagnostic ── */}
      <div className="vd-card vd-ai-card-outer">
        <div className="vd-ai-header">
          <div>
            <p className="vd-card-label">{locale === 'fr' ? 'Diagnostic IA' : 'AI Diagnostic'}</p>
            <p className="vd-ai-sub">{locale === 'fr' ? 'Score de risque, recommandations et insights pour ce vehicule' : 'Risk score, recommendations and insights for this vehicle'}</p>
          </div>
          <button
            type="button"
            className="vd-refresh-btn"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['ai-risk-score', id] });
              queryClient.invalidateQueries({ queryKey: ['ai-recommendations', id] });
              queryClient.invalidateQueries({ queryKey: ['ai-insights', id] });
            }}
          >
            {locale === 'fr' ? '↺ Rafraichir IA' : '↺ Refresh AI'}
          </button>
        </div>

        <div className="vd-ai-cards">
          <div className="vd-ai-metric">
            <p className="vd-metric-title">{locale === 'fr' ? 'SCORE RISQUE' : 'RISK SCORE'}</p>
            {aiRiskQuery.isLoading ? (
              <p className="vd-metric-loading">{locale === 'fr' ? 'Chargement...' : 'Loading...'}</p>
            ) : aiRiskQuery.isError ? (
              <p className="vd-metric-error">{getErrorMessage(aiRiskQuery.error, locale)}</p>
            ) : (
              <>
                <div className="vd-score-circle" style={{ borderColor: riskColor, color: riskColor }}>
                  <span className="vd-score-value">{riskScore != null ? riskScore.toFixed(1) : '-'}</span>
                  <span className="vd-score-denom">/100</span>
                </div>
                <p className="vd-metric-sub" style={{ color: riskColor }}>
                  {formatRiskSeverity(riskSeverity, locale)}
                </p>
              </>
            )}
          </div>

          <div className="vd-ai-metric">
            <p className="vd-metric-title">MAINTENANCE</p>
            {aiRecommendationsQuery.isLoading ? (
              <p className="vd-metric-loading">{locale === 'fr' ? 'Chargement...' : 'Loading...'}</p>
            ) : aiRecommendationsQuery.isError ? (
              <p className="vd-metric-error">{getErrorMessage(aiRecommendationsQuery.error, locale)}</p>
            ) : aiRecommendationsQuery.data?.recommendations?.length ? (
              <ul className="vd-rec-list">
                {aiRecommendationsQuery.data.recommendations.slice(0, 3).map((item, index) => (
                  <li key={`${item.title}-${index}`}>
                    <strong>{item.title}</strong>
                    <span className="vd-rec-msg">{localizeAiMessage(item.message, locale)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="vd-metric-sub">{locale === 'fr' ? 'Aucune recommandation.' : 'No recommendations.'}</p>
            )}
          </div>

          <div className="vd-ai-metric">
            <p className="vd-metric-title">{locale === 'fr' ? 'INSIGHTS IA' : 'AI INSIGHTS'}</p>
            {aiInsightsQuery.isLoading ? (
              <p className="vd-metric-loading">{locale === 'fr' ? 'Chargement...' : 'Loading...'}</p>
            ) : aiInsightsQuery.isError ? (
              <p className="vd-metric-error">{getErrorMessage(aiInsightsQuery.error, locale)}</p>
            ) : (
              <>
                <p className="vd-insight-line">
                  {aiInsightsQuery.data?.insights?.summary ?? (locale === 'fr' ? 'Aucune anomalie detectee' : 'No anomalies detected')}
                </p>
                {shouldShowNextAction && (
                  <p className="vd-insight-action">
                    {locale === 'fr' ? 'Prochaine action:' : 'Next:'} {nextAction}
                  </p>
                )}
                {aiInsightsQuery.data?.predicted_risks?.length ? (
                  <ul className="vd-rec-list">
                    {aiInsightsQuery.data.predicted_risks.slice(0, 2).map((risk, index) => (
                      <li key={`${risk.type}-${index}`}>
                        <strong>{risk.type}</strong>
                        <span className="vd-rec-msg">{localizeAiMessage(risk.message, locale)}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Fiche d'Intervention ── */}
      <div style={{ background: '#f6f8fb', border: '1px solid #b8cfee', borderRadius: 16, padding: 24, marginTop: 20 }}>
        {/* Header */}
        <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#4f6a90', letterSpacing: '.08em', textTransform: 'uppercase' }}>
          {locale === 'fr' ? "🔧 FICHE D'INTERVENTION" : '🔧 INTERVENTION RECORD'}
        </p>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#4a6b90' }}>
          {locale === 'fr'
            ? "Enregistrez l'intervention realisee. L'IA supprimera les alertes liees."
            : 'Save completed intervention. AI will clear related alerts.'}
        </p>

        {/* TYPE D'INTERVENTION */}
        <div style={{ background: '#edf5ff', border: '1px solid #c8ddff', borderRadius: 12, padding: '16px 20px', marginBottom: 12 }}>
          <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, color: '#4f6a90', letterSpacing: '.08em', textTransform: 'uppercase' }}>
            {locale === 'fr' ? "⚙ TYPE D'INTERVENTION" : '⚙ INTERVENTION TYPE'}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {INTERVENTION_TYPES.map((type) => {
              const isSelected = taskTypes.includes(type.key);
              return (
                <button
                  key={type.key}
                  type="button"
                  onClick={() => setTaskTypes((prev) =>
                    prev.includes(type.key) ? prev.filter((t) => t !== type.key) : [...prev, type.key]
                  )}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 999,
                    border: isSelected ? '1px solid #7fb4ff' : '1px solid #b8cfee',
                    background: isSelected ? '#dcebff' : '#ffffff',
                    color: isSelected ? '#0f4dbd' : '#4a6b90',
                    fontSize: 13,
                    fontWeight: isSelected ? 700 : 400,
                    cursor: 'pointer',
                    transition: 'all .15s',
                  }}
                >
                  {type.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* CODES DTC RÉSOLUS */}
        <div style={{ background: '#edf5ff', border: '1px solid #c8ddff', borderRadius: 12, padding: '16px 20px', marginBottom: 12 }}>
          <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, color: '#4f6a90', letterSpacing: '.08em', textTransform: 'uppercase' }}>
            ⚠ CODES DTC RÉSOLUS
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              style={{ flex: 1, background: '#ffffff', border: '1px solid #b8cfee', borderRadius: 8, padding: '10px 14px', color: '#0f2f57', fontSize: 14, outline: 'none' }}
              placeholder="Ex: P0300, P0171..."
              value={taskDtcInput}
              onChange={(e) => setTaskDtcInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const val = e.currentTarget.value.trim();
                  if (!val) return;
                  const codes = val.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean);
                  if (codes.length) { setTaskDtcCodes((prev) => [...new Set([...prev, ...codes])]); setTaskDtcInput(''); }
                }
              }}
            />
            <button
              type="button"
              style={{ background: '#dcebff', color: '#0f4dbd', border: '1px solid #7fb4ff', borderRadius: 8, padding: '10px 18px', fontWeight: 700, cursor: 'pointer', fontSize: 14, whiteSpace: 'nowrap' }}
              onMouseDown={(e) => {
                e.preventDefault(); // prevent input blur before click fires
                const input = e.currentTarget.previousElementSibling as HTMLInputElement | null;
                const raw = input?.value ?? taskDtcInput;
                const codes = raw.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean);
                if (codes.length) { setTaskDtcCodes((prev) => [...new Set([...prev, ...codes])]); setTaskDtcInput(''); }
              }}
            >
              {locale === 'fr' ? '+ Ajouter' : '+ Add'}
            </button>
          </div>
          {taskDtcCodes.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {taskDtcCodes.map((code) => (
                <span key={code} style={{ background: '#dcebff', color: '#0f2f57', border: '1px solid #b8cfee', borderRadius: 6, padding: '4px 10px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {code}
                  <button type="button" onClick={() => setTaskDtcCodes((prev) => prev.filter((c) => c !== code))} style={{ background: 'none', border: 'none', color: '#4a6b90', cursor: 'pointer', padding: 0, fontSize: 16, lineHeight: 1 }}>×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* DÉTAIL DE L'INTERVENTION */}
        <div style={{ background: '#edf5ff', border: '1px solid #c8ddff', borderRadius: 12, padding: '16px 20px', marginBottom: 12 }}>
          <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, color: '#4f6a90', letterSpacing: '.08em', textTransform: 'uppercase' }}>
            {locale === 'fr' ? "📋 DETAIL DE L'INTERVENTION" : '📋 INTERVENTION DETAILS'}
          </p>
          <p style={{ margin: '0 0 8px', fontSize: 13, color: '#4a6b90' }}>{locale === 'fr' ? 'Description des travaux' : 'Work description'}</p>
          <textarea
            rows={3}
            placeholder={locale === 'fr' ? 'Ex: Vidange moteur avec huile 5W40, remplacement filtre a huile...' : 'Ex: Engine oil service with 5W40, oil filter replacement...'}
            value={taskNote}
            onChange={(e) => setTaskNote(e.target.value)}
            style={{ width: '100%', background: '#ffffff', border: '1px solid #b8cfee', borderRadius: 8, padding: '10px 14px', color: '#0f2f57', fontSize: 14, resize: 'vertical', boxSizing: 'border-box', outline: 'none' }}
          />
          <p style={{ margin: '14px 0 8px', fontSize: 13, color: '#4a6b90' }}>{locale === 'fr' ? 'Urgence / Criticite' : 'Urgency / Criticality'}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {([
              { key: 'routine'   as UrgencyLevel, label: '✓ Routine'    },
              { key: 'attention' as UrgencyLevel, label: 'ⓘ Attention'  },
              { key: 'critique'  as UrgencyLevel, label: '🔥 Critique'  },
            ]).map((u) => (
              <button
                key={u.key}
                type="button"
                onClick={() => setTaskUrgency(u.key)}
                style={{
                  padding: '10px',
                  borderRadius: 8,
                  border: `1px solid ${taskUrgency === u.key ? '#7fb4ff' : '#b8cfee'}`,
                  background: taskUrgency === u.key ? '#dcebff' : '#ffffff',
                  color: taskUrgency === u.key ? '#0f4dbd' : '#4a6b90',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: taskUrgency === u.key ? 700 : 400,
                  transition: 'all .15s',
                }}
              >
                {u.label}
              </button>
            ))}
          </div>
        </div>

        {/* TECHNICIEN + DATE */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div style={{ background: '#edf5ff', border: '1px solid #c8ddff', borderRadius: 12, padding: '16px 20px' }}>
            <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: '#4f6a90', letterSpacing: '.08em', textTransform: 'uppercase' }}>
              👤 TECHNICIEN
            </p>
            <input
              placeholder={locale === 'fr' ? 'Nom du mecanicien' : 'Mechanic name'}
              value={taskTechnicien}
              onChange={(e) => setTaskTechnicien(e.target.value)}
              style={{ width: '100%', background: '#ffffff', border: '1px solid #b8cfee', borderRadius: 8, padding: '10px 14px', color: '#0f2f57', fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
            />
          </div>
          <div style={{ background: '#edf5ff', border: '1px solid #c8ddff', borderRadius: 12, padding: '16px 20px' }}>
            <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: '#4f6a90', letterSpacing: '.08em', textTransform: 'uppercase' }}>
              📅 DATE D'INTERVENTION
            </p>
            <input
              type="date"
              value={taskDate}
              onChange={(e) => setTaskDate(e.target.value)}
              style={{ width: '100%', background: '#ffffff', border: '1px solid #b8cfee', borderRadius: 8, padding: '10px 14px', color: '#0f2f57', fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
            />
          </div>
        </div>

        {/* Feedback */}
        {taskError && <p style={{ color: '#f87171', margin: '0 0 10px', fontSize: 13 }}>{taskError}</p>}
        {taskSuccess && <p style={{ color: '#4ade80', margin: '0 0 10px', fontSize: 13 }}>{taskSuccess}</p>}

        {/* Save button */}
        <button
          type="button"
          onClick={handleCreateTask}
          disabled={createTaskMutation.isPending}
          style={{
            width: '100%',
            padding: '14px',
            background: '#dcebff',
            border: '1px solid #7fb4ff',
            borderRadius: 10,
            color: '#0f4dbd',
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          📋 {createTaskMutation.isPending ? (locale === 'fr' ? 'Enregistrement...' : 'Saving...') : (locale === 'fr' ? 'Enregistrer la fiche' : 'Save record')}
        </button>

        {/* ── Saved Maintenance Tasks ── */}
        <div style={{ marginTop: 24 }}>
          <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, color: '#4f6a90', letterSpacing: '.08em', textTransform: 'uppercase' }}>
            {locale === 'fr' ? '🗂 HISTORIQUE DES INTERVENTIONS' : '🗂 INTERVENTION HISTORY'}
          </p>
          {maintenanceQuery.isLoading ? (
            <p className="vd-metric-loading">{locale === 'fr' ? 'Chargement...' : 'Loading...'}</p>
          ) : maintenanceItems.length === 0 ? (
            <p style={{ color: '#4a6b90', fontSize: 13 }}>{locale === 'fr' ? 'Aucune intervention enregistree pour ce vehicule.' : 'No interventions recorded for this vehicle.'}</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {maintenanceItems.map((item) => (
                <li key={item.id} style={{ background: '#edf5ff', border: '1px solid #c8ddff', borderRadius: 10, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontWeight: 700, color: '#0f2f57', fontSize: 14 }}>
                      {item.component}
                      {item.urgency && item.urgency !== 'routine' && (
                        <span style={{ marginLeft: 8, fontSize: 12, color: item.urgency === 'critique' ? '#f87171' : '#f59e0b' }}>
                          {item.urgency === 'critique' ? '🔥 Critique' : 'ⓘ Attention'}
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      className="btn-link"
                      disabled={deleteTaskMutation.isPending}
                      onClick={() => { if (window.confirm(locale === 'fr' ? 'Supprimer cette intervention ?' : 'Delete this intervention?')) { deleteTaskMutation.mutate(item.id); } }}
                      style={{ fontSize: 12, color: '#f87171' }}
                    >
                      {locale === 'fr' ? 'Supprimer' : 'Delete'}
                    </button>
                  </div>
                  <span style={{ fontSize: 12, color: '#4a6b90' }}>
                    {item.technicien ? `👤 ${item.technicien}` : ''}
                    {item.date_intervention ? ` • 📅 ${item.date_intervention}` : ''}
                  </span>
                  {!!item.resolved_dtc_codes?.length && (
                    <span style={{ fontSize: 12, color: '#4a6b90' }}>{locale === 'fr' ? 'DTC resolus :' : 'Resolved DTC:'} {item.resolved_dtc_codes.join(', ')}</span>
                  )}
                  {!!item.note && <span style={{ fontSize: 12, color: '#4a6b90' }}>{item.note}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="vd-actions">
        <button
          type="button"
          className="vd-btn-danger"
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
        >
          {deleteMutation.isPending ? (locale === 'fr' ? 'Suppression…' : 'Deleting…') : (locale === 'fr' ? 'Supprimer vehicule' : 'Delete Vehicle')}
        </button>
      </div>
    </section>
  );
}
