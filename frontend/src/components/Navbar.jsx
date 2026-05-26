/**
 * @file Navbar.jsx
 * @description Persistent navigation component that provides links to main app sections.
 * 
 * Purpose: Provides a consistent navigation interface across all pages of the application.
 * Inputs: None.
 * Outputs: JSX element representing the navigation bar.
 * Side Effects: Reads from React Router's location state to highlight the active link.
 */

import { Link, useLocation } from 'react-router-dom';
import { Calendar, LayoutGrid, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/**
 * Navbar Component.
 * 
 * Purpose: Renders the top navigation bar with links to Explore, My History, and Auth pages.
 * Parameters: None.
 * Return value: {JSX.Element} The rendered navigation bar.
 * Side effects: None.
 */
const Navbar = () => {
  // Access current location to highlight the active link
  const location = useLocation();
  
  // Access global authentication context
  const { user, logout } = useAuth();

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
          
          {/* Navigation Links & Auth Controls */}
          <div className="flex items-center gap-2 sm:gap-4 md:gap-6">
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
            {(!user || user.role !== 'Admin') && (
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
                <span className="sm:hidden text-[10px]">Bookings</span>
              </Link>
            )}

            {/* Profile Link */}
            {user && (
              <Link 
                to="/profile" 
                className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                  location.pathname === '/profile' 
                    ? 'text-blue-600 bg-blue-50 shadow-sm' 
                    : 'text-gray-500 hover:text-blue-600 hover:bg-gray-50'
                }`}
              >
                Profile
              </Link>
            )}

            {/* Admin Panel Link */}
            {user && user.role === 'Admin' && (
              <Link 
                to="/admin" 
                className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                  location.pathname === '/admin' 
                    ? 'text-red-600 bg-red-50 shadow-sm' 
                    : 'text-gray-500 hover:text-red-600 hover:bg-gray-50'
                }`}
              >
                Admin Panel
              </Link>
            )}

            {/* Expert Portal Link */}
            {user && user.role === 'Expert' && (
              <Link 
                to="/expert-dashboard" 
                className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                  location.pathname === '/expert-dashboard' 
                    ? 'text-purple-600 bg-purple-50 shadow-sm' 
                    : 'text-gray-500 hover:text-purple-600 hover:bg-gray-50'
                }`}
              >
                Expert Portal
              </Link>
            )}

            {/* Auth Controls */}
            {user ? (
              <div className="flex items-center gap-3 pl-4 border-l border-gray-100">
                {/* Role Badge */}
                <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                  user.role === 'Admin' 
                    ? 'bg-red-50 text-red-700 border-red-100' 
                    : user.role === 'Expert' 
                      ? 'bg-purple-50 text-purple-700 border-purple-100' 
                      : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                }`}>
                  {user.role}
                </span>
                
                {/* User email (truncated on small screens) */}
                <span className="text-xs font-bold text-gray-500 hidden md:inline max-w-[120px] truncate" title={user.email}>
                  {user.email}
                </span>

                {/* Logout Button */}
                <button
                  onClick={logout}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-all cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 pl-4 border-l border-gray-100">
                {/* Sign In Link */}
                <Link
                  to="/login"
                  className="px-3 py-2 text-sm font-bold text-gray-600 hover:text-indigo-600 rounded-xl transition-all"
                >
                  Sign In
                </Link>
                {/* Sign Up Link */}
                <Link
                  to="/register"
                  className="px-4 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-100 transition-all"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>

        </div>
      </div>
    </nav>
  );
};

export default Navbar;
