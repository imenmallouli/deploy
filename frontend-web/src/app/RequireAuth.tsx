import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { clearSession, getRole, hasSession } from '../lib/auth/session';

export function RequireAuth() {
  const location = useLocation();

  if (!hasSession()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

type RequireRoleProps = {
  allowedRoles: Array<'admin' | 'user'>;
  children: JSX.Element;
};

export function RequireRole({ allowedRoles, children }: RequireRoleProps) {
  const location = useLocation();
  const role = getRole();

  if (!role || !allowedRoles.includes(role as 'admin' | 'user')) {
    if (location.pathname === '/admin' || location.pathname.startsWith('/admin/')) {
      clearSession();
      return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    }

    return <Navigate to="/get-started" replace />;
  }

  return children;
}
