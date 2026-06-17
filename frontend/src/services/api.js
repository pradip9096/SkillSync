/**
 * @file api.js
 * @description Service layer for making HTTP requests to the backend API using Axios.
 * 
 * Purpose: Centralizes all API interactions for the application.
 * Inputs: Various parameters depending on the function (IDs, data objects, query params).
 * Outputs: Axios promises that resolve to API responses.
 * Side Effects: Performs network I/O to communicate with the backend server.
 */

import axios from 'axios';

/**
 * Axios instance with a predefined base URL.
 * All requests made through this instance will be prefixed with this URL.
 * @type {import('axios').AxiosInstance}
 */
const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
});

// Request interceptor to automatically attach JWT token to Authorization headers
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor: auto-clear stale/invalid tokens and redirect to login
API.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    // Gracefully handle server restarts (502/503) or complete network disconnections
    if (status === 502 || status === 503 || !error.response) {
      console.warn('Network instability detected. The server may be restarting.');
      // Return a structured synthetic error so downstream components don't crash on `error.response.data`
      return Promise.reject({
        isNetworkError: true,
        message: 'Experiencing network instability, please wait.',
        response: { data: { error: 'Network unavailable. Please try again in a moment.' } }
      });
    }

    // 401 ONLY: token is missing, expired, or points to a deleted user.
    // Do NOT intercept 403 — that means the user exists but lacks permission for
    // that specific route (e.g. Expert accessing Admin endpoints). Logging them out
    // on 403 would destroy a perfectly valid session.
    if (status === 401) {
      const currentToken = localStorage.getItem('token');
      if (currentToken) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // Hard redirect: forces AuthContext to reinitialise with no credentials
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Fetch a list of experts with optional filters.
 * 
 * Purpose: Retrieves experts from the backend with pagination, search, or category filters.
 * @param {Object} params - Query parameters for filtering.
 * @param {string} [params.search] - Search string for expert names.
 * @param {string} [params.category] - Category filter.
 * @returns {Promise<import('axios').AxiosResponse>} A promise resolving to the API response.
 * Side effects: Performs a GET network request.
 */
export const fetchExperts = (params) => API.get('/experts', { params });

/**
 * Fetch details for a specific expert by their ID.
 * 
 * Purpose: Retrieves full details of a single expert.
 * @param {string} id - The expert's unique ID.
 * @returns {Promise<import('axios').AxiosResponse>} A promise resolving to the API response.
 * Side effects: Performs a GET network request.
 */
export const fetchExpertById = (id) => API.get(`/experts/${id}`);

/**
 * Fetch all booked time slots for an expert on a specific date.
 * 
 * Purpose: Used to identify and disable already booked slots in the UI.
 * @param {string} expertId - The expert's ID.
 * @param {string} date - Date in YYYY-MM-DD format.
 * @returns {Promise<import('axios').AxiosResponse>} A promise resolving to the API response.
 * Side effects: Performs a GET network request.
 */
export const fetchBookedSlots = (expertId, date) => API.get(`/bookings/booked-slots/${expertId}/${date}`);

/**
 * Submit a new booking request.
 * 
 * Purpose: Creates a new session booking for a user.
 * @param {Object} bookingData - The user's booking details.
 * @param {string} bookingData.expert - Expert ID.
 * @param {string} bookingData.userName - User's name.
 * @param {string} bookingData.userEmail - User's email.
 * @param {string} bookingData.bookingDate - Selected date.
 * @param {string} bookingData.slotTime - Selected time slot.
 * @returns {Promise<import('axios').AxiosResponse>} A promise resolving to the API response.
 * Side effects: Performs a POST network request.
 */
export const createBooking = (bookingData) => API.post('/bookings', bookingData);
export const verifyPayment = (paymentData) => API.post('/bookings/verify-payment', paymentData);

/**
 * Fetch booking history for a user based on their email.
 * 
 * Purpose: Retrieves all bookings associated with a specific user email.
 * @param {string} email - The user's email address.
 * @returns {Promise<import('axios').AxiosResponse>} A promise resolving to the API response.
 * Side effects: Performs a GET network request.
 */
export const fetchBookingsByEmail = (email) => API.get('/bookings', { params: { email } });

/**
 * Update the status of an existing booking.
 * 
 * Purpose: Changes the status of a booking (e.g., to 'Cancelled' or 'Completed').
 * @param {string} id - The booking ID.
 * @param {string} status - The new status.
 * @returns {Promise<import('axios').AxiosResponse>} A promise resolving to the API response.
 * Side effects: Performs a PATCH network request.
 */
export const updateBookingStatus = (id, status) => API.patch(`/bookings/${id}/status`, { status });

/**
 * Submit a rating for an expert.
 * 
 * Purpose: Updates the aggregate rating of an expert based on a new user rating.
 * @param {string} expertId - The expert's ID.
 * @param {number} rating - The rating value (1-5).
 * @param {string} [comment] - Optional text comment/review.
 * @param {string} bookingId - The booking ID associated with the review.
 * @returns {Promise<import('axios').AxiosResponse>} A promise resolving to the API response.
 * Side effects: Performs a POST network request.
 */
export const rateExpert = (expertId, rating, comment, bookingId) => API.post(`/experts/${expertId}/rate`, { rating, comment, bookingId });

/**
 * Fetch Twilio STUN/TURN credentials for WebRTC connections.
 * @param {string} bookingId - The booking ID.
 * @returns {Promise<import('axios').AxiosResponse>}
 */
export const fetchVideoToken = (bookingId) => API.get(`/bookings/${bookingId}/video-token`);

/**
 * Mark a booking as having been rated.
 * 
 * Purpose: Updates a booking record to indicate that the user has already provided a rating.
 * @param {string} bookingId - The booking ID.
 * @returns {Promise<import('axios').AxiosResponse>} A promise resolving to the API response.
 * Side effects: Performs a PATCH network request.
 */
export const markBookingAsRated = (bookingId) => API.patch(`/bookings/${bookingId}/rate`);

/**
 * Submit a rating for a client by an expert.
 * 
 * Purpose: Submits a review and rating for a client after a completed session.
 * @param {string} bookingId - The booking ID.
 * @param {number} rating - The rating value (1-5).
 * @param {string} [comment] - Optional comment.
 * @returns {Promise<import('axios').AxiosResponse>} A promise resolving to the API response.
 * Side effects: Performs a POST network request.
 */
export const rateClient = (bookingId, rating, comment) => API.post(`/expert-dashboard/bookings/${bookingId}/rate-client`, { rating, comment });

// --- Profile APIs ---
export const fetchUserProfile = () => API.get('/auth/profile');
export const updateUserProfile = (profileData) => API.put('/auth/profile', profileData);
export const uploadProfileImage = (formData) => API.put('/auth/profile/image', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});
export const forgotPassword = (email) => API.post('/auth/forgot-password', { email });
export const resetPassword = (token, password) => API.put(`/auth/reset-password/${token}`, { password });

