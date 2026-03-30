import { useNavigate } from 'react-router-dom';
import { clearSession } from '../lib/auth/session';

export function TopBar() {
  const navigate = useNavigate();

  const handleLogout = () => {
    clearSession();
    navigate('/login');
  };

  return (
    <header className="topbar">
      <input
        className="search"
        placeholder="Search vehicle by VIN / plate"
        aria-label="search vehicle"
      />
      <div className="topbar-right">
        <span className="chip">manager</span>
        <button className="logout-btn" type="button" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}
