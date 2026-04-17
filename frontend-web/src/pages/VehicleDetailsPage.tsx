import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  deleteVehicle,
  getAiInsights,
  getAiRecommendations,
  getAiRiskScore,
  getVehicle,
  updateVehicle,
} from '../lib/api/endpoints';

function parseOptionalNumber(value: string): number | undefined {
  if (value.trim() === '') {
    return undefined;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : undefined;
}

function getErrorMessage(error: unknown): string {
  const maybeAxiosError = error as { response?: { data?: { message?: string; detail?: string } }; message?: string };
  return maybeAxiosError.response?.data?.message ?? maybeAxiosError.response?.data?.detail ?? maybeAxiosError.message ?? 'Request failed.';
}

function formatScore(value?: number | null): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '-';
  }
  return `${value.toFixed(1)} / 100`;
}

function formatPercent(value?: number | null): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '-';
  }
  return `${value.toFixed(1)}%`;
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

  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [status, setStatus] = useState('');
  const [vin, setVin] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [year, setYear] = useState('');
  const [mileage, setMileage] = useState('');
  const [fleetId, setFleetId] = useState('');
  const [dongleId, setDongleId] = useState('');
  const [autopiDeviceId, setAutopiDeviceId] = useState('');
  const [autopiUnitId, setAutopiUnitId] = useState('');
  const [formFeedback, setFormFeedback] = useState('');

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!Number.isFinite(id)) {
        throw new Error('Vehicle ID invalide');
      }

      const payload: Record<string, unknown> = {};

      if (status.trim() !== '') payload.status = status;

      if (vin.trim() !== '') payload.vin = vin;
      if (licensePlate.trim() !== '') payload.license_plate = licensePlate;
      if (make.trim() !== '') payload.make = make;
      if (model.trim() !== '') payload.model = model;

      const yearValue = parseOptionalNumber(year);
      if (yearValue !== undefined) payload.year = yearValue;

      const mileageValue = parseOptionalNumber(mileage);
      if (mileageValue !== undefined) payload.mileage = mileageValue;

      const fleetIdValue = parseOptionalNumber(fleetId);
      if (fleetIdValue !== undefined) payload.fleet_id = fleetIdValue;

      if (dongleId.trim() !== '') payload.dongle_id = dongleId;
      if (autopiDeviceId.trim() !== '') payload.autopi_device_id = autopiDeviceId;
      if (autopiUnitId.trim() !== '') payload.autopi_unit_id = autopiUnitId;

      return updateVehicle(id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle', id] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      setFormFeedback('Update réussi');
    },
    onError: (error: unknown) => {
      const maybeAxiosError = error as { response?: { data?: { message?: string; detail?: string } }; message?: string };
      const apiMessage = maybeAxiosError.response?.data?.message ?? maybeAxiosError.response?.data?.detail;
      const fallbackMessage = maybeAxiosError.message ?? 'Échec de mise à jour';
      setFormFeedback(apiMessage || fallbackMessage);
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

  return (
    <section>
      <h2>Vehicle Details</h2>
      <p className="subtitle">Technical card and assignment data for vehicle #{vehicleId ?? '-'}</p>

      <div className="panel details-grid">
        <div>
          <h3>Identity</h3>
          <ul>
            <li>VIN: {vehicle?.vin ?? '-'}</li>
            <li>Plate: {vehicle?.license_plate ?? '-'}</li>
            <li>Make / Model: {vehicle?.make ?? '-'} {vehicle?.model ?? ''}</li>
            <li>Year: {vehicle?.year ?? '-'}</li>
          </ul>
        </div>
        <div>
          <h3>Assignment</h3>
          <ul>
            
            <li>Dongle ID: {vehicle?.dongle_id ?? '-'}</li>
          </ul>
        </div>
      </div>

      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h3>AI Diagnostic</h3>
            <p className="subtitle">Latest AI risk score, recommendations and insights for this vehicle.</p>
          </div>
          <button
            type="button"
            className="btn-link"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['ai-risk-score', id] });
              queryClient.invalidateQueries({ queryKey: ['ai-recommendations', id] });
              queryClient.invalidateQueries({ queryKey: ['ai-insights', id] });
            }}
          >
            Refresh AI
          </button>
        </div>

        <div className="details-grid">
          <div>
            <h4>Risk Summary</h4>
            {aiRiskQuery.isLoading ? (
              <p className="subtitle">Loading AI risk score...</p>
            ) : aiRiskQuery.isError ? (
              <p className="subtitle">{getErrorMessage(aiRiskQuery.error)}</p>
            ) : (
              <ul>
                <li>Severity: {aiRiskQuery.data?.predicted_severity ?? '-'}</li>
                <li>Risk score: {formatScore(aiRiskQuery.data?.predicted_risk_score)}</li>
                <li>Confidence: {formatPercent(aiRiskQuery.data?.confidence)}</li>
              </ul>
            )}
          </div>

          <div>
            <h4>Maintenance Recommendations</h4>
            {aiRecommendationsQuery.isLoading ? (
              <p className="subtitle">Loading recommendations...</p>
            ) : aiRecommendationsQuery.isError ? (
              <p className="subtitle">{getErrorMessage(aiRecommendationsQuery.error)}</p>
            ) : aiRecommendationsQuery.data?.recommendations?.length ? (
              <ul>
                {aiRecommendationsQuery.data.recommendations.map((item, index) => (
                  <li key={`${item.title}-${index}`}>
                    <strong>{item.title}</strong> ({item.priority}) — {item.message}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="subtitle">No recommendation available.</p>
            )}
          </div>
        </div>

        <div>
          <h4>AI Insights</h4>
          {aiInsightsQuery.isLoading ? (
            <p className="subtitle">Loading insights...</p>
          ) : aiInsightsQuery.isError ? (
            <p className="subtitle">{getErrorMessage(aiInsightsQuery.error)}</p>
          ) : (
            <>
              <p><strong>Summary:</strong> {aiInsightsQuery.data?.insights?.summary ?? '-'}</p>
              <p><strong>Priority:</strong> {aiInsightsQuery.data?.insights?.priority ?? '-'}</p>
              <p><strong>Next action:</strong> {aiInsightsQuery.data?.insights?.next_action ?? '-'}</p>

              {aiInsightsQuery.data?.predicted_risks?.length ? (
                <ul>
                  {aiInsightsQuery.data.predicted_risks.map((risk, index) => (
                    <li key={`${risk.type}-${index}`}>
                      <strong>{risk.type}</strong> ({risk.severity}) — {risk.message}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="subtitle">No predicted risks returned.</p>
              )}
            </>
          )}
        </div>
      </div>

      <form className="panel form-grid" onSubmit={(e) => { e.preventDefault(); setFormFeedback(''); updateMutation.mutate(); }}>
        <h3>Update vehicle</h3>
        <input placeholder="VIN (17 caractères, ex: VF1AAAAA123456789)" value={vin} onChange={(e) => setVin(e.target.value)} />
        <input placeholder="License plate (ex: 12345-A-1)" value={licensePlate} onChange={(e) => setLicensePlate(e.target.value)} />
        <input placeholder="Make (ex: Renault)" value={make} onChange={(e) => setMake(e.target.value)} />
        <input placeholder="Model (ex: Clio 5)" value={model} onChange={(e) => setModel(e.target.value)} />
        <input type="number" placeholder="Year" value={year} onChange={(e) => setYear(e.target.value)} />
        <input type="number" placeholder="Mileage (ex: 125000)" value={mileage} onChange={(e) => setMileage(e.target.value)} />
        
        <input placeholder="ID dongle exact (ex: dongle_001)" value={dongleId} onChange={(e) => setDongleId(e.target.value)} />
      
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">choose a status </option>
          <option value="pending">pending</option>
          <option value="healthy">healthy</option>
          <option value="warning">warning</option>
          <option value="critical">critical</option>
        </select>
        <button type="submit" className="btn-primary" disabled={updateMutation.isPending}>
          {updateMutation.isPending ? 'Saving...' : 'Update'}
        </button>
        {formFeedback && <p className="subtitle">{formFeedback}</p>}
      </form>

      <div className="detail-actions">
        <button type="button" className="btn-danger" onClick={() => deleteMutation.mutate()}>
          DELETE Vehicle
        </button>
        <Link to={`/vehicle-status/${vehicleId ?? ''}`} className="btn-link">
          Go to Status
        </Link>
      </div>
    </section>
  );
}
