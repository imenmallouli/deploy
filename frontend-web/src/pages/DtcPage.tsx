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

function getErrorMessage(error: unknown) {
  const data = (error as { response?: { data?: { message?: string; detail?: string } } })?.response?.data;
  return data?.message ?? data?.detail ?? 'Request failed.';
}

function parseBackendDate(value?: string | null) {
  if (!value) return null;
  const direct = Date.parse(value);
  if (!Number.isNaN(direct)) return new Date(direct);

  const match = value.match(/^(\d{2})\/([A-Za-z]{3})\/(\d{4})\s+(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, day, mon, year, hour, minute] = match;
  const monthMap: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  const month = monthMap[mon.toLowerCase()];
  if (month === undefined) return null;
  return new Date(Number(year), month, Number(day), Number(hour), Number(minute));
}

export function DtcPage() {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [dateInput, setDateInput] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [dateError, setDateError] = useState('');

  const [vehicleId, setVehicleId] = useState(1);
  const [code, setCode] = useState('P0420');
  const [severity, setSeverity] = useState('warning');
  const [description, setDescription] = useState('');
  const [dtcHistoryId, setDtcHistoryId] = useState('P0420');
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');

  const dtcQuery = useQuery({ queryKey: ['dtc'], queryFn: () => listDtc(100) });
  const pingMutation = useMutation({ mutationFn: pingDtc });
  const byVehicleMutation = useMutation({ mutationFn: ({ id, limit }: { id: number; limit?: number }) => listDtcByVehicle(id, limit ?? 100) });
  const historyMutation = useMutation({
    mutationFn: getDtcHistory,
    onSuccess: () => {
      setActionError('');
      setActionMessage('History loaded successfully.');
    },
    onError: (error) => {
      setActionMessage('');
      setActionError(getErrorMessage(error));
    },
  });
  const createMutation = useMutation({
    mutationFn: createDtc,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dtc'] }),
  });
  const clearMutation = useMutation({
    mutationFn: clearDtc,
    onSuccess: () => {
      setActionError('');
      setActionMessage('DTC clear executed.');
      queryClient.invalidateQueries({ queryKey: ['dtc'] });
    },
    onError: (error) => {
      setActionMessage('');
      setActionError(getErrorMessage(error));
    },
  });

  const fromDate = dateFilter ? new Date(dateFilter) : null;
  const hasValidDateRange = !fromDate || !Number.isNaN(fromDate.getTime());

  const rows = (dtcQuery.data?.items ?? [])
    .filter((item) => {
      const codeValue = String(item.code ?? item.dtc_code ?? '').toLowerCase();
      const descValue = String(item.description ?? '').toLowerCase();
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return codeValue.includes(q) || descValue.includes(q);
    })
    .filter((item) => {
      if (!hasValidDateRange) return true;
      if (!fromDate) return true;
      const rowDate = parseBackendDate(
        (item as { first_detected?: string; last_occurrence?: string; created_at?: string }).last_occurrence
        ?? (item as { first_detected?: string; last_occurrence?: string; created_at?: string }).first_detected
        ?? item.created_at,
      );
      if (!rowDate) return true;
      if (fromDate && rowDate < fromDate) return false;
      return true;
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

  const handleSearch = () => {
    const nextDate = dateInput ? new Date(dateInput) : null;
    const hasValidNextDateRange = !nextDate || !Number.isNaN(nextDate.getTime());

    if (!hasValidNextDateRange) {
      setDateError('Invalid date.');
      return;
    }

    setDateError('');
    setSearch(searchInput.trim());
    setDateFilter(dateInput);
    dtcQuery.refetch();
  };

  const handleSearchKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSearch();
    }
  };

  return (
    <section>
      <h2>Diagnostics</h2>

      <div className="panel diagnostics-shell">
        <div className="diagnostics-toolbar">
          <input
            className="toolbar-input"
            placeholder="Search for code"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
          <input
            className="toolbar-input diagnostics-date"
            type="datetime-local"
            value={dateInput}
            onChange={(event) => setDateInput(event.target.value)}
          />
          <button className="btn-primary" type="button" onClick={handleSearch}>Search</button>
        </div>
        {dateError && <p className="form-error">{dateError}</p>}

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
                      const historyKey = item.id ?? item.code ?? item.dtc_code;
                      if (historyKey) {
                        setActionMessage('');
                        setActionError('');
                        setDtcHistoryId(String(historyKey));
                        historyMutation.mutate(String(historyKey));
                      }
                    }}
                  >
                    History
                  </button>
                  <button
                    className="inline-danger"
                    type="button"
                    onClick={() => {
                      setActionMessage('');
                      setActionError('');
                      clearMutation.mutate({ vehicle_id: item.vehicle_id, dtc_code: item.code ?? item.dtc_code });
                    }}
                  >
                    Clear
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="muted-note">{rows.length} total</p>
        {actionError && <p className="form-error">{actionError}</p>}
        {actionMessage && <p className="muted-note">{actionMessage}</p>}
        {(historyMutation.data || historyMutation.isPending) && (
          <pre className="json-preview">{JSON.stringify(historyMutation.data ?? { status: 'loading' }, null, 2)}</pre>
        )}

      </div>
    </section>
  );
}
