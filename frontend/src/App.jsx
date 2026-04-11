/**
 * App.jsx — router with all routes
 *
 * Routes:
 *   /            → Landing (choose role)
 *   /login       → LoginPage (shared, reads ?role=)
 *   /manager     → ManagerDashboard (protected, role=manager)
 *   /employee    → EmployeeDashboard (protected, role=employee)
 *   *            → redirect to /
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';

import Landing           from './pages/Landing';
import LoginPage         from './pages/LoginPage';
import ManagerDashboard  from './pages/ManagerDashboard';
import EmployeeDashboard from './pages/EmployeeDashboard';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/"        element={<Landing />} />
          <Route path="/login"   element={<LoginPage />} />

          <Route
            path="/manager"
            element={
              <PrivateRoute role="manager">
                <ManagerDashboard />
              </PrivateRoute>
            }
          />

          <Route
            path="/employee"
            element={
              <PrivateRoute role="employee">
                <EmployeeDashboard />
              </PrivateRoute>
            }
          />

          {/* Catch-all → landing */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
