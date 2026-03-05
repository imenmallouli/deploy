const pids = [
  { pid: '010C', label: 'RPM', unit: 'rpm' },
  { pid: '010D', label: 'Vehicle Speed', unit: 'km/h' },
  { pid: '0105', label: 'Coolant Temperature', unit: '°C' },
  { pid: '0142', label: 'Control Module Voltage', unit: 'V' },
  { pid: '012F', label: 'Fuel Level Input', unit: '%' },
  { pid: '03', label: 'Stored DTCs', unit: 'code' },
];

export function ObdLibraryPage() {
  return (
    <section>
      <h2>OBD Library</h2>
      <p className="subtitle">Reference of common OBD PIDs and diagnostics commands.</p>

      <div className="panel table-shell">
        <table className="vehicles-table">
          <thead>
            <tr>
              <th>PID / Mode</th>
              <th>Description</th>
              <th>Unit</th>
            </tr>
          </thead>
          <tbody>
            {pids.map((row) => (
              <tr key={row.pid}>
                <td>{row.pid}</td>
                <td>{row.label}</td>
                <td>{row.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
