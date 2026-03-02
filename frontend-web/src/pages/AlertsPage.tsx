import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ackAlert, createAlert, listAlerts, listAlertsByVehicle } from '../lib/api/endpoints';

export function AlertsPage() {
  const queryClient = useQueryClient();
  const [vehicleId, setVehicleId] = useState(1);
  const [type, setType] = useState('engine');
  const [severity, setSeverity] = useState('warning');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [filterByVehicle, setFilterByVehicle] = useState(false);

  const alertsQuery = useQuery({
    queryKey: ['alerts', filterByVehicle, vehicleId],
    queryFn: () => (filterByVehicle ? listAlertsByVehicle(vehicleId) : listAlerts()),
  });
  const createMutation = useMutation({
    mutationFn: createAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      setTitle('');
      setMessage('');
    },
  });
  const ackMutation = useMutation({
    mutationFn: ackAlert,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  });

  const alerts = alertsQuery.data?.alerts ?? [];

  return (
    <section>
      <h2>Alerts</h2>
      <p className="subtitle">Filter, create and acknowledge operational alerts.</p>
      <div className="panel form-grid">
        <h3>List Alerts (GET)</h3>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={filterByVehicle}
            onChange={(e) => setFilterByVehicle(e.target.checked)}
          />
          Filter by vehicle endpoint (/api/v1/alerts/{'{vehicle_id}'})
        </label>
        {filterByVehicle ? (
          <input
            type="number"
            placeholder="Vehicle ID"
            value={vehicleId}
            onChange={(e) => setVehicleId(Number(e.target.value))}
          />
        ) : null}
      </div>

      <form className="panel form-grid" onSubmit={(e) => {
        e.preventDefault();
        createMutation.mutate({ vehicle_id: vehicleId, type, severity, title, message });
      }}>
        <h3>Create Alert (POST)</h3>
        <input type="number" placeholder="Vehicle ID" value={vehicleId} onChange={(e) => setVehicleId(Number(e.target.value))} required />
        <input placeholder="Type" value={type} onChange={(e) => setType(e.target.value)} required />
        <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
          <option value="info">info</option>
          <option value="warning">warning</option>
          <option value="critical">critical</option>
        </select>
        <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <textarea placeholder="Message" value={message} onChange={(e) => setMessage(e.target.value)} required />
        <button className="btn-primary" type="submit">Add Alert</button>
      </form>
      <div className="panel">
        {alertsQuery.isLoading ? <p>Loading alerts...</p> : null}
        <table className="vehicles-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Vehicle</th>
              <th>Severity</th>
              <th>Title</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((alert) => (
              <tr key={alert.id}>
                <td>{alert.id}</td>
                <td>{alert.vehicle_id}</td>
                <td>{alert.severity}</td>
                <td>{alert.title}</td>
                <td>{alert.status}</td>
                <td>
                  <button className="inline-link-btn" type="button" onClick={() => ackMutation.mutate({ alert_id: alert.id })}>
                    Ack (POST)
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
