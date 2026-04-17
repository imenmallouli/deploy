import { apiClient } from './client';
import type { AlertItem, ApiResult, DtcItem, Fleet, Vehicle } from './types';

type LoginPayload = { email: string; password: string };
type RegisterPayload = {
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  phone: string;
  password: string;
};

type AiMaintenanceSuggestion = {
  priority: string;
  title: string;
  message: string;
};

type AiInsight = {
  summary: string;
  priority: string;
  next_action: string;
};

type AiPredictedRisk = {
  type: string;
  severity: string;
  message: string;
  value?: number | null;
};

export type AiRiskScoreResponse = {
  status: string;
  vehicle_id: number;
  predicted_severity: string;
  predicted_risk_score: number;
  confidence?: number | null;
};

export type AiRecommendationsResponse = {
  status: string;
  vehicle_id: number;
  predicted_severity: string;
  predicted_risk_score: number;
  recommendations: AiMaintenanceSuggestion[];
};

export type AiInsightsResponse = {
  status: string;
  vehicle_id: number;
  predicted_severity: string;
  predicted_risk_score: number;
  insights: AiInsight;
  predicted_risks: AiPredictedRisk[];
};

export async function login(payload: LoginPayload) {
  const { data } = await apiClient.post('/api/v1/auth/login', payload);
  return data as ApiResult<{ access_token?: string; role?: string; email?: string; user_id?: number }>;
}

export async function register(payload: RegisterPayload) {
  const { data } = await apiClient.post('/api/v1/auth/register', payload);
  return data as ApiResult<{ access_token?: string; role?: string; email?: string; user_id?: number }>;
}

export async function listVehicles() {
  const { data } = await apiClient.get('/api/v1/vehicles');
  return data as ApiResult<{ items: Vehicle[]; count: number }>;
}

export async function createVehicle(payload: Partial<Vehicle>) {
  const { data } = await apiClient.post('/api/v1/vehicles', payload);
  return data as ApiResult<{ vehicle: Vehicle }>;
}

export async function getVehicle(vehicleId: number) {
  const { data } = await apiClient.get(`/api/v1/vehicles/${vehicleId}`);
  return data as ApiResult<{ vehicle: Vehicle }>;
}

export async function updateVehicle(vehicleId: number, payload: Partial<Vehicle>) {
  const { data } = await apiClient.put(`/api/v1/vehicles/${vehicleId}`, payload);
  return data as ApiResult<{ vehicle: Vehicle }>;
}

export async function deleteVehicle(vehicleId: number) {
  const { data } = await apiClient.delete(`/api/v1/vehicles/${vehicleId}`);
  return data as ApiResult<Record<string, never>>;
}

export async function getVehicleStatus(vehicleId: number) {
  const { data } = await apiClient.get(`/api/v1/vehicles/${vehicleId}/status`);
  return data;
}

export async function listFleets() {
  const { data } = await apiClient.get('/api/v1/fleets');
  return data as ApiResult<{ items: Fleet[]; count: number }>;
}

export async function createFleet(payload: Partial<Fleet>) {
  const { data } = await apiClient.post('/api/v1/fleets', payload);
  return data as ApiResult<{ fleet: Fleet }>;
}

export async function getFleet(fleetId: number) {
  const { data } = await apiClient.get(`/api/v1/fleets/${fleetId}`);
  return data as ApiResult<{ fleet: Fleet }>;
}

export async function listFleetVehicles(fleetId: number) {
  const { data } = await apiClient.get(`/api/v1/fleets/${fleetId}/vehicles`);
  return data as ApiResult<{ items: Vehicle[]; count: number; fleet_id: number }>;
}

export async function assignVehicleToFleet(fleetId: number, payload: { vehicle_id: number }) {
  const { data } = await apiClient.post(`/api/v1/fleets/${fleetId}/vehicles`, payload);
  return data as ApiResult<{ fleet_id: number; vehicle: Vehicle }>;
}

