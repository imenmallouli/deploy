export type ApiResult<T> = {
  status: 'success' | 'error';
  message?: string;
} & T;

export type Vehicle = {
  id: number;
  vin: string;
  license_plate: string;
  make: string;
  model: string;
  year: number;
  mileage: number;
  status: string;
  fleet_id?: number | null;
  driver_id?: number | null;
  dongle_id?: string | null;
  autopi_device_id?: string | null;
  autopi_unit_id?: string | null;
  last_connection?: string | null;
  last_autopi_seen?: string | null;
};

export type Fleet = {
  id: number;
  name: string;
  description?: string | null;
  manager_id?: number | null;
};

export type AlertItem = {
  id: number;
  vehicle_id: number;
  type: string;
  severity: string;
  title: string;
  message: string;
  status: string;
  created_at?: string | null;
  note?: string | null;
};

export type DtcItem = {
  id?: string;
  vehicle_id: number;
  code?: string;
  dtc_code?: string;
  severity?: string;
  description?: string;
  resolved?: boolean;
  created_at?: string;
};
