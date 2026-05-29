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
import { connectSocket, disconnectSocket } from '../services/socket';

/**
 * Decode a JWT token and check whether it is expired.
 * Does NOT verify the signature (that is the server's job).
 * Used only for proactive client-side session hygiene.
 * @param {string} token - JWT string from localStorage.
 * @returns {boolean} true if the token is valid and not expired.
 */
const isTokenValid = (token) => {
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // exp is in seconds; Date.now() is in milliseconds
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
};

// Create the Context object
const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Set up API base URL (consistent with services/api.js)
  const API_URL = 'http://localhost:5000/auth';

  // Initialize: Load user details if token exists AND is not expired
  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');

      if (storedToken && storedUser) {
        // Proactively clear expired tokens before any API call is made.
        // This prevents silent 401s deep inside the app from a stale session.
        if (!isTokenValid(storedToken)) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setLoading(false);
          return;
        }

        const parsedUser = JSON.parse(storedUser);
        setToken(storedToken);
        setUser(parsedUser);
        connectSocket(storedToken);

        // Attach token to axios default headers
        axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;

        try {
          // Fetch the latest user profile from the server to sync any changes (e.g. role updates)
          const response = await axios.get(`${API_URL}/profile`, {
            headers: { Authorization: `Bearer ${storedToken}` }
          });
          if (response.data && response.data.user) {
            const freshUser = response.data.user;
            localStorage.setItem('user', JSON.stringify(freshUser));
            setUser(freshUser);
          }
        } catch (err) {
          console.error('Failed to sync profile on load:', err);
          // If the token is invalid on the server (e.g., user deleted), clear state
          if (err.response?.status === 401 || err.response?.status === 404) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setToken(null);
            setUser(null);
            delete axios.defaults.headers.common['Authorization'];
          }
        }
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
  const register = async (email, password, role, extraFields = {}) => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.post(`${API_URL}/register`, {
        email,
        password,
        role,
        ...extraFields
      });
      const { token: receivedToken, user: receivedUser } = response.data;

      // Save token and user details to localStorage
      localStorage.setItem('token', receivedToken);
      localStorage.setItem('user', JSON.stringify(receivedUser));

      // Set state
      setToken(receivedToken);
      setUser(receivedUser);
      connectSocket(receivedToken);

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
      connectSocket(receivedToken);

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
    disconnectSocket();

    // Remove auth header
    delete axios.defaults.headers.common['Authorization'];
  };

  /**
   * Action: Log in dynamically with a pre-existing token and user payload.
   * Purpose: Used during auto-login after successful password reset.
   */
  const loginWithToken = (receivedToken, receivedUser) => {
    localStorage.setItem('token', receivedToken);
    localStorage.setItem('user', JSON.stringify(receivedUser));
    setToken(receivedToken);
    setUser(receivedUser);
    connectSocket(receivedToken);
    axios.defaults.headers.common['Authorization'] = `Bearer ${receivedToken}`;
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
        loginWithToken,
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