export async function updateFleet(fleetId: number, payload: Partial<Fleet>) {
  const { data } = await apiClient.put(`/api/v1/fleets/${fleetId}`, payload);
  return data as ApiResult<{ fleet: Fleet }>;
}

export async function deleteFleet(fleetId: number) {
  const { data } = await apiClient.delete(`/api/v1/fleets/${fleetId}`);
  return data as ApiResult<Record<string, never>>;
}

export async function listAlerts() {
  const { data } = await apiClient.get('/api/v1/alerts');
  return data as ApiResult<{ alerts: AlertItem[]; pending: number }>;
}

export async function listAlertsByVehicle(vehicleId: number) {
  const { data } = await apiClient.get(`/api/v1/alerts/${vehicleId}`);
  return data as ApiResult<{ alerts: AlertItem[]; pending: number }>;
}

export async function createAlert(payload: {
  vehicle_id: number;
  type: string;
  severity: string;
  title: string;
  message: string;
}) {
  const { data } = await apiClient.post('/api/v1/alerts', payload);
  return data as ApiResult<{ alert: AlertItem }>;
}

export async function ackAlert(payload: { alert_id: number; note?: string }) {
  const { data } = await apiClient.post('/api/v1/alerts/ack', payload);
  return data;
}

export async function listDtc(limit = 50) {
  const { data } = await apiClient.get('/api/v1/dtc', { params: { limit } });
  return data as ApiResult<{ items: DtcItem[]; count: number }>;
}

export async function pingDtc() {
  const { data } = await apiClient.get('/api/v1/dtc/ping');
  return data;
}

export async function listDtcByVehicle(vehicleId: number, limit = 50) {
  const { data } = await apiClient.get(`/api/v1/dtc/${vehicleId}`, { params: { limit } });
  return data as ApiResult<{ items: DtcItem[]; count: number; vehicle_id: number }>;
}

export async function getDtcHistory(dtcId: string) {
  const { data } = await apiClient.get(`/api/v1/dtc/${dtcId}/history`);
  return data;
}

export async function createDtc(payload: {
  vehicle_id: number;
  code: string;
  severity?: string;
  description?: string;
}) {
  const { data } = await apiClient.post('/api/v1/dtc', payload);
  return data;
}

export async function clearDtc(payload: { vehicle_id: number; dtc_code?: string }) {
  const { data } = await apiClient.post('/api/v1/dtc/clear', payload);
  return data;
}

export async function createObdRawPayload(payload: {
  vehicle_id: number;
  dongle_id?: string;
  payload: Record<string, unknown> | unknown[] | string;
  received_at?: string;
}) {
  const { data } = await apiClient.post('/api/v1/dtc/obd/raw', payload);
  return data;
}

export async function listObdRawPayloads(params: { limit?: number; vehicle_id?: number }) {
  const { data } = await apiClient.get('/api/v1/dtc/obd/raw', { params });
  return data;
}

export async function createIotLog(payload: {
  vehicle_id?: number;
  device_id: string;
  event_type: string;
  level?: string;
  message?: string;
  metadata?: Record<string, unknown>;
  event_at?: string;
}) {
  const { data } = await apiClient.post('/api/v1/dtc/iot/logs', payload);
  return data;
}

export async function listIotLogs(params: { limit?: number; vehicle_id?: number; device_id?: string }) {
  const { data } = await apiClient.get('/api/v1/dtc/iot/logs', { params });
  return data;
}

export async function getTelemetryHistory(params: {
  vehicle_id: number;
  start?: string;
  end?: string;
  interval?: string;
  metrics?: string[];
}) {
  const { vehicle_id, ...rest } = params;
  const { data } = await apiClient.get(`/api/v1/telemetry/${vehicle_id}`, { params: rest });
  return data;
}

export async function pingTelemetry() {
  const { data } = await apiClient.get('/api/v1/telemetry/ping');
  return data;
}

