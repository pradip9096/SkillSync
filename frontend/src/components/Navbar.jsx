/**
 * @file Navbar.jsx
 * @description Persistent navigation component that provides links to main app sections.
 * 
 * Purpose: Provides a consistent navigation interface across all pages of the application.
 * Inputs: None.
 * Outputs: JSX element representing the navigation bar.
 * Side Effects: Reads from React Router's location state to highlight the active link.
 */

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Calendar, User, LayoutGrid } from 'lucide-react';

/**
 * Navbar Component.
 * 
 * Purpose: Renders the top navigation bar with links to Explore and My History pages.
 * Parameters: None.
 * Return value: {JSX.Element} The rendered navigation bar.
 * Side effects: None.
 */
const Navbar = () => {
  // Access current location to highlight the active link
  const location = useLocation();

  return (
    <nav className="bg-white/80 backdrop-blur-md shadow-sm border-b border-gray-100 sticky top-0 z-50 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20">
          
          {/* Logo and Home Link */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="bg-blue-600 p-2.5 rounded-xl group-hover:rotate-12 transition-transform duration-300 shadow-lg shadow-blue-200">
                <LayoutGrid className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-black text-gray-900 tracking-tighter">
                Skill<span className="text-blue-600">Sync</span>
              </span>
            </Link>
          </div>
          
          {/* Navigation Links */}
          <div className="flex items-center gap-2 sm:gap-6">
            {/* Explore Link */}
            <Link 
              to="/experts" 
              className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                location.pathname === '/experts' 
                  ? 'text-blue-600 bg-blue-50 shadow-sm' 
                  : 'text-gray-500 hover:text-blue-600 hover:bg-gray-50'
              }`}
            >
              Explore
            </Link>

            {/* My History / Bookings Link */}
            <Link 
              to="/my-bookings" 
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                location.pathname === '/my-bookings' 
                  ? 'text-blue-600 bg-blue-50 shadow-sm' 
                  : 'text-gray-500 hover:text-blue-600 hover:bg-gray-50'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">My History</span>
              {/* Responsive text for mobile */}
              <span className="sm:hidden text-[10px]">Bookings</span>
            </Link>
          </div>

        </div>
      </div>
    </nav>
  );
};

export default Navbar;
