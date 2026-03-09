import { Navigate, createBrowserRouter } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { RequireAuth } from './RequireAuth';
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
          { path: 'vehicles', element: <Navigate to="/vehicles/list" replace /> },
          { path: 'vehicles/list', element: <VehiclesPage /> },
          { path: 'vehicles/geofences', element: <GeofencesPage /> },
          { path: 'vehicles/groups', element: <GroupsPage /> },
          { path: 'vehicles/:vehicleId', element: <VehicleDetailsPage /> },
          { path: 'locations', element: <LocationsPage /> },
          { path: 'diagnostics', element: <DtcPage /> },
          { path: 'vehicle-status', element: <VehicleStatusPage /> },
          { path: 'vehicle-status/:vehicleId', element: <VehicleStatusPage /> },
          { path: 'devices/overview', element: <DeviceOverviewPage /> },
          { path: 'devices/list', element: <DevicesPage /> },
          { path: 'devices/:deviceId', element: <DeviceDetailsPage /> },

          { path: 'telemetry', element: <TelemetryPage /> },
          { path: 'dtc', element: <DtcPage /> },
          { path: 'alerts', element: <AlertsPage /> },
          { path: 'fleets', element: <FleetsPage /> },

          { path: 'devices', element: <Navigate to="/devices/list" replace /> },

          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
]);
