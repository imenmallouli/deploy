import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  clearDtc,
  createDtc,
  getDtcHistory,
  listDtc,
  listDtcByVehicle,
  pingDtc,
} from '../lib/api/endpoints';

export function DtcPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [range] = useState('02/Feb/2026 00:00 - Now');
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [vehicleId, setVehicleId] = useState(1);
  const [code, setCode] = useState('P0420');
  const [severity, setSeverity] = useState('warning');
  const [description, setDescription] = useState('');
  const [dtcHistoryId, setDtcHistoryId] = useState('P0420');

  const dtcQuery = useQuery({ queryKey: ['dtc'], queryFn: () => listDtc(100) });
  const pingMutation = useMutation({ mutationFn: pingDtc });
  const byVehicleMutation = useMutation({ mutationFn: ({ id, limit }: { id: number; limit?: number }) => listDtcByVehicle(id, limit ?? 100) });
  const historyMutation = useMutation({ mutationFn: getDtcHistory });
  const createMutation = useMutation({
    mutationFn: createDtc,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dtc'] }),
  });
  const clearMutation = useMutation({
    mutationFn: clearDtc,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dtc'] }),
  });

  const rows = (dtcQuery.data?.items ?? [])
    .filter((item) => {
      const codeValue = String(item.code ?? item.dtc_code ?? '').toLowerCase();
      const descValue = String(item.description ?? '').toLowerCase();
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return codeValue.includes(q) || descValue.includes(q);
    })
    .map((item) => {
      const firstOccurrence = (item as { first_detected?: string; created_at?: string }).first_detected
        ?? item.created_at
        ?? '-';
      const lastOccurrence = (item as { last_occurrence?: string; created_at?: string }).last_occurrence
        ?? item.created_at
        ?? '-';
      const count = (item as { occurrence_count?: number }).occurrence_count ?? 1;
      return {
        ...item,
        firstOccurrence,
        lastOccurrence,
        count,
      };
    });

  return (
    <section>
      <h2>Diagnostics</h2>

      <div className="panel diagnostics-shell">
        <div className="diagnostics-toolbar">
          <input
            className="toolbar-input"
            placeholder="Search for code"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <input className="toolbar-input diagnostics-date" value={range} readOnly />
          <button className="btn-primary" type="button">Search</button>
          <button className="btn-link" type="button" onClick={() => setAdvancedOpen((v) => !v)}>
            {advancedOpen ? 'Hide DTC tools' : 'Show DTC tools'}
          </button>
        </div>

        <table className="vehicles-table diagnostics-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Description</th>
              <th>Vehicle</th>
              <th>First occurrence</th>
              <th>Last occurrence</th>
              <th>Count</th>
              <th>State</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="empty-cell">No data to display</td>
              </tr>
            )}
            {rows.map((item, index) => (
              <tr key={`${item.code ?? item.dtc_code}-${index}`}>
                <td>{item.code ?? item.dtc_code ?? '-'}</td>
                <td>{item.description ?? '-'}</td>
                <td>{item.vehicle_id}</td>
                <td>{item.firstOccurrence}</td>
                <td>{item.lastOccurrence}</td>
                <td>{item.count}</td>
                <td>{item.resolved ? 'resolved' : 'active'}</td>
                <td className="actions-cell">
                  <button
                    className="inline-link-btn"
                    type="button"
                    onClick={() => {
                      const rowCode = item.code ?? item.dtc_code;
                      if (rowCode) {
                        setDtcHistoryId(String(rowCode));
                        historyMutation.mutate(String(rowCode));
                      }
                    }}
                  >
                    History
                  </button>
                  <button
                    className="inline-danger"
                    type="button"
                    onClick={() => clearMutation.mutate({ vehicle_id: item.vehicle_id, dtc_code: item.code ?? item.dtc_code })}
                  >
                    Clear
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="muted-note">{rows.length} total</p>

        {advancedOpen && (
          <div className="panel form-grid" style={{ marginTop: 12 }}>
            <h3>Advanced DTC Tools</h3>

            <button className="btn-primary" type="button" onClick={() => pingMutation.mutate()}>
              Ping DTC Mongo
            </button>
            <pre className="json-preview">{JSON.stringify(pingMutation.data ?? {}, null, 2)}</pre>

            <input type="number" value={vehicleId} onChange={(e) => setVehicleId(Number(e.target.value))} required />
            <input value={code} onChange={(e) => setCode(e.target.value)} required />
            <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
              <option value="info">info</option>
              <option value="warning">warning</option>
              <option value="critical">critical</option>
            </select>
            <input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />

            <button
              className="btn-primary"
              type="button"
              onClick={() => createMutation.mutate({ vehicle_id: vehicleId, code, severity, description })}
            >
              Create DTC
            </button>
            <button
              className="btn-link"
              type="button"
              onClick={() => byVehicleMutation.mutate({ id: vehicleId, limit: 100 })}
            >
              Load by Vehicle
            </button>

            <input value={dtcHistoryId} onChange={(e) => setDtcHistoryId(e.target.value)} />
            <button className="btn-link" type="button" onClick={() => historyMutation.mutate(dtcHistoryId)}>
              Load History
            </button>

            <pre className="json-preview">{JSON.stringify(byVehicleMutation.data ?? {}, null, 2)}</pre>
            <pre className="json-preview">{JSON.stringify(historyMutation.data ?? {}, null, 2)}</pre>
          </div>
        )}
      </div>
    </section>
  );
}
