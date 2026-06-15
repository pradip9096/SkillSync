/**
 * @file App.jsx
 * @description Root component that defines the application layout and routing structure.
 * 
 * Purpose: Provides the core structure of the application, including navigation and page routing.
 * Inputs: None.
 * Outputs: Returns the JSX for the entire application layout.
 * Side Effects: None.
 */

import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import GlobalErrorBoundary from './components/GlobalErrorBoundary';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';

// Lazy load route-level components
const Home = lazy(() => import('./pages/Home'));
const ExpertListing = lazy(() => import('./pages/ExpertListing'));
const ExpertDetail = lazy(() => import('./pages/ExpertDetail'));
const MyBookings = lazy(() => import('./pages/MyBookings'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Profile = lazy(() => import('./pages/Profile'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const ExpertDashboard = lazy(() => import('./pages/ExpertDashboard'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Messaging = lazy(() => import('./pages/Messaging'));
const Notifications = lazy(() => import('./pages/Notifications'));

/**
 * Main App Component.
 * 
 * Purpose: Wraps the application in a Router and defines the routes for different pages.
 * Parameters: None.
 * Return value: {JSX.Element} The rendered application tree.
 * Side effects: None.
 */
function App() {
  return (
    <Router>
      <AuthProvider>
        <NotificationProvider>
          <GlobalErrorBoundary>
            {/* Main container with a light gray background and minimum screen height */}
            <div className="min-h-screen bg-gray-50 flex flex-col">
              {/* Persistent Navigation Bar */}
              <Navbar />
            
            {/* Suspense boundary for code-split routes */}
            <Suspense fallback={
              <div className="flex justify-center items-center h-screen w-full">
                <div className="animate-pulse flex flex-col items-center">
                  <div className="h-12 w-12 bg-gray-300 rounded-full mb-4"></div>
                  <div className="h-4 w-24 bg-gray-300 rounded"></div>
                </div>
              </div>
            }>
              <Routes>
                {/* Landing page */}
                <Route path="/" element={<Home />} />

                {/* Public authentication routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password/:token" element={<ResetPassword />} />

                {/* List of experts */}
                <Route path="/experts" element={<ExpertListing />} />
                
                {/* Detailed view for a specific expert */}
                <Route path="/expert/:id" element={<ExpertDetail />} />
                
                {/* User's booking history page (protected, Clients only) */}
                <Route path="/my-bookings" element={
                  <ProtectedRoute allowedRoles={['Client']}>
                    <MyBookings />
                  </ProtectedRoute>
                } />

                {/* User's profile page (protected) */}
                <Route path="/profile" element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                } />

                {/* Messaging page (protected, Client/Expert) */}
                <Route path="/messaging" element={
                  <ProtectedRoute allowedRoles={['Client', 'Expert']}>
                    <Messaging />
                  </ProtectedRoute>
                } />

                {/* Notifications page (protected, Client/Expert) */}
                <Route path="/notifications" element={
                  <ProtectedRoute allowedRoles={['Client', 'Expert']}>
                    <Notifications />
                  </ProtectedRoute>
                } />

                {/* Admin dashboard page (protected, Admin only) */}
                <Route path="/admin" element={
                  <ProtectedRoute allowedRoles={['Admin']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                } />

                {/* Expert dashboard page (protected, Expert only) */}
                <Route path="/expert-dashboard" element={
                  <ProtectedRoute allowedRoles={['Expert']}>
                    <ExpertDashboard />
                  </ProtectedRoute>
                } />
              </Routes>
            </Suspense>
            </div>
          </GlobalErrorBoundary>
        </NotificationProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
