import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { getVehicleStatus, listVehicles } from '../lib/api/endpoints';

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
  const parsedVehicleId = Number(routeVehicleId);

  const vehiclesQuery = useQuery({
    queryKey: ['vehicles', 'status-page'],
    queryFn: listVehicles,
  });

  const vehicles = vehiclesQuery.data?.items ?? [];
  const vehicleIds = vehicles.map((item) => item.id);
  const hasVehicles = vehicleIds.length > 0;

  const routeIdIsValid = Number.isFinite(parsedVehicleId) && parsedVehicleId > 0;
  const routeIdExists = routeIdIsValid && vehicleIds.includes(parsedVehicleId);
  const vehicleId = hasVehicles ? (routeIdExists ? parsedVehicleId : vehicleIds[0]) : null;

  const hasInvalidRouteId = routeVehicleId !== undefined && !routeIdExists;

  const statusQuery = useQuery({
    queryKey: ['vehicle-status', vehicleId],
    queryFn: () => getVehicleStatus(vehicleId as number),
    enabled: vehicleId !== null,
  });

  const data = statusQuery.data as VehicleStatusPayload | undefined;
  const vehicle = data?.vehicle;
  const telemetry = data?.telemetry;

  return (
    <section>
      <h2>Vehicle Status</h2>
      <p className="subtitle">Consolidated live status: telemetry, active DTC and pending alerts.</p>

      {vehiclesQuery.isLoading && <p className="muted-note">Loading vehicles...</p>}
      {vehiclesQuery.isError && <p className="muted-note">Unable to load vehicles list.</p>}

      {!vehiclesQuery.isLoading && !vehiclesQuery.isError && !hasVehicles && (
        <p className="muted-note">No vehicles in database.</p>
      )}

      {!vehiclesQuery.isLoading && !vehiclesQuery.isError && hasVehicles && (
        <>
          {hasInvalidRouteId && <p className="muted-note">Invalid vehicle id in URL, showing first available vehicle.</p>}
          <p className="muted-note" style={{ marginTop: 0 }}>
            Existing vehicle IDs:{' '}
            {vehicleIds.map((id, index) => (
              <span key={id}>
                {index > 0 && ' | '}
                <Link className="inline-link" to={`/vehicle-status/${id}`}>{id}</Link>
              </span>
            ))}
          </p>
        </>
      )}

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