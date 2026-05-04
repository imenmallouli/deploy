import { useNavigate } from 'react-router-dom';
import { clearSession, getRole } from '../lib/auth/session';
import { useI18n } from '../lib/i18n';

export function TopBar() {
  const navigate = useNavigate();
  const role = getRole() || 'user';
  const { locale, setLocale, t } = useI18n();

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
        <span className="chip">{role}</span>
        <button className="logout-btn" type="button" onClick={handleLogout}>
          {t('topbar.logout')}
        </button>
      </div>
    </header>
  );
}
