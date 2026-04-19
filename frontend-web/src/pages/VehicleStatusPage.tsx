import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { getVehicleStatus } from '../lib/api/endpoints';

type VehicleStatusPayload = {
  vehicle?: {
    vin?: string;
    license_plate?: string;
    make?: string;
    model?: string;
    status?: string;
    last_connection?: string;
  };
  telemetry?: {
    speed?: number;
    rpm?: number;
    fuel_level?: number;
    engine_temp?: number;
    battery_voltage?: number;
  } | null;
  active_dtc_count?: number;
  active_alerts?: number;
  last_update?: string;
};

export function VehicleStatusPage() {
  const { vehicleId: routeVehicleId } = useParams();
  const vehicleId = Number(routeVehicleId);

  const statusQuery = useQuery({
    queryKey: ['vehicle-status', vehicleId],
    queryFn: () => getVehicleStatus(vehicleId),
    enabled: Number.isFinite(vehicleId) && vehicleId > 0,
  });

  const data = statusQuery.data as VehicleStatusPayload | undefined;
  const vehicle = data?.vehicle;
  const telemetry = data?.telemetry;

  if (!Number.isFinite(vehicleId) || vehicleId <= 0) {
    return (
      <section>
        <h2>Vehicle Status</h2>
        <p className="muted-note">Invalid vehicle id in URL.</p>
      </section>
    );
  }

  return (
    <section>
      <h2>Vehicle Status</h2>
      <p className="subtitle">Consolidated live status: telemetry, active DTC and pending alerts.</p>

      {statusQuery.isLoading && <p className="muted-note">Loading vehicle status...</p>}
      {statusQuery.isError && <p className="muted-note">Unable to load vehicle status.</p>}

      {!statusQuery.isLoading && !statusQuery.isError && (
        <>
          <div className="panel">
            <h3>Vehicle</h3>
            <div className="toolbar-row" style={{ marginBottom: 0, gap: 24, flexWrap: 'wrap' }}>
              <p className="muted-note" style={{ margin: 0 }}><strong>ID:</strong> {vehicleId}</p>
              <p className="muted-note" style={{ margin: 0 }}><strong>VIN:</strong> {vehicle?.vin ?? '-'}</p>
              <p className="muted-note" style={{ margin: 0 }}><strong>Plate:</strong> {vehicle?.license_plate ?? '-'}</p>
              <p className="muted-note" style={{ margin: 0 }}><strong>Model:</strong> {[vehicle?.make, vehicle?.model].filter(Boolean).join(' ') || '-'}</p>
              <p className="muted-note" style={{ margin: 0 }}><strong>Status:</strong> {vehicle?.status ?? '-'}</p>
              <p className="muted-note" style={{ margin: 0 }}><strong>Last update:</strong> {data?.last_update ?? vehicle?.last_connection ?? '-'}</p>
            </div>
          </div>

          <div className="panel table-shell">
            <h3>Health Summary</h3>
            <table className="vehicles-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Active DTC</td>
                  <td>{data?.active_dtc_count ?? 0}</td>
                </tr>
                <tr>
                  <td>Active Alerts</td>
                  <td>{data?.active_alerts ?? 0}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="panel table-shell">
            <h3>Telemetry</h3>
            <table className="vehicles-table">
              <thead>
                <tr>
                  <th>Speed</th>
                  <th>RPM</th>
                  <th>Fuel</th>
                  <th>Engine Temp</th>
                  <th>Battery</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{telemetry?.speed ?? '-'}</td>
                  <td>{telemetry?.rpm ?? '-'}</td>
                  <td>{telemetry?.fuel_level ?? '-'}</td>
                  <td>{telemetry?.engine_temp ?? '-'}</td>
                  <td>{telemetry?.battery_voltage ?? '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
