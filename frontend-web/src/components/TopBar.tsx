import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ackAlert, listAlerts } from '../lib/api/endpoints';
import { clearSession, getRole } from '../lib/auth/session';
import { useI18n } from '../lib/i18n';

export function TopBar() {
  const navigate = useNavigate();
  const role = getRole() || 'user';
  const { locale, setLocale, t } = useI18n();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: alertsData, refetch } = useQuery({
    queryKey: ['pending-alerts-topbar'],
    queryFn: () => listAlerts(),
    refetchInterval: 15000,
    staleTime: 10000,
  });

  const pendingAlerts = (alertsData?.alerts ?? []).filter(
    (a) => a.status === 'pending' && a.type === 'geofence_exit'
  );
  const pendingCount = pendingAlerts.length;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleAck = async (alertId: number) => {
    await ackAlert({ alert_id: alertId });
    refetch();
  };

  const handleLogout = () => {
    clearSession();
    navigate('/login');
  };

  return (
    <header className="topbar">
      <input
        className="search"
        placeholder={t('topbar.searchPlaceholder')}
        aria-label={t('topbar.searchAriaLabel')}
      />
      <div className="topbar-right">
        <div className="lang-switch" aria-label="Language switch">
          <button
            type="button"
            className={`lang-btn ${locale === 'fr' ? 'active' : ''}`}
            onClick={() => setLocale('fr')}
          >
            FR
          </button>
          <button
            type="button"
            className={`lang-btn ${locale === 'en' ? 'active' : ''}`}
            onClick={() => setLocale('en')}
          >
            EN
          </button>
        </div>

        {/* Notification bell */}
        <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
          <button
            type="button"
            onClick={() => setDropdownOpen((v) => !v)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 20,
              position: 'relative',
              padding: '4px 8px',
              color: pendingCount > 0 ? '#e53e3e' : '#6b7280',
            }}
            title="Notifications géofence"
            aria-label="Notifications"
          >
            🔔
            {pendingCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 2,
                  background: '#e53e3e',
                  color: '#fff',
                  borderRadius: '50%',
                  width: 17,
                  height: 17,
                  fontSize: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  lineHeight: 1,
                }}
              >
                {pendingCount > 9 ? '9+' : pendingCount}
              </span>
            )}
          </button>

          {dropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: '110%',
                right: 0,
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 10,
                boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
                minWidth: 320,
                maxWidth: 380,
                zIndex: 9000,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '12px 16px',
                  fontWeight: 600,
                  fontSize: 13,
                  borderBottom: '1px solid #f3f4f6',
                  background: '#f9fafb',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>🚨 Alertes géofence</span>
                {pendingCount > 0 && (
                  <span style={{ fontSize: 11, color: '#6b7280' }}>{pendingCount} non lu{pendingCount > 1 ? 's' : ''}</span>
                )}
              </div>

              {pendingAlerts.length === 0 ? (
                <div style={{ padding: '20px 16px', textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
                  ✅ Aucune alerte de sortie de zone
                </div>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 340, overflowY: 'auto' }}>
                  {pendingAlerts.map((alert) => (
                    <li
                      key={alert.id}
                      style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid #f3f4f6',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <strong style={{ fontSize: 13, color: '#dc2626' }}>{alert.title}</strong>
                        <button
                          type="button"
                          onClick={() => handleAck(alert.id)}
                          style={{
                            background: 'none',
                            border: '1px solid #d1d5db',
                            borderRadius: 4,
                            fontSize: 11,
                            cursor: 'pointer',
                            padding: '2px 6px',
                            color: '#374151',
                            marginLeft: 8,
                            flexShrink: 0,
                          }}
                        >
                          Lu
                        </button>
                      </div>
                      <p style={{ margin: 0, fontSize: 12, color: '#4b5563', lineHeight: 1.4 }}>{alert.message}</p>
                      {alert.created_at && (
                        <span style={{ fontSize: 11, color: '#9ca3af' }}>
                          {new Date(alert.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <span className="chip">{role}</span>
        <button className="logout-btn" type="button" onClick={handleLogout}>
          {t('topbar.logout')}
        </button>
      </div>
    </header>
  );
}
