/**
 * @file App.jsx
 * @description Root component that defines the application layout and routing structure.
 * 
 * Purpose: Provides the core structure of the application, including navigation and page routing.
 * Inputs: None.
 * Outputs: Returns the JSX for the entire application layout.
 * Side Effects: None.
 */

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import ExpertListing from './pages/ExpertListing';
import ExpertDetail from './pages/ExpertDetail';
import MyBookings from './pages/MyBookings';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import AdminDashboard from './pages/AdminDashboard';
import ExpertDashboard from './pages/ExpertDashboard';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';

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
        {/* Main container with a light gray background and minimum screen height */}
        <div className="min-h-screen bg-gray-50 flex flex-col">
          {/* Persistent Navigation Bar */}
          <Navbar />
          
          {/* Route Definitions */}
          <Routes>
            {/* Landing page */}
            <Route path="/" element={<Home />} />

            {/* Public authentication routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

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
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
