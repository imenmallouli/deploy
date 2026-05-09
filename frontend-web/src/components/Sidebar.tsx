import { NavLink } from 'react-router-dom';
import { getRole } from '../lib/auth/session';
import { useI18n } from '../lib/i18n';

export function Sidebar() {
  const role = getRole();
  const isAdmin = role === 'admin';
  const isUser = role === 'user';
  const canAccessAutoPiSettings = isUser || isAdmin;
  const { t } = useI18n();

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
              {t('sidebar.getStarted')}
            </NavLink>
            <NavLink to="/overview" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
              {t('sidebar.overview')}
            </NavLink>
            <NavLink to="/vehicles/list" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
              {t('sidebar.vehicles')}
            </NavLink>
            <NavLink to="/telemetry" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
              {t('sidebar.telemetry')}
            </NavLink>
            <NavLink to="/locations" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
              {t('sidebar.locations')}
            </NavLink>
            <NavLink to="/geofences" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
              {t('sidebar.geofences')}
            </NavLink>
            <NavLink to="/diagnostics" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
              {t('sidebar.diagnostics')}
            </NavLink>
            <NavLink to="/alerts" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
              {t('sidebar.alerts')}
            </NavLink>
          </div>
        </div>

        <div className="nav-section">
          <p className="nav-section-title">{t('sidebar.deviceManagement')}</p>
          <div className="nav-list">
            <NavLink to="/devices/overview" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
              {t('sidebar.overview')}
            </NavLink>
            <NavLink to="/devices/list" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
              {t('sidebar.devices')}
            </NavLink>
            {canAccessAutoPiSettings && (
              <NavLink to="/settings/autopi" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
                {t('sidebar.autopiSettings')}
              </NavLink>
            )}
          </div>
        </div>

        {isAdmin && (
          <div className="nav-section">
            <p className="nav-section-title">{t('sidebar.admin')}</p>
            <div className="nav-list">
              <NavLink to="/admin" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
                {t('sidebar.userManagement')}
              </NavLink>
            </div>
          </div>
        )}
      </nav>
    </aside>
  );
}
