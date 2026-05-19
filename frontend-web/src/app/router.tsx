import { Navigate, createBrowserRouter } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { RequireAuth, RequireRole } from './RequireAuth';
import {
  AdminLoginPage,
  AdminRegisterPage,
  AdminUserAccountPage,
  AdminUsersPage,
  AlertsPage,
  AutoPiSettingsPage,
  DashboardPage,
  DeviceDetailsPage,
  DeviceOverviewPage,
  DevicesPage,
  DtcPage,
  ForgotPasswordPage,
  GeofencesPage,
  GetStartedPage,
  LoginPage,
  LocationsPage,
  RegisterPage,
  TelemetryPage,
  VehicleDetailsPage,
  VehiclesPage,
} from '../pages/index';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/admin/login', element: <AdminLoginPage /> },
  { path: '/admin/register', element: <AdminRegisterPage /> },
  {
    path: '/admin',
    element: <RequireAuth />,
    children: [
      {
        path: '/admin',
        element: (
          <RequireRole allowedRoles={['admin']}>
            <Navigate to="/admin/panel" replace />
          </RequireRole>
        ),
      },
      {
        path: '/admin/panel',
        element: (
          <RequireRole allowedRoles={['admin']}>
            <AdminUsersPage />
          </RequireRole>
        ),
      },
      {
        path: '/admin/panel/users/:userId',
        element: (
          <RequireRole allowedRoles={['admin']}>
            <AdminUserAccountPage />
          </RequireRole>
        ),
      },
    ],
  },
  {
    path: '/',
    element: <RequireAuth />,
    children: [
      {
        path: '/',
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/get-started" replace /> },
          {
            path: 'get-started',
            element: (
              <RequireRole allowedRoles={['user']}>
                <GetStartedPage />
              </RequireRole>
            ),
          },
          {
            path: 'overview',
            element: (
              <RequireRole allowedRoles={['user']}>
                <DashboardPage />
              </RequireRole>
            ),
          },
          { path: 'vehicles', element: <Navigate to="/vehicles/list" replace /> },
          {
            path: 'vehicles/list',
            element: (
              <RequireRole allowedRoles={['user']}>
                <VehiclesPage />
              </RequireRole>
            ),
          },
          {
            path: 'vehicles/:vehicleId',
            element: (
              <RequireRole allowedRoles={['user']}>
                <VehicleDetailsPage />
              </RequireRole>
            ),
          },
          {
            path: 'locations',
            element: (
              <RequireRole allowedRoles={['user']}>
                <LocationsPage />
              </RequireRole>
            ),
          },
          {
            path: 'geofences',
            element: (
              <RequireRole allowedRoles={['user']}>
                <GeofencesPage />
              </RequireRole>
            ),
          },
          {
            path: 'settings/autopi',
            element: (
              <RequireRole allowedRoles={['user']}>
                <AutoPiSettingsPage />
              </RequireRole>
            ),
          },
          {
            path: 'diagnostics',
            element: (
              <RequireRole allowedRoles={['user']}>
                <DtcPage />
              </RequireRole>
            ),
          },
          {
            path: 'devices/overview',
            element: (
              <RequireRole allowedRoles={['user']}>
                <DeviceOverviewPage />
              </RequireRole>
            ),
          },
          {
            path: 'devices/list',
            element: (
              <RequireRole allowedRoles={['user']}>
                <DevicesPage />
              </RequireRole>
            ),
          },
          {
            path: 'devices/:deviceId',
            element: (
              <RequireRole allowedRoles={['user']}>
                <DeviceDetailsPage />
              </RequireRole>
            ),
          },

          {
            path: 'telemetry',
            element: (
              <RequireRole allowedRoles={['user']}>
                <TelemetryPage />
              </RequireRole>
            ),
          },
          {
            path: 'dtc',
            element: (
              <RequireRole allowedRoles={['user']}>
                <DtcPage />
              </RequireRole>
            ),
          },
          {
            path: 'alerts',
            element: (
              <RequireRole allowedRoles={['user']}>
                <AlertsPage />
              </RequireRole>
            ),
          },

          { path: 'devices', element: <Navigate to="/devices/list" replace /> },

          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
]);
