import { Navigate, createBrowserRouter } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { RequireAuth } from './RequireAuth';
import {
  AlertsPage,
  DashboardPage,
  DtcPage,
  FleetsPage,
  LoginPage,
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
          { index: true, element: <DashboardPage /> },
          { path: 'vehicles', element: <VehiclesPage /> },
          { path: 'vehicles/:vehicleId', element: <VehicleDetailsPage /> },
          { path: 'vehicle-status', element: <VehicleStatusPage /> },
          { path: 'vehicle-status/:vehicleId', element: <VehicleStatusPage /> },
          { path: 'telemetry', element: <TelemetryPage /> },
          { path: 'dtc', element: <DtcPage /> },
          { path: 'alerts', element: <AlertsPage /> },
          { path: 'fleets', element: <FleetsPage /> },
          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
]);