// --- Admin Dashboard APIs ---
export const adminFetchUsers = (page = 1, limit = 20) => API.get('/admin/users', { params: { page, limit } });
export const adminFetchBookings = (page = 1, limit = 20) => API.get('/admin/bookings', { params: { page, limit } });
export const adminUpdateBookingStatus = (id, status) => API.patch(`/admin/bookings/${id}/status`, { status });
export const adminDeleteBooking = (id) => API.delete(`/admin/bookings/${id}`);
export const adminCreateExpert = (expertData) => API.post('/admin/experts', expertData);
export const adminDeleteExpert = (id) => API.delete(`/admin/experts/${id}`);
export const adminResetPenalties = (id) => API.post(`/admin/users/${id}/reset-penalties`);

// --- Expert Dashboard APIs ---
export const fetchExpertDashboardBookings = (page = 1, limit = 20) => API.get('/expert-dashboard/bookings', { params: { page, limit } });
export const fetchExpertDashboardProfile = () => API.get('/expert-dashboard/profile');
export const updateExpertDashboardProfile = (profileData) => API.put('/expert-dashboard/profile', profileData);
export const expertBlockSlot = (bookingDate, slotTime) => API.post('/expert-dashboard/block-slot', { bookingDate, slotTime });
export const expertUnblockSlot = (bookingDate, slotTime) => API.post('/expert-dashboard/unblock-slot', { bookingDate, slotTime });
export const uploadGalleryImage = (formData) => API.post('/expert-dashboard/gallery', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});
export const deleteGalleryImage = (filename) => API.delete(`/expert-dashboard/gallery/${filename}`);
export const fetchExpertDashboardAnalytics = () => API.get('/expert-dashboard/analytics');

// --- Messaging APIs ---
export const fetchConversations = () => API.get('/messages/conversations');
export const fetchMessages = (bookingId, before) => {
  let url = `/messages/booking/${bookingId}`;
  if (before) url += `?before=${before}`;
  return API.get(url);
};
export const sendMessage = (messageData) => API.post('/messages', messageData);
export const markMessagesAsRead = (bookingId) => API.patch(`/messages/booking/${bookingId}/read`);
export const fetchUnreadMessageCount = () => API.get('/messages/unread-count');

// --- Notification APIs ---
export const fetchNotifications = () => API.get('/notifications');
export const markNotificationAsRead = (id) => API.patch(`/notifications/${id}/read`);
export const markAllNotificationsAsRead = () => API.patch('/notifications/read-all');
export const fetchUnreadNotificationCount = () => API.get('/notifications/unread-count');

export default API;
