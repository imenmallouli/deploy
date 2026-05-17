import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { listDevices } from '../lib/api/endpoints';
import { useI18n } from '../lib/i18n';

type DeviceItem = {
  id: string;
  device_id: string;
  vehicle_id?: number;
  vin?: string;
  status?: string;
  updated_at?: string;
  created_at?: string;
};

const serviceRows = [
  ['acc_manager', 'Handles all communication with the accelerometer.', true, '-'],
  ['audio_manager', 'Handles all requests to play audio through the connected speaker.', true, '-'],
  ['cloud_manager', 'Handles buffering of data, and sending data in batches to the cloud server.', true, '-'],
  ['modem_manager', 'Handles all communication with the modem.', true, '-'],
  ['event_reactor', 'Listens and reacts to events from the device.', true, '-'],
  ['obd_manager', 'Handles all communication to and from the vehicle.', true, '-'],
] as const;

const loggerRows = [
  ['ENGINE_LOAD', 'Calculated Engine Load'],
  ['RPM', 'Engine RPM'],
  ['GET_DTC', 'Get DTCs'],
  ['AMBIANT_AIR_TEMP', 'Ambient air temperature'],
  ['ODOMETER', 'Odometer'],
] as const;

const baseTabs = ['Overview', 'Key State', 'Vehicle', 'CAN Bus', 'SIM', 'Services', 'Events', 'CAN Analyzer', 'Loggers', 'Change History', 'Open Alerts'] as const;
type DeviceTab = (typeof baseTabs)[number];

function getTabs(locale: 'fr' | 'en') {
  if (locale === 'fr') {
    return [
      { key: 'Overview' as const, label: 'Apercu' },
      { key: 'Key State' as const, label: 'Tableau de bord' },
      { key: 'Vehicle' as const, label: 'Taches' },
      { key: 'CAN Bus' as const, label: 'Code personnalise' },
      { key: 'SIM' as const, label: 'Geofences' },
      { key: 'Services' as const, label: 'Services' },
      { key: 'Events' as const, label: 'Evenements' },
      { key: 'CAN Analyzer' as const, label: 'Analyseur CAN' },
      { key: 'Loggers' as const, label: 'Loggers' },
      { key: 'Change History' as const, label: 'Historique' },
      { key: 'Open Alerts' as const, label: '+ 5 de plus' },
    ];
  }

  return [
    { key: 'Overview' as const, label: 'Overview' },
    { key: 'Key State' as const, label: 'Dashboard' },
    { key: 'Vehicle' as const, label: 'Jobs' },
    { key: 'CAN Bus' as const, label: 'Custom Code' },
    { key: 'SIM' as const, label: 'Geofences' },
    { key: 'Services' as const, label: 'Services' },
    { key: 'Events' as const, label: 'Events' },
    { key: 'CAN Analyzer' as const, label: 'CAN Analyzer' },
    { key: 'Loggers' as const, label: 'Loggers' },
    { key: 'Change History' as const, label: 'Change History' },
    { key: 'Open Alerts' as const, label: '+ 5 more' },
  ];
}

function getStatusClass(status?: string) {
  const normalized = String(status ?? 'offline').toLowerCase();
  if (normalized === 'warning') return 'warning';
  if (normalized === 'offline') return 'critical';
  return '';
}

function readLastCommunication(device?: DeviceItem) {
  return device?.updated_at ?? device?.created_at ?? '-';
}

