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
  FleetsPage,
  GeofencesPage,
  GetStartedPage,
  GroupsPage,
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
              <RequireRole allowedRoles={['admin', 'manager']}>
                <Navigate to="/vehicles/list" replace />
              </RequireRole>
            ),
          },
          {
            path: 'vehicles/list',
            element: (
              <RequireRole allowedRoles={['admin', 'manager']}>
                <VehiclesPage />
              </RequireRole>
            ),
          },
          {
            path: 'vehicles/geofences',
            element: (
              <RequireRole allowedRoles={['admin', 'manager']}>
                <GeofencesPage />
              </RequireRole>
            ),
          },
          {
            path: 'vehicles/groups',
            element: (
              <RequireRole allowedRoles={['admin', 'manager']}>
                <GroupsPage />
              </RequireRole>
            ),
          },
          {
            path: 'vehicles/:vehicleId',
            element: (
              <RequireRole allowedRoles={['admin', 'manager']}>
                <VehicleDetailsPage />
              </RequireRole>
            ),
          },
          {
            path: 'locations',
            element: (
              <RequireRole allowedRoles={['admin', 'manager']}>
                <LocationsPage />
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
          {
            path: 'fleets',
            element: (
              <RequireRole allowedRoles={['admin', 'manager']}>
                <FleetsPage />
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