export async function createTelemetry(payload: {
  vehicle_id: number;
  ts?: string;
  speed?: number;
  rpm?: number;
  fuel_level?: number;
  engine_temp?: number;
  battery_voltage?: number;
}) {
  const { data } = await apiClient.post('/api/v1/telemetry', payload);
  return data;
}

export async function listGeofences(q?: string) {
  const { data } = await apiClient.get('/api/v1/geofences', { params: { q } });
  return data as ApiResult<{ items: Array<{ id: string; name: string; description?: string; on_enter?: string; on_exit?: string; vehicle_count?: number; center_lat?: number; center_lng?: number; radius_m?: number; enabled?: boolean }>; count: number }>;
}

export async function createGeofence(payload: { name: string; description?: string; on_enter?: string; on_exit?: string; vehicle_count?: number; center_lat?: number; center_lng?: number; radius_m?: number; enabled?: boolean }) {
  const { data } = await apiClient.post('/api/v1/geofences', payload);
  return data;
}

export async function updateGeofence(id: string, payload: { name?: string; description?: string; on_enter?: string; on_exit?: string; center_lat?: number; center_lng?: number; radius_m?: number; enabled?: boolean }) {
  const { data } = await apiClient.put(`/api/v1/geofences/${id}`, payload);
  return data;
}

export async function deleteGeofence(id: string) {
  const { data } = await apiClient.delete(`/api/v1/geofences/${id}`);
  return data;
}

export async function checkGeofences(payload: { vehicle_id?: number; latitude: number; longitude: number }) {
  const { data } = await apiClient.post('/api/v1/geofences/check', payload);
  return data as ApiResult<{ vehicle_id?: number; position: { latitude: number; longitude: number }; count: number; items: Array<{ geofence_id: string; name: string; distance_m: number; radius_m: number; inside: boolean; transition?: string }>; events: Array<Record<string, unknown>> }>;
}

export async function listGroups(q?: string) {
  const { data } = await apiClient.get('/api/v1/groups', { params: { q } });
  return data as ApiResult<{ items: Array<{ id: string; name: string; vehicle_count?: number }>; count: number }>;
}

export async function createGroup(payload: { name: string; vehicle_count?: number }) {
  const { data } = await apiClient.post('/api/v1/groups', payload);
  return data;
}

export async function listLocations(q?: string) {
  const { data } = await apiClient.get('/api/v1/locations', { params: { q } });
  return data as ApiResult<{ items: Array<{ id: string; name: string; type?: string; latitude?: number; longitude?: number }>; count: number }>;
}

export async function createLocation(payload: { name: string; type?: string; latitude?: number; longitude?: number }) {
  const { data } = await apiClient.post('/api/v1/locations', payload);
  return data;
}

export async function listDevices(q?: string) {
  const { data } = await apiClient.get('/api/v1/devices', { params: { q } });
  return data as ApiResult<{ items: Array<{ id: string; device_id: string; vehicle_id?: number; vin?: string; status?: string }>; count: number }>;
}

export async function createDevice(payload: { device_id: string; vehicle_id?: number; vin?: string; status?: string }) {
  const { data } = await apiClient.post('/api/v1/devices', payload);
  return data;
}

export async function getDevicesOverview() {
  const { data } = await apiClient.get('/api/v1/devices/overview');
  return data as ApiResult<{ total: number; online: number; offline: number; warning: number }>;
}

export async function getAiRiskScore(vehicleId: number) {
  const { data } = await apiClient.get(`/api/v1/ai/risk-score/${vehicleId}`);
  return data as AiRiskScoreResponse;
}

export async function getAiRecommendations(vehicleId: number) {
  const { data } = await apiClient.get('/api/v1/ai/recommendations', { params: { vehicle_id: vehicleId } });
  return data as AiRecommendationsResponse;
}

export async function getAiInsights(vehicleId: number) {
  const { data } = await apiClient.get('/api/v1/ai/insights', { params: { vehicle_id: vehicleId } });
  return data as AiInsightsResponse;
}
