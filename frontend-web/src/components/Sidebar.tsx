import { NavLink } from 'react-router-dom';

const navItems = [
  { label: 'Dashboard', to: '/' },
  { label: 'Vehicles', to: '/vehicles' },
  { label: 'Vehicle Status', to: '/vehicle-status' },
  { label: 'Telemetry', to: '/telemetry' },
  { label: 'DTC', to: '/dtc' },
  { label: 'Alerts', to: '/alerts' },
  { label: 'Fleets', to: '/fleets' },
];

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <h1>Auto Diagnostic</h1>
        <p>AutoPi-style Ops</p>
      </div>
      <nav className="nav-list">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
