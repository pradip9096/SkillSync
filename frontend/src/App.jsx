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
      {/* Main container with a light gray background and minimum screen height */}
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Persistent Navigation Bar */}
        <Navbar />
        
        {/* Route Definitions */}
        <Routes>
          {/* Landing page */}
          <Route path="/" element={<Home />} />

          {/* List of experts */}
          <Route path="/experts" element={<ExpertListing />} />
          
          {/* Detailed view for a specific expert */}
          <Route path="/expert/:id" element={<ExpertDetail />} />
          
          {/* User's booking history page */}
          <Route path="/my-bookings" element={<MyBookings />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
