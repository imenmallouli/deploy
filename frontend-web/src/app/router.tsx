import { Navigate, createBrowserRouter } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { RequireAuth, RequireRole } from './RequireAuth';
import {
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
              <RequireRole allowedRoles={['user', 'admin']}>
                <GetStartedPage />
              </RequireRole>
            ),
          },
          {
            path: 'overview',
            element: (
              <RequireRole allowedRoles={['user', 'admin']}>
                <DashboardPage />
              </RequireRole>
            ),
          },
          { path: 'vehicles', element: <Navigate to="/vehicles/list" replace /> },
          {
            path: 'vehicles/list',
            element: (
              <RequireRole allowedRoles={['user', 'admin']}>
                <VehiclesPage />
              </RequireRole>
            ),
          },
          {
            path: 'vehicles/:vehicleId',
            element: (
              <RequireRole allowedRoles={['user', 'admin']}>
                <VehicleDetailsPage />
              </RequireRole>
            ),
          },
          {
            path: 'locations',
            element: (
              <RequireRole allowedRoles={['user', 'admin']}>
                <LocationsPage />
              </RequireRole>
            ),
          },
          {
            path: 'geofences',
            element: (
              <RequireRole allowedRoles={['user', 'admin']}>
                <GeofencesPage />
              </RequireRole>
            ),
          },
          {
            path: 'settings/autopi',
            element: (
              <RequireRole allowedRoles={['user', 'admin']}>
                <AutoPiSettingsPage />
              </RequireRole>
            ),
          },
          {
            path: 'admin',
            element: (
              <RequireRole allowedRoles={['admin']}>
                <AdminUsersPage />
              </RequireRole>
            ),
          },
          {
            path: 'admin/users',
            element: (
              <RequireRole allowedRoles={['admin']}>
                <Navigate to="/admin" replace />
              </RequireRole>
            ),
          },
          {
            path: 'diagnostics',
            element: (
              <RequireRole allowedRoles={['user', 'admin']}>
                <DtcPage />
              </RequireRole>
            ),
          },
          {
            path: 'devices/overview',
            element: (
              <RequireRole allowedRoles={['user', 'admin']}>
                <DeviceOverviewPage />
              </RequireRole>
            ),
          },
          {
            path: 'devices/list',
            element: (
              <RequireRole allowedRoles={['user', 'admin']}>
                <DevicesPage />
              </RequireRole>
            ),
          },
          {
            path: 'devices/:deviceId',
            element: (
              <RequireRole allowedRoles={['user', 'admin']}>
                <DeviceDetailsPage />
              </RequireRole>
            ),
          },

          {
            path: 'telemetry',
            element: (
              <RequireRole allowedRoles={['user', 'admin']}>
                <TelemetryPage />
              </RequireRole>
            ),
          },
          {
            path: 'dtc',
            element: (
              <RequireRole allowedRoles={['user', 'admin']}>
                <DtcPage />
              </RequireRole>
            ),
          },
          {
            path: 'alerts',
            element: (
              <RequireRole allowedRoles={['user', 'admin']}>
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
