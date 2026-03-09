import { NavLink } from 'react-router-dom';

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <h1>MALLOULIAUTO</h1>
        <p>Cloud</p>
      </div>
      <nav>
        <div className="nav-section">
          <div className="nav-list">
            <NavLink to="/get-started" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
              Get started
            </NavLink>
          </div>
        </div>

        <div className="nav-section">
          <p className="nav-section-title">Fleet Management</p>
          <div className="nav-list">
            <NavLink to="/overview" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
              Overview
            </NavLink>
            <div className="nav-group">
              <NavLink to="/vehicles/list" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
                Vehicles
              </NavLink>
              <div className="nav-sublist">
                <NavLink to="/vehicles/list" className={({ isActive }) => (isActive ? 'nav-subitem active' : 'nav-subitem')}>
                  List
                </NavLink>
                <NavLink to="/vehicles/geofences" className={({ isActive }) => (isActive ? 'nav-subitem active' : 'nav-subitem')}>
                  Geofences
                </NavLink>
                <NavLink to="/vehicles/groups" className={({ isActive }) => (isActive ? 'nav-subitem active' : 'nav-subitem')}>
                  Groups
                </NavLink>
              </div>
            </div>
            <NavLink to="/locations" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
              Locations
            </NavLink>
            <NavLink to="/diagnostics" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
              Diagnostics
            </NavLink>
            <NavLink to="/alerts" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
              Alerts
            </NavLink>
          </div>
        </div>

        <div className="nav-section">
          <p className="nav-section-title">Device Management</p>
          <div className="nav-list">
            <NavLink to="/devices/overview" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
              Overview
            </NavLink>
            <NavLink to="/devices/list" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
              Devices
            </NavLink>
            <NavLink to="/vehicle-status" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
              Vehicle Status
            </NavLink>
            <NavLink to="/telemetry" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
              Telemetry
            </NavLink>
          </div>
        </div>
      </nav>
    </aside>
  );
}
