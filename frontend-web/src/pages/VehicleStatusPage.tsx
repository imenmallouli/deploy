import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { getVehicleStatus } from '../lib/api/endpoints';

export function VehicleStatusPage() {
  const { vehicleId: routeVehicleId } = useParams();
  const [vehicleId, setVehicleId] = useState(Number(routeVehicleId ?? 1));

  const statusMutation = useMutation({
    mutationFn: getVehicleStatus,
  });

  return (
    <section>
      <h2>Vehicle Status</h2>
      <p className="subtitle">Consolidated live status: telemetry, active DTC and pending alerts.</p>
      <form className="panel form-grid" onSubmit={(e) => {
        e.preventDefault();
        statusMutation.mutate(vehicleId);
      }}>
        <h3>Load vehicle status (GET)</h3>
        <input type="number" value={vehicleId} onChange={(e) => setVehicleId(Number(e.target.value))} required />
        <button className="btn-primary" type="submit">Load Status</button>
      </form>
      <div className="panel">
        <pre className="json-preview">{JSON.stringify(statusMutation.data ?? {}, null, 2)}</pre>
      </div>
    </section>
  );
}
