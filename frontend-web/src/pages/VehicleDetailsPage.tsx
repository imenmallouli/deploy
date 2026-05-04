import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteVehicle,
  getAiInsights,
  getAiRecommendations,
  getAiRiskScore,
  getVehicle,
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


export function VehicleDetailsPage() {
  const { vehicleId } = useParams();
  const queryClient = useQueryClient();
  const id = Number(vehicleId);

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
