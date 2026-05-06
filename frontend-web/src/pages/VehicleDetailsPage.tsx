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

function getErrorMessage(error: unknown): string {
  const maybeAxiosError = error as { response?: { data?: { message?: string; detail?: string } }; message?: string };
  const rawMessage = maybeAxiosError.response?.data?.message ?? maybeAxiosError.response?.data?.detail ?? maybeAxiosError.message ?? 'Request failed.';
  if (
    rawMessage.includes('Model file not found')
    || rawMessage.includes('AI model not found')
    || rawMessage.includes('Modele IA introuvable')
  ) {
    return 'AI model is not available yet. Run backend/scripts/train_alert_model.py and then click Refresh AI.';
  }
  return rawMessage;
}

function getStatusMeta(status?: string) {
  switch ((status ?? '').toLowerCase()) {
    case 'healthy':  return { label: 'Active',      cls: 'vd-badge vd-badge-active' };
    case 'warning':  return { label: 'Maintenance', cls: 'vd-badge vd-badge-warning' };
    case 'critical': return { label: 'Critical',    cls: 'vd-badge vd-badge-critical' };
    default:         return { label: 'Pending',     cls: 'vd-badge vd-badge-pending' };
  }
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
      setTaskSuccess("Fiche enregistrée. L'IA prend en compte cette intervention.");
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
      setTaskError(getErrorMessage(error));
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
  const statusMeta = getStatusMeta(vehicle?.status);
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
      setTaskError("Sélectionnez au moins un type d'intervention.");
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
        <h2 className="vd-page-title">Vehicle Details</h2>
        <p className="vd-page-sub">Technical card and assignment — vehicle #{vehicleId ?? '-'}</p>
      </div>

      {/* ── Identity + Assignment cards ── */}
      <div className="vd-info-row">
        {/* Identity */}
        <div className="vd-card">
          <p className="vd-card-label">Identity</p>
          <div className="vd-fields">
            <div className="vd-field">
              <span className="vd-field-key">VIN</span>
              <span className="vd-field-val">{vehicle?.vin ?? '-'}</span>
            </div>
            <div className="vd-field">
              <span className="vd-field-key">Plate</span>
              <span className="vd-field-val">{vehicle?.license_plate ?? '-'}</span>
            </div>
            <div className="vd-field">
              <span className="vd-field-key">Make</span>
              <span className="vd-field-val">{vehicle?.make ?? '-'} {vehicle?.model ?? ''}</span>
            </div>
            <div className="vd-field">
              <span className="vd-field-key">Year</span>
              <span className="vd-field-val">{vehicle?.year ?? '-'}</span>
            </div>
          </div>
        </div>

        {/* Assignment */}
        <div className="vd-card">
          <p className="vd-card-label">Assignment</p>
          <div className="vd-fields">
            <div className="vd-field">
              <span className="vd-field-key">Dongle ID</span>
              <span className="vd-field-val">{vehicle?.dongle_id ?? '-'}</span>
            </div>
            <div className="vd-field">
              <span className="vd-field-key">Status</span>
              <span className={statusMeta.cls}>{statusMeta.label}</span>
            </div>
            <div className="vd-field">
              <span className="vd-field-key">Mileage</span>
              <span className="vd-field-val">
                {vehicle?.mileage != null ? `${vehicle.mileage.toLocaleString()} km` : '-'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── AI Diagnostic ── */}
      <div className="vd-card vd-ai-card-outer">
        <div className="vd-ai-header">
          <div>
            <p className="vd-card-label">AI Diagnostic</p>
            <p className="vd-ai-sub">Risk score, recommendations and insights for this vehicle</p>
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
            ↺ Refresh AI
          </button>
        </div>

        <div className="vd-ai-cards">
          <div className="vd-ai-metric">
            <p className="vd-metric-title">RISK SCORE</p>
            {aiRiskQuery.isLoading ? (
              <p className="vd-metric-loading">Loading...</p>
            ) : aiRiskQuery.isError ? (
              <p className="vd-metric-error">{getErrorMessage(aiRiskQuery.error)}</p>
            ) : (
              <>
                <div className="vd-score-circle" style={{ borderColor: riskColor, color: riskColor }}>
                  <span className="vd-score-value">{riskScore != null ? riskScore.toFixed(1) : '-'}</span>
                  <span className="vd-score-denom">/100</span>
                </div>
                <p className="vd-metric-sub" style={{ color: riskColor }}>
                  {riskSeverity ?? '-'}
                </p>
              </>
            )}
          </div>

          <div className="vd-ai-metric">
            <p className="vd-metric-title">MAINTENANCE</p>
            {aiRecommendationsQuery.isLoading ? (
              <p className="vd-metric-loading">Loading...</p>
            ) : aiRecommendationsQuery.isError ? (
              <p className="vd-metric-error">{getErrorMessage(aiRecommendationsQuery.error)}</p>
            ) : aiRecommendationsQuery.data?.recommendations?.length ? (
              <ul className="vd-rec-list">
                {aiRecommendationsQuery.data.recommendations.slice(0, 3).map((item, index) => (
                  <li key={`${item.title}-${index}`}>
                    <strong>{item.title}</strong>
                    <span className="vd-rec-msg">{item.message}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="vd-metric-sub">No recommendations.</p>
            )}
          </div>

          <div className="vd-ai-metric">
            <p className="vd-metric-title">AI INSIGHTS</p>
            {aiInsightsQuery.isLoading ? (
              <p className="vd-metric-loading">Loading...</p>
            ) : aiInsightsQuery.isError ? (
              <p className="vd-metric-error">{getErrorMessage(aiInsightsQuery.error)}</p>
            ) : (
              <>
                <p className="vd-insight-line">
                  {aiInsightsQuery.data?.insights?.summary ?? 'No anomalies detected'}
                </p>
                {shouldShowNextAction && (
                  <p className="vd-insight-action">
                    Next: {nextAction}
                  </p>
                )}
                {aiInsightsQuery.data?.predicted_risks?.length ? (
                  <ul className="vd-rec-list">
                    {aiInsightsQuery.data.predicted_risks.slice(0, 2).map((risk, index) => (
                      <li key={`${risk.type}-${index}`}>
                        <strong>{risk.type}</strong>
                        <span className="vd-rec-msg">{risk.message}</span>
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
      <div style={{ background: '#141928', borderRadius: 16, padding: 24, marginTop: 20 }}>
        {/* Header */}
        <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#6b7fa3', letterSpacing: '.08em', textTransform: 'uppercase' }}>
          🔧 FICHE D'INTERVENTION
        </p>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#4a5a7a' }}>
          Enregistrez l'intervention réalisée. L'IA supprimera les alertes liées.
        </p>

        {/* TYPE D'INTERVENTION */}
        <div style={{ background: '#1e2538', borderRadius: 12, padding: '16px 20px', marginBottom: 12 }}>
          <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, color: '#6b7fa3', letterSpacing: '.08em', textTransform: 'uppercase' }}>
            ⚙ TYPE D'INTERVENTION
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
                    border: isSelected ? 'none' : '1px solid #2d3e5a',
                    background: isSelected ? '#e2e8f0' : 'transparent',
                    color: isSelected ? '#141928' : '#8898aa',
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
        <div style={{ background: '#1e2538', borderRadius: 12, padding: '16px 20px', marginBottom: 12 }}>
          <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, color: '#6b7fa3', letterSpacing: '.08em', textTransform: 'uppercase' }}>
            ⚠ CODES DTC RÉSOLUS
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              style={{ flex: 1, background: '#12172a', border: '1px solid #2d3e5a', borderRadius: 8, padding: '10px 14px', color: '#cbd5e1', fontSize: 14, outline: 'none' }}
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
              style={{ background: '#e2e8f0', color: '#141928', border: 'none', borderRadius: 8, padding: '10px 18px', fontWeight: 700, cursor: 'pointer', fontSize: 14, whiteSpace: 'nowrap' }}
              onMouseDown={(e) => {
                e.preventDefault(); // prevent input blur before click fires
                const input = e.currentTarget.previousElementSibling as HTMLInputElement | null;
                const raw = input?.value ?? taskDtcInput;
                const codes = raw.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean);
                if (codes.length) { setTaskDtcCodes((prev) => [...new Set([...prev, ...codes])]); setTaskDtcInput(''); }
              }}
            >
              + Ajouter
            </button>
          </div>
          {taskDtcCodes.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {taskDtcCodes.map((code) => (
                <span key={code} style={{ background: '#2d3e5a', color: '#cbd5e1', borderRadius: 6, padding: '4px 10px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {code}
                  <button type="button" onClick={() => setTaskDtcCodes((prev) => prev.filter((c) => c !== code))} style={{ background: 'none', border: 'none', color: '#8898aa', cursor: 'pointer', padding: 0, fontSize: 16, lineHeight: 1 }}>×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* DÉTAIL DE L'INTERVENTION */}
        <div style={{ background: '#1e2538', borderRadius: 12, padding: '16px 20px', marginBottom: 12 }}>
          <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, color: '#6b7fa3', letterSpacing: '.08em', textTransform: 'uppercase' }}>
            📋 DÉTAIL DE L'INTERVENTION
          </p>
          <p style={{ margin: '0 0 8px', fontSize: 13, color: '#8898aa' }}>Description des travaux</p>
          <textarea
            rows={3}
            placeholder="Ex: Vidange moteur avec huile 5W40, remplacement filtre à huile, nettoyage cache culbuteurs..."
            value={taskNote}
            onChange={(e) => setTaskNote(e.target.value)}
            style={{ width: '100%', background: '#12172a', border: '1px solid #2d3e5a', borderRadius: 8, padding: '10px 14px', color: '#cbd5e1', fontSize: 14, resize: 'vertical', boxSizing: 'border-box', outline: 'none' }}
          />
          <p style={{ margin: '14px 0 8px', fontSize: 13, color: '#8898aa' }}>Urgence / Criticité</p>
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
                  border: `1px solid ${taskUrgency === u.key ? '#e2e8f0' : '#2d3e5a'}`,
                  background: taskUrgency === u.key ? 'rgba(226,232,240,.12)' : 'transparent',
                  color: taskUrgency === u.key ? '#e2e8f0' : '#8898aa',
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
          <div style={{ background: '#1e2538', borderRadius: 12, padding: '16px 20px' }}>
            <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: '#6b7fa3', letterSpacing: '.08em', textTransform: 'uppercase' }}>
              👤 TECHNICIEN
            </p>
            <input
              placeholder="Nom du mécanicien"
              value={taskTechnicien}
              onChange={(e) => setTaskTechnicien(e.target.value)}
              style={{ width: '100%', background: '#12172a', border: '1px solid #2d3e5a', borderRadius: 8, padding: '10px 14px', color: '#cbd5e1', fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
            />
          </div>
          <div style={{ background: '#1e2538', borderRadius: 12, padding: '16px 20px' }}>
            <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: '#6b7fa3', letterSpacing: '.08em', textTransform: 'uppercase' }}>
              📅 DATE D'INTERVENTION
            </p>
            <input
              type="date"
              value={taskDate}
              onChange={(e) => setTaskDate(e.target.value)}
              style={{ width: '100%', background: '#12172a', border: '1px solid #2d3e5a', borderRadius: 8, padding: '10px 14px', color: '#cbd5e1', fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
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
            background: '#1e2538',
            border: '1px solid #2d3e5a',
            borderRadius: 10,
            color: '#cbd5e1',
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          📋 {createTaskMutation.isPending ? 'Enregistrement...' : 'Enregistrer la fiche'}
        </button>

        {/* ── Saved Maintenance Tasks ── */}
        <div style={{ marginTop: 24 }}>
          <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, color: '#6b7fa3', letterSpacing: '.08em', textTransform: 'uppercase' }}>
            🗂 HISTORIQUE DES INTERVENTIONS
          </p>
          {maintenanceQuery.isLoading ? (
            <p className="vd-metric-loading">Chargement...</p>
          ) : maintenanceItems.length === 0 ? (
            <p style={{ color: '#4a5a7a', fontSize: 13 }}>Aucune intervention enregistrée pour ce véhicule.</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {maintenanceItems.map((item) => (
                <li key={item.id} style={{ background: '#1e2538', borderRadius: 10, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontWeight: 700, color: '#cbd5e1', fontSize: 14 }}>
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
                      onClick={() => { if (window.confirm('Supprimer cette intervention ?')) { deleteTaskMutation.mutate(item.id); } }}
                      style={{ fontSize: 12, color: '#f87171' }}
                    >
                      Supprimer
                    </button>
                  </div>
                  <span style={{ fontSize: 12, color: '#6b7fa3' }}>
                    {item.technicien ? `👤 ${item.technicien}` : ''}
                    {item.date_intervention ? ` • 📅 ${item.date_intervention}` : ''}
                  </span>
                  {!!item.resolved_dtc_codes?.length && (
                    <span style={{ fontSize: 12, color: '#8898aa' }}>DTC résolus : {item.resolved_dtc_codes.join(', ')}</span>
                  )}
                  {!!item.note && <span style={{ fontSize: 12, color: '#8898aa' }}>{item.note}</span>}
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
          {deleteMutation.isPending ? 'Deleting…' : 'Delete Vehicle'}
        </button>
      </div>
    </section>
  );
}
