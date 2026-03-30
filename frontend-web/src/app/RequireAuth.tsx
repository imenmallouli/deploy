import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { hasSession } from '../lib/auth/session';

export function RequireAuth() {
  const location = useLocation();

  if (!hasSession()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
