import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getRole, hasSession } from '../lib/auth/session';

export function RequireAuth() {
  const location = useLocation();

  if (!hasSession()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

type RequireRoleProps = {
  allowedRoles: Array<'admin' | 'manager' | 'driver'>;
  children: JSX.Element;
};

export function RequireRole({ allowedRoles, children }: RequireRoleProps) {
  const role = getRole();

  if (!role || !allowedRoles.includes(role as 'admin' | 'manager' | 'driver')) {
    return <Navigate to="/overview" replace />;
  }

  return children;
}
