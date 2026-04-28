import { Navigate, createBrowserRouter } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { RequireAuth, RequireRole } from './RequireAuth';
import {
  AlertsPage,
  DashboardPage,
  DeviceDetailsPage,
  DeviceOverviewPage,
  DevicesPage,
  DtcPage,
  GeofencesPage,
  GetStartedPage,
  LoginPage,
  LocationsPage,
  RegisterPage,
  TelemetryPage,
  VehicleDetailsPage,
  VehicleStatusPage,
  VehiclesPage,
} from '../pages/index';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
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
          { path: 'get-started', element: <GetStartedPage /> },
          { path: 'overview', element: <DashboardPage /> },
          {
            path: 'vehicles',
            element: (
              <RequireRole allowedRoles={['admin']}>
                <Navigate to="/vehicles/list" replace />
              </RequireRole>
            ),
          },
          {
            path: 'vehicles/list',
            element: (
              <RequireRole allowedRoles={['admin']}>
                <VehiclesPage />
              </RequireRole>
            ),
          },
          {
            path: 'vehicles/:vehicleId',
            element: (
              <RequireRole allowedRoles={['admin']}>
                <VehicleDetailsPage />
              </RequireRole>
            ),
          },
          {
            path: 'locations',
            element: (
              <RequireRole allowedRoles={['admin']}>
                <LocationsPage />
              </RequireRole>
            ),
          },
          {
            path: 'geofences',
            element: (
              <RequireRole allowedRoles={['admin']}>
                <GeofencesPage />
              </RequireRole>
            ),
          },
          { path: 'diagnostics', element: <DtcPage /> },
          { path: 'vehicle-status', element: <VehicleStatusPage /> },
          { path: 'vehicle-status/:vehicleId', element: <VehicleStatusPage /> },
          { path: 'devices/overview', element: <DeviceOverviewPage /> },
          { path: 'devices/list', element: <DevicesPage /> },
          { path: 'devices/:deviceId', element: <DeviceDetailsPage /> },

          { path: 'telemetry', element: <TelemetryPage /> },
          { path: 'dtc', element: <DtcPage /> },
          { path: 'alerts', element: <AlertsPage /> },

          { path: 'devices', element: <Navigate to="/devices/list" replace /> },

          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
]);
