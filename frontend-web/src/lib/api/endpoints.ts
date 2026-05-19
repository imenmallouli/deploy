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

export type AdminUserItem = {
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  phone?: string | null;
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

export type MaintenanceRecord = {
  id: string;
  vehicle_id: number;
  component: string;
  serviced_at_odometer: number;
  valid_for_km: number;
  resolved_dtc_codes: string[];
  note: string;
  technicien?: string | null;
  urgency?: string | null;
  date_intervention?: string | null;
  created_at?: string;
  created_by?: number;
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

export type AutoPiSettings = {
  enabled: boolean;
  email?: string | null;
  device_id?: string | null;
  mqtt_host: string;
  mqtt_port: number;
  qos: number;
  mqtt_username?: string | null;
  verbose: boolean;
  has_password: boolean;
  has_mqtt_password: boolean;
};

export async function login(payload: LoginPayload) {
  const { data } = await apiClient.post('/api/v1/auth/login', payload);
  return data as ApiResult<{ access_token?: string; role?: string; email?: string; user_id?: number }>;
}

export async function register(payload: RegisterPayload) {
  const { data } = await apiClient.post('/api/v1/auth/register', payload);
  return data as ApiResult<{ access_token?: string; role?: string; email?: string; user_id?: number }>;
}

export async function forgotPassword(payload: { email: string }) {
  const { data } = await apiClient.post('/api/v1/auth/forgot-password', payload);
  return data as ApiResult<{ email?: string }>;
}

export async function listUsers() {
  const { data } = await apiClient.get('/api/v1/auth/users');
  return data as ApiResult<{ items: AdminUserItem[]; count: number }>;
}

export async function createUserByAdmin(payload: RegisterPayload) {
  const { data } = await apiClient.post('/api/v1/auth/create-user', payload);
  return data as ApiResult<{ user_id?: number; email?: string; role?: string }>;
}

export async function setUserRoleByAdmin(userId: number, payload: { role: string }) {
  const { data } = await apiClient.post(`/api/v1/auth/role/${userId}`, payload);
  return data as ApiResult<{ user_id?: number; role?: string }>;
}

export async function resetUserPasswordByAdmin(userId: number, payload: { new_password: string }) {
  const { data } = await apiClient.post(`/api/v1/auth/reset-password/${userId}`, payload);
  return data as ApiResult<{ user_id?: number }>;
}

export async function deleteUserByAdmin(userId: number) {
  const { data } = await apiClient.delete(`/api/v1/auth/user/${userId}`);
  return data as ApiResult<{ user_id?: number }>;
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

export async function listMaintenanceRecords(vehicleId: number) {
  const { data } = await apiClient.get(`/api/v1/maintenance/${vehicleId}`);
  return data as ApiResult<{ items: MaintenanceRecord[]; count: number }>;
}

export async function createMaintenanceRecord(payload: {
  vehicle_id: number;
  component: string;
  serviced_at_odometer?: number;
  valid_for_km?: number;
  resolved_dtc_codes?: string[];
  note?: string;
  technicien?: string;
  urgency?: string;
  date_intervention?: string;
}) {
  const { data } = await apiClient.post('/api/v1/maintenance', payload);
  return data as ApiResult<{ item: MaintenanceRecord }>;
}

export async function deleteMaintenanceRecord(recordId: string) {
  const { data } = await apiClient.delete(`/api/v1/maintenance/${recordId}`);
  return data as ApiResult<Record<string, never>>;
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

export async function resolveAlert(payload: { alert_id: number; note?: string }) {
  const { data } = await apiClient.post('/api/v1/alerts/resolve', payload);
  return data;
}

export async function deleteAlert(alertId: number) {
  const { data } = await apiClient.delete(`/api/v1/alerts/${alertId}`);
  return data as ApiResult<{ alert_id: number }>;
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
  battery_charge_level?: number;
  nominal_voltage?: number;
  engine_load?: number;
  ambient_air_temp?: number;
  intake_temp?: number;
  odometer?: number;
  track_altitude?: number;
  course_over_ground?: number;
  satellites_used?: number;
  glonass_satellites_used?: number;
  temp_cpu?: number;
  cpu?: number;
  gpu?: number;
}) {
  const { data } = await apiClient.post('/api/v1/telemetry', payload);
  return data;
}

export async function listGeofences(q?: string) {
  const { data } = await apiClient.get('/api/v1/geofences', { params: { q } });
  return data as ApiResult<{ items: Array<{ id: string; name: string; description?: string; on_enter?: string; on_exit?: string; vehicle_count?: number; polygon?: number[][]; center_lat?: number; center_lng?: number; radius_m?: number; enabled?: boolean }>; count: number }>;
}

export async function createGeofence(payload: { name: string; description?: string; on_enter?: string; on_exit?: string; vehicle_count?: number; polygon?: number[][]; center_lat?: number; center_lng?: number; radius_m?: number; enabled?: boolean }) {
  const { data } = await apiClient.post('/api/v1/geofences', payload);
  return data;
}

export async function updateGeofence(id: string, payload: { name?: string; description?: string; on_enter?: string; on_exit?: string; polygon?: number[][]; center_lat?: number; center_lng?: number; radius_m?: number; enabled?: boolean }) {
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

export async function setupGeofenceMonitoring(payload: { geofence_id: string; vehicle_ids: number[]; notification_email: string }) {
  const { data } = await apiClient.post('/api/v1/geofences/monitoring/setup', payload);
  return data as ApiResult<{ config_id: string; message: string }>;
}

export async function listGeofenceVehiclePositions() {
  const { data } = await apiClient.get('/api/v1/geofences/vehicle-positions');
  return data as ApiResult<{ items: Array<{ id: string; vehicle_id: number; latitude: number; longitude: number; speed?: number; updated_at?: string }> }>;
}

export async function listGroups(q?: string) {
  const { data } = await apiClient.get('/api/v1/groups', { params: { q } });
  return data as ApiResult<{ items: Array<{ id: string; name: string; vehicle_count?: number }>; count: number }>;
}

export async function createGroup(payload: { name: string; vehicle_count?: number }) {
  const { data } = await apiClient.post('/api/v1/groups', payload);
  return data;
}

export async function deleteGroup(id: string) {
  const { data } = await apiClient.delete(`/api/v1/groups/${id}`);
  return data;
}

export async function updateGroup(id: string, payload: { name?: string }) {
  const { data } = await apiClient.put(`/api/v1/groups/${id}`, payload);
  return data;
}

export async function listLocations(q?: string) {
  const { data } = await apiClient.get('/api/v1/locations', { params: { q } });
  return data as ApiResult<{ items: Array<{ id: string; name: string; type?: string; notes?: string; contactEmail?: string; contactPhone?: string; address?: string; onEnter?: string; onExit?: string; latitude?: number; longitude?: number }>; count: number }>;
}

export async function createLocation(payload: { name: string; type?: string; notes?: string; contactEmail?: string; contactPhone?: string; address?: string; onEnter?: string; onExit?: string; latitude?: number; longitude?: number }) {
  const { data } = await apiClient.post('/api/v1/locations', payload);
  return data;
}

export async function updateLocation(id: string, payload: { name?: string; type?: string; notes?: string; contactEmail?: string; contactPhone?: string; address?: string; onEnter?: string; onExit?: string; latitude?: number; longitude?: number }) {
  const { data } = await apiClient.put(`/api/v1/locations/${id}`, payload);
  return data;
}

export async function deleteLocation(id: string) {
  const { data } = await apiClient.delete(`/api/v1/locations/${id}`);
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

export async function deleteDevice(id: string) {
  const { data } = await apiClient.delete(`/api/v1/devices/${id}`);
  return data as ApiResult<Record<string, never>>;
}

export async function getDevicesOverview() {
  const { data } = await apiClient.get('/api/v1/devices/overview');
  return data as ApiResult<{ total: number; online: number; offline: number; warning: number }>;
}

export async function getAutoPiSettings() {
  const { data } = await apiClient.get('/api/v1/autopi/settings');
  return data as AutoPiSettings;
}

export async function updateAutoPiSettings(payload: {
  enabled: boolean;
  email?: string;
  password?: string;
  device_id?: string;
  mqtt_host: string;
  mqtt_port: number;
  qos: number;
  mqtt_username?: string;
  mqtt_password?: string;
  verbose: boolean;
}) {
  const { data } = await apiClient.put('/api/v1/autopi/settings', payload);
  return data as ApiResult<{ settings: AutoPiSettings }>;
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
  const { data } = await apiClient.get('/api/v1/ai/summary', { params: { vehicle_id: vehicleId } });
  return data as AiInsightsResponse;
}