export function DeviceDetailsPage() {
  const { locale } = useI18n();
  const text = locale === 'fr'
    ? {
        pageTitle: 'Appareil',
        backToDevices: 'Retour aux appareils',
        loadingDetails: 'Chargement des details de l\'appareil...',
        notFound: 'Appareil introuvable.',
        name: 'Nom',
        status: 'Statut',
        lastCommunication: 'Derniere communication',
      }
    : {
        pageTitle: 'Device',
        backToDevices: 'Back to devices',
        loadingDetails: 'Loading device details...',
        notFound: 'Device not found.',
        name: 'Name',
        status: 'Status',
        lastCommunication: 'Last communication',
      };
  const { deviceId = '' } = useParams();
  const [activeTab, setActiveTab] = useState<DeviceTab>('Overview');
  const tabs = getTabs(locale);
  const detailsQuery = useQuery({ queryKey: ['device-details', deviceId], queryFn: () => listDevices(deviceId || undefined) });

  const items = detailsQuery.data?.items as DeviceItem[] | undefined;
  const device = items?.find((item) => item.device_id === deviceId) ?? items?.[0];

  return (
    <section>
      <div className="panel-title-row" style={{ marginBottom: 12 }}>
        <h2>{text.pageTitle} {deviceId}</h2>
        <Link className="btn-link" to="/devices/list">{text.backToDevices}</Link>
      </div>

      {detailsQuery.isLoading && <p className="muted-note">{text.loadingDetails}</p>}

      {!detailsQuery.isLoading && !device && (
        <div className="panel table-shell">
          <p className="muted-note">{text.notFound}</p>
        </div>
      )}

      {device && (
        <>
          <div className="panel table-shell">
            <div className="device-details-head">
              <div>
                <p className="muted-note" style={{ margin: 0 }}>{text.name}</p>
                <h3 style={{ margin: '4px 0 0' }}>{device.device_id}</h3>
              </div>
              <div>
                <p className="muted-note" style={{ margin: 0 }}>{text.status}</p>
                <span className={`status-pill ${getStatusClass(device.status)}`}>{String(device.status ?? 'offline')}</span>
              </div>
              <div>
                <p className="muted-note" style={{ margin: 0 }}>{text.lastCommunication}</p>
                <p style={{ margin: '4px 0 0' }}>{readLastCommunication(device)}</p>
              </div>
            </div>
          </div>

          <div className="panel table-shell">
            <div className="device-tabs-row">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`btn-link device-tab ${activeTab === tab.key ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="device-details-grid">
            {activeTab === 'Key State' && (
              <div className="panel dashboard-panel">
                <div className="dashboard-toolbar">
                  <button type="button" className="btn-link">Unnamed 4089</button>
                  <button type="button" className="btn-link">09/Mar/2026 00:00 - Now</button>
                  <button type="button" className="btn-link">Refresh</button>
                  <button type="button" className="btn-link">Auto refresh</button>
                  <button type="button" className="btn-link">Actions</button>
                  <button type="button" className="btn-primary">Create dashboard</button>
                </div>
                <div className="dashboard-empty">
                  <h3>No widgets</h3>
                  <p className="muted-note">It looks like you don’t have any widgets on this dashboard.</p>
                  <button type="button" className="btn-link">Auto-generate Dashboard</button>
                </div>
              </div>
            )}
            {activeTab === 'Overview' && (
              <div className="panel voltage-card">
                <h3>Voltage Measured</h3>
                <p className="voltage-value">13.57V</p>
              </div>
            )}
            {activeTab === 'Overview' && (
              <div className="panel">
                <h3>Key State</h3>
                <p className="muted-note">No key state data available.</p>
              </div>
            )}
            {activeTab === 'Overview' && (
              <div className="panel">
                <h3>Last Communication</h3>
                <p>{readLastCommunication(device)}</p>
              </div>
            )}
            {activeTab === 'Overview' && (
              <div className="panel">
                <h3>Installed Version</h3>
                <p className="muted-note">No software version reported yet.</p>
              </div>
            )}
            {activeTab === 'Vehicle' && (
              <div className="panel jobs-panel">
                <div className="jobs-header-row">
                  <h3>Jobs</h3>
                  <button type="button" className="btn-link">Refresh</button>
                </div>

                <div className="jobs-actions-row">
                  <button type="button" className="btn-primary">Create</button>
                  <button type="button" className="btn-link">Sync</button>
                  <button type="button" className="btn-link">Restore default</button>
                </div>

                <table className="vehicles-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Description</th>
                      <th>Function</th>
                      <th>Returner</th>
                      <th>Enabled</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Log RPi Temps</td>
                      <td>Log CPU and GPU core temp ..</td>
                      <td>rpi.temp</td>
                      <td>cloud</td>
                      <td><span className="jobs-toggle" /></td>
                      <td><button type="button" className="btn-link">🗑</button></td>
                    </tr>
                  </tbody>
                </table>

                <p className="muted-note">1 total</p>
              </div>
            )}
            {activeTab === 'CAN Bus' && (
              <div className="panel custom-code-panel">
                <div className="custom-code-header-row">
                  <h3>Custom Code</h3>
                  <div className="custom-code-links-row">
                    <button type="button" className="btn-link">Refresh</button>
                    <button type="button" className="btn-link">Go to Docs</button>
                  </div>
                </div>

                <div className="jobs-actions-row">
                  <button type="button" className="btn-primary">Create</button>
                  <button type="button" className="btn-link">Sync</button>
                </div>

                <table className="vehicles-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Description</th>
                      <th>Modified</th>
                      <th>Type</th>
                      <th>Enabled</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td colSpan={5} className="empty-cell">No data to display</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            {activeTab === 'Services' && (
              <div className="panel tab-page-panel">
                <div className="tab-page-header">
                  <h3>Services</h3>
                  <div className="tab-page-links">
                    <button type="button" className="inline-link-btn">Refresh</button>
                    <button type="button" className="inline-link-btn">Go to Docs</button>
                  </div>
                </div>

                <div className="jobs-actions-row">
                  <button type="button" className="btn-primary">Create</button>
                </div>

                <table className="vehicles-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Description</th>
                      <th>Enabled</th>
                      <th>Custom</th>
                    </tr>
                  </thead>
                  <tbody>
                    {serviceRows.map((row) => (
                      <tr key={row[0]}>
                        <td>{row[0]}</td>
                        <td>{row[1]}</td>
                        <td><span className="status-dot success">✓</span></td>
                        <td>{row[3]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {activeTab === 'Events' && (
              <div className="panel tab-page-panel">
                <h3>Events</h3>

                <div className="events-filter-grid">
                  <label>
                    <span>Time Interval</span>
                    <input className="toolbar-input" value="07/Mar/2026 00:00 - 09/Mar/2026 23:59" readOnly />
                  </label>
                  <label>
                    <span>Type</span>
                    <div className="events-type-chips">
                      <span className="events-chip">system</span>
                      <span className="events-chip">vehicle</span>
                    </div>
                  </label>
                  <label>
                    <span>Filter (Use * as Wildcard)</span>
                    <input className="toolbar-input" value="Example: vehicle/engine/running or vehicle/*" readOnly />
                  </label>
                  <button type="button" className="btn-primary events-search-btn">Search</button>
                </div>

                <div className="events-empty">
                  <div className="events-empty-icon">📄</div>
                  <p className="muted-note">No events found in this time period.</p>
                </div>
              </div>
            )}
            {activeTab === 'CAN Analyzer' && (
              <div className="panel tab-page-panel">
                <div className="tab-page-header">
                  <h3>CAN Analyzer</h3>
                  <div className="tab-page-links">
                    <button type="button" className="inline-link-btn">Go to Docs</button>
                  </div>
                </div>

                <div className="can-subtabs">
                  <button type="button" className="inline-link-btn can-subtab active">Sniffer</button>
                  <button type="button" className="inline-link-btn can-subtab">Recorder</button>
                  <button type="button" className="inline-link-btn can-subtab">Player</button>
                  <button type="button" className="inline-link-btn can-subtab">PID Tester</button>
                </div>

                <div className="can-analyzer-grid">
                  <div>
                    <div className="can-notice">Notice: This will only work on vehicles which allow direct CAN streaming</div>
                    <h4>Protocol Settings</h4>
                    <div className="can-fields-grid">
                      <input className="toolbar-input" value="Bus 6" readOnly />
                      <input className="toolbar-input" value="[6] ISO 15765-4 (CAN 11/500)" readOnly />
                      <input className="toolbar-input" value="500000" readOnly />
                    </div>
                    <div className="jobs-actions-row" style={{ marginTop: 10 }}>
                      <button type="button" className="btn-primary">Sniff</button>
                      <button type="button" className="btn-link">Create bus</button>
                      <button type="button" className="btn-link">Reset interface</button>
                    </div>
                  </div>
                  <div className="can-terminal-panel">
                    <h4>Terminal Command</h4>
                    <pre className="json-preview">$ obd.dump protocol=6 baudrate=500000 duration=1</pre>
                    <button type="button" className="btn-link">Run in Terminal</button>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'Loggers' && (
              <div className="panel tab-page-panel">
                <div className="tab-page-header">
                  <h3>Loggers</h3>
                  <div className="tab-page-links">
                    <button type="button" className="inline-link-btn">Refresh</button>
                    <button type="button" className="inline-link-btn">Go to Docs</button>
                  </div>
                </div>

                <div className="jobs-actions-row">
                  <button type="button" className="btn-primary">Create</button>
                  <button type="button" className="btn-link">Sync</button>
                  <button type="button" className="btn-link">Restore default</button>
                </div>

                <table className="vehicles-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Description</th>
                      <th>Enabled</th>
                      <th>Type</th>
                      <th>Bus</th>
                      <th>Active</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {loggerRows.map((row) => (
                      <tr key={row[0]}>
                        <td>{row[0]} <span className="logger-badge">MODIFIED</span></td>
                        <td>{row[1]}</td>
                        <td><span className="status-dot success">✓</span></td>
                        <td>OBD-II PID</td>
                        <td>Auto</td>
                        <td><span className="status-dot danger">×</span></td>
                        <td><button type="button" className="inline-link-btn">🗑</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {activeTab === 'Change History' && (
              <div className="panel tab-page-panel">
                <div className="tab-page-header">
                  <h3>Change History</h3>
                  <div className="tab-page-links">
                    <button type="button" className="inline-link-btn">Refresh</button>
                  </div>
                </div>

                <table className="vehicles-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Success Changes</th>
                      <th>Failed Changes</th>
                      <th>Changed States</th>
                      <th>Failed States</th>
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td colSpan={6} className="empty-cell">No data to display</td>
                    </tr>
                  </tbody>
                </table>
                <p className="muted-note">0 total</p>
              </div>
            )}
            {activeTab === 'Overview' && (
              <div className="panel">
                <h3>Vehicle Information</h3>
                <p>Vehicle ID: {device.vehicle_id ?? '-'}</p>
                <p>VIN: {device.vin ?? '-'}</p>
              </div>
            )}
            {activeTab === 'Overview' && (
              <div className="panel">
                <h3>Device Specifications</h3>
                <div className="spec-list">
                  <div className="spec-row"><span>Device ID</span><span>{device.id}</span></div>
                  <div className="spec-row"><span>Unit ID</span><span>{device.device_id}</span></div>
                  <div className="spec-row"><span>IMEI</span><span>353338974791854</span></div>
                  <div className="spec-row"><span>ICCID</span><span>89358151000016788666</span></div>
                  <div className="spec-row"><span>Modem</span><span>LE910C4-WWXD</span></div>
                  <div className="spec-row"><span>Edition</span><span>4G</span></div>
                  <div className="spec-row"><span>Board Version</span><span>7.1</span></div>
                </div>
              </div>
            )}
            {activeTab === 'Overview' && (
              <div className="panel">
                <h3>CAN Bus</h3>
                <p className="muted-note">No CAN bus status available.</p>
              </div>
            )}
            {activeTab === 'SIM' && (
              <div className="panel geofence-panel">
                <div className="geofence-header-row">
                  <h3>Geofence</h3>
                  <div className="custom-code-links-row">
                    <button type="button" className="btn-link">Refresh</button>
                    <button type="button" className="btn-link">Go to Docs</button>
                  </div>
                </div>

                <div className="jobs-actions-row">
                  <button type="button" className="btn-primary">Create</button>
                </div>

                <table className="vehicles-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Description</th>
                      <th>Shape</th>
                      <th>Enabled</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td colSpan={4} className="empty-cell">No data to display</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            {activeTab === 'Overview' && (
              <div className="panel">
                <h3>SIM</h3>
                <p className="muted-note">No SIM data available.</p>
              </div>
            )}
            {(activeTab === 'Overview' || activeTab === 'Open Alerts') && (
              <div className="panel">
                <h3>Open Alerts</h3>
                <p className="muted-note">No open alerts.</p>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}