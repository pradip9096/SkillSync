/* eslint-disable react-refresh/only-export-components */
/**
 * @file AuthContext.jsx
 * @description React Context to manage authentication state, user roles, and local token storage.
 * 
 * Purpose: Provides login, register, logout, and profile-sync methods globally across the React application.
 * Inputs: Email, password, and roles.
 * Outputs: Context values (user, loading, error, login, register, logout, updateUserProfile).
 * Side Effects: Reads/Writes to localStorage.
 */

import { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

// Create the Context object
const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Set up API base URL (consistent with services/api.js)
  const API_URL = 'http://localhost:5000/auth';

  // Initialize: Load user details if token exists
  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        
        // Attach token to axios default headers
        axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  /**
   * Action: Register a new user.
   * @param {string} email - Registration email.
   * @param {string} password - Registration password.
   * @param {string} role - User role selection ('Client' or 'Expert').
   */
  const register = async (email, password, role) => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.post(`${API_URL}/register`, { email, password, role });
      const { token: receivedToken, user: receivedUser } = response.data;

      // Save token and user details to localStorage
      localStorage.setItem('token', receivedToken);
      localStorage.setItem('user', JSON.stringify(receivedUser));

      // Set state
      setToken(receivedToken);
      setUser(receivedUser);

      // Attach auth header
      axios.defaults.headers.common['Authorization'] = `Bearer ${receivedToken}`;
      return true;
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Registration failed. Please try again.';
      setError(errorMsg);
      throw new Error(errorMsg, { cause: err });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Action: Log in an existing user.
   * @param {string} email - Login email.
   * @param {string} password - Login password.
   */
  const login = async (email, password) => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.post(`${API_URL}/login`, { email, password });
      const { token: receivedToken, user: receivedUser } = response.data;

      // Save token and user details to localStorage
      localStorage.setItem('token', receivedToken);
      localStorage.setItem('user', JSON.stringify(receivedUser));

      // Set state
      setToken(receivedToken);
      setUser(receivedUser);

      // Attach auth header
      axios.defaults.headers.common['Authorization'] = `Bearer ${receivedToken}`;
      return true;
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Login failed. Please check your credentials.';
      setError(errorMsg);
      throw new Error(errorMsg, { cause: err });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Action: Log out the current user and clear sessions.
   */
  const logout = () => {
    // Clear localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('userEmail'); // Also clear history search email for convenience

    // Reset state
    setToken(null);
    setUser(null);
    setError(null);

    // Remove auth header
    delete axios.defaults.headers.common['Authorization'];
  };

  /**
   * Action: Dynamically updates the logged-in user's profile details in state and storage.
   * Purpose: Syncs name and phone number locally after the first booking triggers an auto-save.
   * @param {string} name - User's name.
   * @param {string} phone - User's phone number.
   */
  const updateUserProfile = (name, phone) => {
    if (!user) return;
    const updatedUser = { ...user, name, phone };
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        error,
        register,
        login,
        logout,
        updateUserProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Custom Hook to consume AuthContext easily
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
