/**
 * @file MyBookings.jsx
 * @description Page for users to view and manage their personal booking history.
 * 
 * Purpose: Allows users to search for bookings by email, cancel upcoming sessions, and rate completed sessions.
 * Inputs: User email (from input or localStorage).
 * Outputs: JSX element for the booking history page.
 * Side Effects:
 * - Fetches bookings from the server.
 * - Updates booking status on the server.
 * - Submits expert ratings to the server.
 * - Reads/Writes user email to localStorage.
 */

import { useState, useEffect } from 'react';
import { fetchBookingsByEmail, updateBookingStatus, rateExpert, verifyPayment } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Mail, Search, Calendar, Clock, User, CheckCircle2, AlertCircle, Loader2, History, XCircle, CheckCircle, Star, Sparkles } from 'lucide-react';

/**
 * MyBookings Page Component.
 * 
 * Purpose: Manages state for user bookings, search functionality, and post-session actions.
 * Parameters: None.
 * Return value: {JSX.Element} The rendered booking history page.
 * Side effects: API interactions and localStorage updates.
 */
const MyBookings = () => {
  const { user } = useAuth();
  // State for user email, initialized from localStorage or context if available
  const [email, setEmail] = useState(user?.email || localStorage.getItem('userEmail') || '');
  // State for the list of user bookings
  const [bookings, setBookings] = useState([]);
  const [keyId, setKeyId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  // States for tracking loading during status updates or rating submissions
  const [actionLoading, setActionLoading] = useState(null); 
  const [ratingLoading, setRatingLoading] = useState(null);
  
  // Interactive Rating & Review Editor States
  const [activeRatingId, setActiveRatingId] = useState(null);
  const [ratingValue, setRatingValue] = useState(5);
  const [commentValue, setCommentValue] = useState('');
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, bookingId: null, isLate: false });

  useEffect(() => {
    const timerId = window.setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => window.clearInterval(timerId);
  }, []);

  /**
   * Atomic Check Helper: Determines if a session has passed based on IST time.
   * 
   * Purpose: Enables the "Mark as Completed" button only after the session starts.
   * @param {string} date - Booking date (YYYY-MM-DD).
   * @param {string} time - Booking time (HH:MM).
   * @returns {boolean} True if the session start time has passed.
   */
  const isSessionPast = (date, time) => {
    if (!date || !time) return false;
    const sessionDateTime = new Date(`${date}T${time}:00+05:30`);
    const sessionMs = sessionDateTime.getTime();
    if (Number.isNaN(sessionMs)) return false;
    return sessionMs <= new Date().getTime();
  };

  const isWithinTwoHours = (date, time) => {
    if (!date || !time) return false;
    const sessionDateTime = new Date(`${date}T${time}:00+05:30`);
    const sessionMs = sessionDateTime.getTime();
    if (Number.isNaN(sessionMs)) return false;
    const nowMs = new Date().getTime();
    const twoHoursInMs = 2 * 60 * 60 * 1000;
    return sessionMs > nowMs && (sessionMs - nowMs) <= twoHoursInMs;
  };

  const getRemainingTime = (createdAtString) => {
    const createdMs = new Date(createdAtString).getTime();
    const expiryMs = createdMs + 5 * 60 * 1000;
    const remaining = expiryMs - currentTime;
    return Math.max(0, remaining);
  };

  const formatCountdown = (ms) => {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handlePaymentRetry = async (booking) => {
    try {
      setActionLoading(booking._id);
      
      const loadScript = () => {
        return new Promise((resolve) => {
          if (window.Razorpay) {
            resolve(true);
            return;
          }
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload = () => resolve(true);
          script.onerror = () => resolve(false);
          document.body.appendChild(script);
        });
      };

      const scriptLoaded = await loadScript();
      if (!scriptLoaded) {
        alert('Failed to load Razorpay SDK. Please check your internet connection.');
        return;
      }

      const hourlyRate = booking.expert?.hourlyRate;
      if (!hourlyRate) {
        alert('Error: Hourly rate not specified.');
        return;
      }

      const amount = Math.round(hourlyRate * 100);

      const options = {
        key: keyId || import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: amount,
        currency: 'INR',
        name: 'SkillSync',
        description: `Booking session with ${booking.expert?.name || 'Expert'}`,
        order_id: booking.razorpayOrderId,
        handler: async function (response) {
          try {
            setActionLoading(booking._id);
            const { data: verifyData } = await verifyPayment({
              bookingId: booking._id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,
              razorpaySignature: response.razorpay_signature
            });

            if (verifyData.data) {
              // Refresh list
              const { data } = await fetchBookingsByEmail(email);
              setBookings(data.data);
              setKeyId(data.keyId);
            } else {
              alert('Payment verification failed.');
            }
          } catch (err) {
            alert(err.response?.data?.error || 'Payment verification failed.');
          } finally {
            setActionLoading(null);
          }
        },
        prefill: {
          name: booking.userName,
          email: booking.userEmail,
          contact: (booking.userPhone || '').replace(/^\+91/, '')
        },
        theme: {
          color: '#2563eb'
        },
        modal: {
          ondismiss: function () {
            alert('Payment cancelled. Please complete payment to confirm your booking.');
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error('Retry checkout failed:', err);
      alert('Retry checkout failed. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelClick = (booking) => {
    const isWithinTwo = isWithinTwoHours(booking.bookingDate, booking.slotTime);
    setConfirmModal({
      isOpen: true,
      bookingId: booking._id,
      isLate: isWithinTwo
    });
  };

  /**
   * Helper: Returns tailwind color classes based on booking status.
   * 
   * Purpose: Provides visual distinction for different booking states.
   * @param {string} status - Booking status.
   * @returns {string} Tailwind CSS classes.
   */
  const getStatusColor = (status) => {
    switch (status) {
      case 'Confirmed': return 'bg-green-50 text-green-700 border-green-100';
      case 'Pending': return 'bg-yellow-50 text-yellow-700 border-yellow-100';
      case 'Completed': return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'Cancelled': return 'bg-red-50 text-red-700 border-red-100';
      case 'Late Cancellation': return 'bg-orange-50 text-orange-700 border-orange-100';
      default: return 'bg-gray-50 text-gray-700 border-gray-100';
    }
  };

  /**
   * Handler: Search for bookings associated with the provided email.
   * 
   * Purpose: Fetches user-specific data and persists the search email.
   * @param {React.FormEvent} [e] - Optional form event.
   */
  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!email) return;

    try {
      setLoading(true);
      setError(null);
      const { data } = await fetchBookingsByEmail(email);
      setBookings(data.data);
      setKeyId(data.keyId);
      // Persist email to localStorage for convenience on next visit
      localStorage.setItem('userEmail', email);
      setHasSearched(true);
    } catch (err) {
      console.error(err);
      setError('Failed to load bookings. Please check your email and try again.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handler: Update the status of a booking.
   * 
   * Purpose: Allows users to mark sessions as completed or cancel them.
   * @param {string} bookingId - ID of the booking.
   * @param {string} newStatus - The new status to set.
   */
  const handleStatusUpdate = async (bookingId, newStatus) => {
    try {
      setActionLoading(bookingId);
      await updateBookingStatus(bookingId, newStatus);
      // Optimistically update the UI to instantly reflect the new status
      setBookings(prev => prev.map(b => b._id === bookingId ? { ...b, status: newStatus } : b));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update booking status.');
    } finally {
      setActionLoading(null);
    }
  };

  /**
   * Handler: Submit a rating for the expert.
   * 
   * Purpose: Updates expert rating and marks the booking as rated.
   * @param {string} bookingId - ID of the booking.
   * @param {string} expertId - ID of the expert being rated.
   * @param {number} rating - Rating value (1-5).
   */
  const handleRating = async (bookingId, expertId, rating, comment) => {
    try {
      setRatingLoading(bookingId);
      // Update the expert's aggregate rating & create review
      await rateExpert(expertId, rating, comment, bookingId);
      // Refresh list
      const { data } = await fetchBookingsByEmail(email);
      setBookings(data.data);
      setKeyId(data.keyId);
      // Reset form states
      setActiveRatingId(null);
      setRatingValue(5);
      setCommentValue('');
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to submit rating.');
    } finally {
      setRatingLoading(null);
    }
  };

  // Initial load: If authenticated user or stored email is available, fetch bookings immediately.
  useEffect(() => {
    if (user && user.email) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEmail(user.email);
      const getInitialBookings = async () => {
        try {
          setLoading(true);
          setError(null);
          const { data } = await fetchBookingsByEmail(user.email);
          setBookings(data.data);
          setKeyId(data.keyId);
          localStorage.setItem('userEmail', user.email);
          setHasSearched(true);
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      };
      getInitialBookings();
    } else if (email) {
      const deferSearch = setTimeout(() => {
        handleSearch();
      }, 0);
      return () => clearTimeout(deferSearch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <div className="min-h-screen bg-gray-50/50 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        
        {/* Header Section */}
        <div className="text-center mb-12 animate-fade-in">
          <h1 className="text-5xl font-black text-gray-900 mb-4 tracking-tight flex items-center justify-center gap-4">
            <History className="w-12 h-12 text-blue-600" /> My History
          </h1>
          <p className="text-xl text-gray-600 font-medium max-w-xl mx-auto">Manage your upcoming and past sessions with our industry experts.</p>
          {/* Visual indicator of current IST time for reference */}
          <div className="inline-block px-4 py-1.5 bg-gray-100 rounded-full text-[10px] font-black text-gray-400 uppercase tracking-widest border border-gray-200 mt-4">
            Current IST Time: {new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true })}
          </div>
        </div>

        {/* Suspension Banner */}
        {user && user.suspendedUntil && new Date(user.suspendedUntil).getTime() > currentTime && (
          <div className="bg-amber-50 border-2 border-amber-100 rounded-3xl p-6 mb-8 flex items-start gap-4 animate-slide-up">
            <div className="bg-amber-500 text-white p-2 rounded-xl shadow-sm">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-amber-800 font-black uppercase text-xs tracking-wider mb-1">Booking Privileges Suspended</h3>
              <p className="text-amber-700 text-sm font-semibold">
                Your booking privileges are temporarily suspended due to repeated late cancellations. 
                Access will be automatically restored on{' '}
                <span className="font-bold text-amber-900">
                  {new Date(user.suspendedUntil).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                    timeZone: 'Asia/Kolkata'
                  })}{' '}
                  IST
                </span>
                .
              </p>
            </div>
          </div>
        )}

        {/* Email Search Bar Section */}
        <form onSubmit={handleSearch} className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-blue-900/5 border border-gray-100 mb-12 animate-slide-up">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-grow group">
              <label htmlFor="searchEmail" className="sr-only">Email Address</label>
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-6 h-6 group-focus-within:text-blue-500 transition-colors" />
              <input
                id="searchEmail"
                name="searchEmail"
                type="email"
                placeholder="registered@email.com"
                className="w-full pl-14 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-black py-4 px-10 rounded-2xl transition-all shadow-xl shadow-blue-500/20 flex items-center justify-center gap-3 md:min-w-[200px] active:scale-95 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Search className="w-6 h-6" />}
              {loading ? 'SYNCING...' : 'VIEW SESSIONS'}
            </button>
          </div>
        </form>

        {/* Dynamic Content: Results or Empty State */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="w-16 h-16 text-blue-600 animate-spin" />
            <p className="text-gray-400 font-bold mt-4 uppercase tracking-widest text-xs">Accessing Records...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-100 text-red-700 px-8 py-6 rounded-3xl flex items-center gap-4 animate-fade-in">
            <AlertCircle className="w-8 h-8 text-red-500" />
            <p className="font-bold text-lg">{error}</p>
          </div>
        ) : hasSearched && (bookings || []).length > 0 ? (
          <div className="space-y-8">
            {(bookings || []).map((booking, index) => (
              <div 
                key={booking._id} 
                className="group bg-white rounded-[2rem] shadow-xl shadow-blue-900/5 border border-gray-100 overflow-hidden hover:border-blue-200 transition-all duration-300 animate-slide-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="p-8">
                  {/* Expert Summary Header */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                    <div className="flex items-center gap-6">
                      <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-[1.5rem] flex items-center justify-center shadow-lg shadow-blue-200 group-hover:rotate-6 transition-transform">
                        <User className="w-10 h-10 text-white" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-black text-gray-900 leading-tight">{booking.expert?.name || 'Deleted Expert'}</h3>
                        <p className="text-sm text-blue-500 font-black uppercase tracking-widest mt-1">{booking.expert?.category}</p>
                      </div>
                    </div>
                    <span className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-tighter border-2 ${getStatusColor(booking.status)}`}>
                      {booking.status}
                    </span>
                  </div>

                  {/* Visual indicator of whether the session is eligible for completion */}
                  <div className="mb-6 px-4 py-2 bg-blue-50 rounded-lg border border-blue-100 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Time-Lock Status</span>
                    <span className={`text-[10px] font-black uppercase ${isSessionPast(booking.bookingDate, booking.slotTime) ? 'text-green-600' : 'text-orange-500'}`}>
                      {isSessionPast(booking.bookingDate, booking.slotTime) ? 'Eligible for Completion' : 'Locked until Start Time'}
                    </span>
                  </div>

                  {/* Booking Metadata (Date, Time, Session ID) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 p-6 bg-gray-50 rounded-2xl mb-8">
                    <div className="flex items-center gap-4 text-gray-600">
                      <div className="bg-white p-2.5 rounded-xl shadow-sm"><Calendar className="w-5 h-5 text-blue-500" /></div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Date</p>
                        <p className="font-black text-gray-900 uppercase">{booking.bookingDate}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-gray-600">
                      <div className="bg-white p-2.5 rounded-xl shadow-sm"><Clock className="w-5 h-5 text-blue-500" /></div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Time Slot</p>
                        <p className="font-black text-gray-900 uppercase">
                          {booking.slotTime.startsWith('09') || booking.slotTime.startsWith('10') || booking.slotTime.startsWith('11') ? `${booking.slotTime} AM` : 
                           booking.slotTime.startsWith('12') ? '12:00 PM' :
                           `${parseInt(booking.slotTime.split(':')[0]) - 12}:${booking.slotTime.split(':')[1]} PM`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-gray-600">
                      <div className="bg-white p-2.5 rounded-xl shadow-sm"><Sparkles className="w-5 h-5 text-blue-500" /></div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Session ID</p>
                        <p className="font-mono text-sm font-black text-blue-600">#{booking._id.substring(18).toUpperCase()}</p>
                      </div>
                    </div>
                  </div>

                  {booking.status === 'Confirmed' && (
                    <div className="flex flex-wrap gap-4">
                      {/* Only allow completion if session time has arrived */}
                      {isSessionPast(booking.bookingDate, booking.slotTime) ? (
                        <button
                          onClick={() => handleStatusUpdate(booking._id, 'Completed')}
                          disabled={actionLoading === booking._id}
                          className="flex-grow flex items-center justify-center gap-3 bg-blue-600 text-white hover:bg-blue-700 font-black py-4 px-8 rounded-2xl transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 active:scale-95"
                        >
                          {actionLoading === booking._id ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                          MARK AS COMPLETED
                        </button>
                      ) : (
                        <div className="flex-grow flex items-center justify-center gap-3 bg-gray-100 text-gray-400 font-black py-4 px-8 rounded-2xl border-2 border-dashed border-gray-200 cursor-help" title="Session time has not arrived yet">
                          <Clock className="w-5 h-5" />
                          UPCOMING SESSION
                        </div>
                      )}
                      {!isSessionPast(booking.bookingDate, booking.slotTime) && (
                        <button
                          onClick={() => handleCancelClick(booking)}
                          disabled={actionLoading === booking._id}
                          className="flex-grow flex items-center justify-center gap-3 bg-white text-red-600 hover:bg-red-50 border-2 border-red-100 font-black py-4 px-8 rounded-2xl transition-all disabled:opacity-50 active:scale-95"
                        >
                          {actionLoading === booking._id ? <Loader2 className="w-5 h-5 animate-spin" /> : <XCircle className="w-5 h-5" />}
                          CANCEL SESSION
                        </button>
                      )}
                    </div>
                  )}

                  {booking.status === 'Pending' && (
                    <div className="flex flex-wrap gap-4 animate-fade-in">
                      {getRemainingTime(booking.createdAt) > 0 ? (
                        <>
                          <button
                            onClick={() => handlePaymentRetry(booking)}
                            disabled={actionLoading === booking._id}
                            className="flex-grow flex items-center justify-center gap-3 bg-yellow-500 hover:bg-yellow-600 text-white font-black py-4 px-8 rounded-2xl transition-all shadow-lg shadow-yellow-500/20 disabled:opacity-50 active:scale-95"
                          >
                            {actionLoading === booking._id ? <Loader2 className="w-5 h-5 animate-spin" /> : <Clock className="w-5 h-5" />}
                            PAY NOW ({formatCountdown(getRemainingTime(booking.createdAt))})
                          </button>
                          <button
                            onClick={() => handleStatusUpdate(booking._id, 'Cancelled')}
                            disabled={actionLoading === booking._id}
                            className="flex-grow flex items-center justify-center gap-3 bg-white text-red-600 hover:bg-red-50 border-2 border-red-100 font-black py-4 px-8 rounded-2xl transition-all disabled:opacity-50 active:scale-95"
                          >
                            {actionLoading === booking._id ? <Loader2 className="w-5 h-5 animate-spin" /> : <XCircle className="w-5 h-5" />}
                            CANCEL RESERVATION
                          </button>
                        </>
                      ) : (
                        <div className="flex-grow flex items-center justify-center gap-3 bg-gray-100 text-gray-400 font-black py-4 px-8 rounded-2xl border-2 border-dashed border-gray-200 w-full" title="Reservation has expired. The slot will be released soon.">
                          <XCircle className="w-5 h-5 text-gray-400" />
                          RESERVATION EXPIRED
                        </div>
                      )}
                    </div>
                  )}

                  {/* Post-Session Rating UI */}
                  {booking.status === 'Completed' && !booking.isRated && activeRatingId !== booking._id && (
                    <div className="mt-4 flex justify-start">
                      <button
                        onClick={() => {
                          setActiveRatingId(booking._id);
                          setRatingValue(5);
                          setCommentValue('');
                        }}
                        className="flex items-center gap-2 px-6 py-3 bg-yellow-50 hover:bg-yellow-100 border border-yellow-200 text-yellow-800 text-xs font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
                      >
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" /> Rate & Review Session
                      </button>
                    </div>
                  )}

                  {booking.status === 'Completed' && !booking.isRated && activeRatingId === booking._id && (
                    <div className="p-8 border border-yellow-200 bg-yellow-50/20 rounded-3xl animate-fade-in space-y-6">
                      <p className="text-lg font-black text-gray-900 flex items-center gap-2">
                        <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" /> Rate & Review Your Session
                      </p>
                      
                      {/* Star Selector */}
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setRatingValue(star)}
                            className="focus:outline-none transition-transform hover:scale-110 cursor-pointer"
                          >
                            <Star className={`w-8 h-8 ${star <= ratingValue ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`} />
                          </button>
                        ))}
                      </div>

                      {/* Comment Textarea */}
                      <div className="space-y-2">
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest px-1">Write your review (optional)</label>
                        <textarea
                          rows="3"
                          placeholder="How was your session? What did you discuss? Share your experience with others..."
                          value={commentValue}
                          onChange={(e) => setCommentValue(e.target.value)}
                          className="w-full p-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-bold transition-all text-sm"
                        />
                      </div>

                      {/* Buttons */}
                      <div className="flex gap-4">
                        <button
                          disabled={ratingLoading === booking._id}
                          onClick={() => handleRating(booking._id, booking.expert?._id, ratingValue, commentValue)}
                          className="flex items-center justify-center gap-1.5 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer disabled:opacity-50"
                        >
                          {ratingLoading === booking._id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Review'}
                        </button>
                        <button
                          type="button"
                          disabled={ratingLoading === booking._id}
                          onClick={() => setActiveRatingId(null)}
                          className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Rating Confirmation State */}
                  {booking.isRated && (
                    <div className="p-6 bg-green-50 rounded-2xl flex items-center justify-center gap-3 text-green-700 font-black uppercase tracking-widest text-xs animate-fade-in">
                      <CheckCircle2 className="w-5 h-5" />
                      Experience Rated Successfully
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : hasSearched ? (
          // Search found no results
          <div className="text-center py-24 bg-white rounded-[3rem] border-4 border-dashed border-gray-100 animate-fade-in">
            <History className="w-20 h-20 text-gray-200 mx-auto mb-6" />
            <p className="text-gray-400 text-2xl font-black tracking-tight">No session history found.</p>
            <p className="text-gray-300 font-bold mt-2 uppercase tracking-widest text-xs">Verify your email and search again</p>
          </div>
        ) : (
          // Initial state before search
          <div className="text-center py-24 animate-fade-in">
             <div className="w-32 h-32 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-8 border border-blue-100 shadow-inner">
               <History className="w-16 h-16 text-blue-300" />
             </div>
             <p className="text-gray-300 font-black uppercase tracking-[0.3em]">Access Your Secure Portal Above</p>
          </div>
        )}
      </div>

      {/* Themed Confirmation Modal Overlay */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-[2rem] shadow-2xl border border-gray-100 p-8 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 mb-2">Cancel Session?</h3>
            <p className="text-gray-500 mb-8 text-sm leading-relaxed">
              {confirmModal.isLate 
                ? "Warning: This session starts in less than 2 hours. Cancelling now will count as a 'Late Cancellation' and register a strike to your account."
                : "Are you sure you want to cancel this session? This slot will be immediately released back to the general pool."}
            </p>
            <div className="flex gap-4">
              <button
                onClick={async () => {
                  const status = confirmModal.isLate ? 'Late Cancellation' : 'Cancelled';
                  setConfirmModal(prev => ({ ...prev, isOpen: false }));
                  await handleStatusUpdate(confirmModal.bookingId, status);
                }}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl text-xs uppercase tracking-widest transition-all cursor-pointer"
              >
                Yes, Cancel
              </button>
              <button
                onClick={() => setConfirmModal({ isOpen: false, bookingId: null, isLate: false })}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-black rounded-xl text-xs uppercase tracking-widest transition-all cursor-pointer"
              >
                No, Keep it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyBookings;
