/**
 * PrivateRoute.jsx — blocks wrong-role access
 *
 * - Not logged in        → redirect to /
 * - Wrong role           → redirect to their own dashboard
 * - Correct role         → render children
 */
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PrivateRoute({ children, role }) {
  const { token, user } = useAuth();

  if (!token || !user) {
    return <Navigate to="/" replace />;
  }

  if (role && user.role !== role) {
    // Send them to their correct dashboard instead of a blank redirect
    return <Navigate to={user.role === 'manager' ? '/manager' : '/employee'} replace />;
  }

  return children;
}
