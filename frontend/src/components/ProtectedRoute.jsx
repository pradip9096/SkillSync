/**
 * @file ProtectedRoute.jsx
 * @description Routing guard component to protect private pages based on authentication state and user roles.
 * 
 * Purpose: Ensures anonymous users are redirected to login and unauthorized users are redirected home.
 * Inputs: Component children and allowedRoles list.
 * Outputs: Renders children or redirects to /login or /.
 * Side Effects: Reads authentication context.
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Show a full-page loading spinner while auth context resolves localStorage values
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Verifying authorization...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if user is not authenticated
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Redirect to home if user does not have the required role
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  // Render protected content if all guards pass
  return children;
};

export default ProtectedRoute;
