/**
 * @file ExpertDashboard.jsx
 * @description Administrative dashboard for experts to manage appointments and calendar availability.
 * 
 * Purpose: Dedicated portal for Experts.
 * Inputs: None.
 * Outputs: Renders booking lists, availability calendar grids, and bio forms.
 * Side Effects: Connects Socket.io listeners, performs expert dashboard API actions.
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  fetchExpertDashboardBookings, 
  fetchExpertDashboardProfile, 
  updateExpertDashboardProfile, 
  expertBlockSlot, 
  expertUnblockSlot,
  fetchBookedSlots,
  updateBookingStatus,
  uploadGalleryImage,
  deleteGalleryImage,
  rateClient
} from '../services/api';
import socket from '../services/socket';
import { 
  Calendar, 
  Clock, 
  User, 
  Phone, 
  BookOpen, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Edit3, 
  Briefcase, 
  IndianRupee, 
  FileText,
  AlertCircle,
  Image,
  Trash2,
  Star,
  X
} from 'lucide-react';

// Helper: Convert 24-hour time (e.g. "14:00") to 12-hour format with AM/PM (e.g. "02:00 PM")
const formatTime12H = (time24) => {
  if (!time24) return '';
  const parts = time24.split(':');
  if (parts.length < 2) return time24;
  const hour24 = parseInt(parts[0], 10);
  const minute = parts[1];
  const ampm = hour24 >= 12 ? 'PM' : 'AM';
  let hour12 = hour24 % 12;
  if (hour12 === 0) hour12 = 12;
  const hourStr = hour12.toString().padStart(2, '0');
  return `${hourStr}:${minute} ${ampm}`;
};

// Helper: check if booking date/time has passed in IST timezone (UTC+5:30)
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

const ExpertDashboard = () => {
  // Navigation tabs: 'sessions', 'availability', 'profile', 'gallery'
  const [activeTab, setActiveTab] = useState('sessions');

  // Expert profile & bookings states
  const [expertId, setExpertId] = useState(null);
  const [expertProfile, setExpertProfile] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [bookedSlotsList, setBookedSlotsList] = useState([]);

  // Availability calendar date selector
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    const istNow = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    return istNow.toISOString().split('T')[0];
  });

  // Edit profile states
  const [experience, setExperience] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [description, setDescription] = useState('');
  const [gallery, setGallery] = useState([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null); // id of current session action row
  const [profileSaving, setProfileSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Rating Client modal states
  const [rateModalBooking, setRateModalBooking] = useState(null);
  const [clientRating, setClientRating] = useState(5);
  const [clientComment, setClientComment] = useState('');
  const [isRatingSubmit, setIsRatingSubmit] = useState(false);

  // Predefined hourly slots (09:00 - 22:00, lunch at 13:00)
  const timeSlots = [
    '09:00', '10:00', '11:00', '12:00',
    '14:00', '15:00', '16:00', '17:00',
    '18:00', '19:00', '20:00', '21:00', '22:00'
  ];

  // Helper: check if slot is in the past
  const isSlotInPast = useCallback((slotTime) => {
    if (!selectedDate) return false;
    const slotDateTime = new Date(`${selectedDate}T${slotTime}:00+05:30`);
    const slotMs = slotDateTime.getTime();
    if (Number.isNaN(slotMs)) return false;
    return slotMs <= new Date().getTime();
  }, [selectedDate]);

  // Fetch expert profile info
  const loadProfile = useCallback(async () => {
    try {
      const { data } = await fetchExpertDashboardProfile();
      if (data && data.data) {
        setExpertProfile(data.data);
        setExpertId(data.data._id);
        setExperience(data.data.experience || '');
        setHourlyRate(data.data.hourlyRate || '');
        setDescription(data.data.description || '');
        setGallery(data.data.gallery || []);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to load expert profile details.');
    }
  }, []);

  // Fetch bookings (client appointments)
  const loadBookings = useCallback(async () => {
    try {
      const { data } = await fetchExpertDashboardBookings();
      if (data && data.data) {
        setBookings(data.data);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to retrieve client sessions.');
    }
  }, []);

  // Load initial data
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setErrorMsg('');
      await loadProfile();
      await loadBookings();
      setLoading(false);
    };
    init();
  }, [loadProfile, loadBookings]);

  // Fetch booked slots for the calendar availability grid
  const loadBookedSlots = useCallback(async () => {
    if (!expertId || !selectedDate) return;
    try {
      setSlotsLoading(true);
      const { data } = await fetchBookedSlots(expertId, selectedDate);
      setBookedSlotsList(data.data || data);
    } catch (err) {
      console.error(err);
    } finally {
      setSlotsLoading(false);
    }
  }, [expertId, selectedDate]);

  // Load booked slots when date selection changes
  useEffect(() => {
    if (expertId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadBookedSlots();
    }
  }, [expertId, selectedDate, loadBookedSlots]);

  // Set up Socket.io connection for real-time availability updates
  useEffect(() => {
    if (!expertId) return;

    // Join room
    socket.emit('join_expert_room', expertId);
    console.log(`Joined Socket.io room: ${expertId}`);

    // Listeners to trigger refresh
    const handleSlotUpdate = () => {
      loadBookedSlots();
      loadBookings();
    };

    socket.on('slot_booked', handleSlotUpdate);
    socket.on('slot_released', handleSlotUpdate);

    return () => {
      socket.off('slot_booked', handleSlotUpdate);
      socket.off('slot_released', handleSlotUpdate);
    };
  }, [expertId, loadBookedSlots, loadBookings]);

  // Handle Client Booking Status changes (e.g. mark Completed or Cancelled)
  const handleStatusChange = async (bookingId, newStatus) => {
    try {
      setActionLoading(bookingId);
      setErrorMsg('');
      setSuccessMsg('');
      const { data } = await updateBookingStatus(bookingId, newStatus);
      if (data.success) {
        setSuccessMsg(`Session status updated to '${newStatus}' successfully.`);
        // Reload bookings list
        await loadBookings();
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.error || 'Failed to update booking status.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelClick = async (booking) => {
    const isWithinTwo = isWithinTwoHours(booking.bookingDate, booking.slotTime);
    if (isWithinTwo) {
      const confirmLate = window.confirm(
        "Warning: This session starts in less than 2 hours. Cancelling now will be marked as a 'Late Cancellation'. Do you wish to proceed?"
      );
      if (confirmLate) {
        await handleStatusChange(booking._id, 'Late Cancellation');
      }
    } else {
      const confirmNormal = window.confirm(
        "Are you sure you want to cancel this session?"
      );
      if (confirmNormal) {
        await handleStatusChange(booking._id, 'Cancelled');
      }
    }
  };

  const openRateClientModal = (booking) => {
    setRateModalBooking(booking);
    setClientRating(5);
    setClientComment('');
    setErrorMsg('');
  };

  const closeRateClientModal = () => {
    setRateModalBooking(null);
  };

  const handleRateClientSubmit = async (e) => {
    e.preventDefault();
    if (!rateModalBooking) return;
    try {
      setIsRatingSubmit(true);
      setErrorMsg('');
      
      await rateClient(rateModalBooking._id, clientRating, clientComment);
      
      setSuccessMsg(`Successfully submitted rating for client ${rateModalBooking.userName}!`);
      
      // Reload bookings to update isClientRated and user ratings status
      await loadBookings();
      
      closeRateClientModal();
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.error || 'Failed to submit client rating');
    } finally {
      setIsRatingSubmit(false);
    }
  };

  // Handle blocking/unblocking slots
  const handleSlotToggle = async (slotTime) => {
    if (!expertId) return;
    setErrorMsg('');
    setSuccessMsg('');

    if (isSlotInPast(slotTime)) {
      setErrorMsg('Cannot toggle slots in the past.');
      return;
    }

    // Check if slot is already occupied
    const matchedSlot = bookedSlotsList.find(s => s.slotTime === slotTime);

    try {
      setSlotsLoading(true);
      if (matchedSlot) {
        if (matchedSlot.notes === 'Blocked by Expert') {
          // It is currently blocked, click to unblock it
          await expertUnblockSlot(selectedDate, slotTime);
          setSuccessMsg(`Slot ${formatTime12H(slotTime)} is now open for bookings.`);
        } else {
          // Already booked by a client, cannot toggle
          setErrorMsg('Cannot toggle slot booked by a client.');
        }
      } else {
        // Slot is open, click to block it
        await expertBlockSlot(selectedDate, slotTime);
        setSuccessMsg(`Slot ${formatTime12H(slotTime)} is now blocked.`);
      }
      // Reload slots list
      await loadBookedSlots();
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.error || 'Failed to change slot status.');
    } finally {
      setSlotsLoading(false);
    }
  };

  const handleGalleryUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setErrorMsg('');
      setSuccessMsg('');
      const formData = new FormData();
      formData.append('galleryImage', file);

      const { data } = await uploadGalleryImage(formData);
      setGallery(data.gallery);
      setSuccessMsg('Image uploaded to gallery successfully!');
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.error || 'Failed to upload gallery image.');
    }
  };

  const handleGalleryDelete = async (filename) => {
    // filename might be '/uploads/filename.jpg', so we extract just the name
    const name = filename.split('/').pop();
    try {
      setErrorMsg('');
      setSuccessMsg('');
      const { data } = await deleteGalleryImage(name);
      setGallery(data.gallery);
      setSuccessMsg('Image removed from gallery.');
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.error || 'Failed to delete gallery image.');
    }
  };

  // Handle Profile Biography updates
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setProfileSaving(true);

    if (!experience || !hourlyRate || !description) {
      setErrorMsg('Please fill in all fields.');
      setProfileSaving(false);
      return;
    }

    if (isNaN(hourlyRate) || Number(hourlyRate) < 100) {
      setErrorMsg('Hourly rate must be at least 100 rupees.');
      setProfileSaving(false);
      return;
    }

    try {
      const { data } = await updateExpertDashboardProfile({
        experience: Number(experience),
        hourlyRate: Number(hourlyRate),
        description
      });
      if (data && data.success) {
        setSuccessMsg('Professional bio updated successfully!');
        await loadProfile();
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to update professional biography settings.');
    } finally {
      setProfileSaving(false);
    }
  };

  // Helper status badges styling
  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'Confirmed': return 'bg-green-50 text-green-700 border-green-100';
      case 'Pending': return 'bg-yellow-50 text-yellow-700 border-yellow-100';
      case 'Completed': return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'Cancelled': return 'bg-red-50 text-red-700 border-red-100';
      case 'Late Cancellation': return 'bg-orange-50 text-orange-700 border-orange-100';
      default: return 'bg-gray-50 text-gray-700 border-gray-100';
    }
  };

  // Filter client bookings (exclude expert's own blocked slots)
  const clientBookings = bookings.filter(b => b.notes !== 'Blocked by Expert');

  // Format date helper for IST display
  const getISTFormattedDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-purple-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Opening Expert Portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto animate-fade-in">
        
        {/* Banner Section */}
        <div className="bg-gradient-to-r from-purple-900 to-indigo-900 rounded-[2rem] p-8 text-white shadow-xl mb-8 relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-1/4 -translate-y-1/4 w-80 h-80 rounded-full bg-purple-600/10 pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <span className="text-purple-300 text-xs font-black uppercase tracking-widest bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20">
                Expert Portal
              </span>
              <h1 className="text-3xl font-extrabold mt-4">Welcome back, {expertProfile?.name}</h1>
              <p className="text-purple-200 mt-2 font-semibold text-sm">
                Category: <span className="font-black text-white">{expertProfile?.category}</span> | Experience: <span className="font-black text-white">{expertProfile?.experience} Years</span>
              </p>
            </div>
            
            <div className="flex flex-col items-start md:items-end gap-2">
              <span className="text-[10px] font-black text-purple-300 uppercase tracking-widest">Aggregate Reviews</span>
              <span className="text-2xl font-black text-amber-400 flex items-center gap-1">
                ★ {expertProfile?.rating ? expertProfile.rating.toFixed(1) : '4.5'}
                <span className="text-xs text-purple-300 font-bold">({expertProfile?.numReviews || 0} reviews)</span>
              </span>
            </div>
          </div>
        </div>

        {/* Global Notifications */}
        {errorMsg && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-2xl flex items-start gap-3 animate-fade-in">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-800">Action Error</p>
              <p className="text-xs text-red-700 mt-1 font-medium">{errorMsg}</p>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 rounded-r-2xl flex items-start gap-3 animate-fade-in">
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-green-800">Success</p>
              <p className="text-xs text-green-700 mt-1 font-medium">{successMsg}</p>
            </div>
          </div>
        )}

        {/* Tab Headers */}
        <div className="flex border-b border-gray-200 mb-8 overflow-x-auto gap-4">
          <button
            onClick={() => setActiveTab('sessions')}
            className={`flex items-center gap-2 pb-4 px-2 text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'sessions' 
                ? 'border-purple-600 text-purple-600 font-extrabold' 
                : 'border-transparent text-gray-500 hover:text-purple-600'
            }`}
          >
            <Clock className="w-4 h-4" />
            Sessions Directory
          </button>
          
          <button
            onClick={() => setActiveTab('availability')}
            className={`flex items-center gap-2 pb-4 px-2 text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'availability' 
                ? 'border-purple-600 text-purple-600 font-extrabold' 
                : 'border-transparent text-gray-500 hover:text-purple-600'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Availability Blocks
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 pb-4 px-2 text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'profile' 
                ? 'border-purple-600 text-purple-600 font-extrabold' 
                : 'border-transparent text-gray-500 hover:text-purple-600'
            }`}
          >
            <Edit3 className="w-4 h-4" />
            Edit Profile Bio
          </button>

          <button
            onClick={() => setActiveTab('gallery')}
            className={`flex items-center gap-2 pb-4 px-2 text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'gallery' 
                ? 'border-purple-600 text-purple-600 font-extrabold' 
                : 'border-transparent text-gray-500 hover:text-purple-600'
            }`}
          >
            <Image className="w-4 h-4" />
            Media Gallery
          </button>
        </div>

        {/* Tab Content Panel */}
        <div className="bg-white shadow-md rounded-[2rem] border border-gray-100 p-6 md:p-8">
          
          {/* TAB 1: SESSIONS LIST */}
          {activeTab === 'sessions' && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-black uppercase tracking-wider text-gray-400">Client Details</th>
                    <th className="px-6 py-3 text-left text-xs font-black uppercase tracking-wider text-gray-400">Date & Slot</th>
                    <th className="px-6 py-3 text-left text-xs font-black uppercase tracking-wider text-gray-400">Client Notes</th>
                    <th className="px-6 py-3 text-left text-xs font-black uppercase tracking-wider text-gray-400">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-black uppercase tracking-wider text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100 font-medium text-sm">
                  {clientBookings.map(b => (
                    <tr key={b._id} className="hover:bg-gray-50/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-bold text-gray-900 flex items-center gap-1.5">
                          <User className="w-4 h-4 text-gray-400" />
                          <span>{b.userName}</span>
                          {b.user && typeof b.user === 'object' && (
                            b.user.numReviews > 0 ? (
                              <span className="ml-2 inline-flex items-center gap-0.5 text-xs font-black text-amber-500 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full" title={`Client Reputation: ${b.user.rating.toFixed(1)} stars based on ${b.user.numReviews} reviews`}>
                                ★ {b.user.rating.toFixed(1)} <span className="text-[10px] text-amber-400">({b.user.numReviews})</span>
                              </span>
                            ) : (
                              <span className="ml-2 inline-flex items-center gap-0.5 text-xs font-black text-gray-500 bg-gray-50 border border-gray-200 px-2.5 py-0.5 rounded-full" title="New Client: No reviews yet">
                                New Client
                              </span>
                            )
                          )}
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-1.5 mt-1">
                          <Phone className="w-3.5 h-3.5 text-gray-400" />
                          {b.userPhone}
                        </div>
                        <div className="text-[11px] text-gray-400 mt-0.5">{b.userEmail}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-gray-600 font-bold">{getISTFormattedDate(b.bookingDate)}</div>
                        <div className="text-xs text-gray-500 font-black flex items-center gap-1 mt-1">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          {formatTime12H(b.slotTime)}
                        </div>
                      </td>
                      <td className="px-6 py-4 max-w-xs truncate text-gray-500 text-xs">
                        {b.notes || <span className="text-gray-300 italic">No notes left</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${getStatusBadgeStyle(b.status)}`}>
                          {b.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        {b.status === 'Confirmed' && (
                          <div className="flex justify-end gap-2">
                            {isSessionPast(b.bookingDate, b.slotTime) ? (
                              <button
                                disabled={actionLoading === b._id}
                                onClick={() => handleStatusChange(b._id, 'Completed')}
                                className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                title="Mark Completed"
                              >
                                {actionLoading === b._id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle className="w-3.5 h-3.5" />
                                )}
                                Complete
                              </button>
                            ) : (
                              <button
                                disabled
                                className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-400 text-xs font-bold rounded-lg cursor-not-allowed opacity-50"
                                title="Locked until session start time"
                              >
                                <Clock className="w-3.5 h-3.5 text-gray-400" />
                                Locked
                              </button>
                            )}
                            {!isSessionPast(b.bookingDate, b.slotTime) && (
                              <button
                                disabled={actionLoading === b._id}
                                onClick={() => handleCancelClick(b)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                title="Cancel Session"
                              >
                                {actionLoading === b._id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <XCircle className="w-3.5 h-3.5" />
                                )}
                                Cancel
                              </button>
                            )}
                          </div>
                        )}
                        {b.status === 'Completed' && (
                          <div className="flex justify-end gap-2 items-center">
                            {b.isClientRated ? (
                              <span className="text-xs text-green-600 font-bold bg-green-50 border border-green-200 px-2.5 py-1 rounded-lg">Rated</span>
                            ) : (
                              <button
                                onClick={() => openRateClientModal(b)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-black border border-amber-200 rounded-lg transition-colors cursor-pointer"
                              >
                                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                                Rate Client
                              </button>
                            )}
                          </div>
                        )}
                        {['Cancelled', 'Late Cancellation'].includes(b.status) && (
                          <span className="text-xs text-gray-400 italic">Cancelled</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {clientBookings.length === 0 && (
                <div className="text-center py-16">
                  <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-400 font-bold">No client sessions registered yet.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SLOT AVAILABILITY BLOCKS */}
          {activeTab === 'availability' && (
            <div className="space-y-8">
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-gray-100">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-purple-600 rounded-full" />
                    Block/Unblock Slots
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Select a date and click time slots to toggle your availability. Blocked slots will prevent clients from booking.
                  </p>
                </div>
                
                {/* Date Input */}
                <div className="flex items-center gap-3">
                  <label htmlFor="datePicker" className="text-sm font-bold text-gray-700">Selected Date:</label>
                  <input
                    id="datePicker"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-xl text-gray-900 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500 text-xs font-semibold"
                  />
                </div>
              </div>

              {/* Slot Grid */}
              {slotsLoading ? (
                <div className="py-20 flex flex-col items-center justify-center">
                  <Loader2 className="w-10 h-10 text-purple-600 animate-spin mb-4" />
                  <p className="text-gray-400 font-medium text-xs">Syncing availability status...</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {timeSlots.map(slot => {
                    // Check if slot has a record in booked slots
                    const match = bookedSlotsList.find(s => s.slotTime === slot);
                    const isBookedByClient = match && match.notes !== 'Blocked by Expert';
                    const isBlockedByExpert = match && match.notes === 'Blocked by Expert';
                    const isPassed = isSlotInPast(slot);

                    let btnStyle = 'bg-emerald-50 text-emerald-700 hover:bg-red-50 hover:text-red-700 hover:border-red-200 border-emerald-200';
                    let label = 'Open (Click to Block)';
                    
                    if (isBookedByClient) {
                      btnStyle = 'bg-indigo-50 text-indigo-700 border-indigo-100 opacity-60 cursor-not-allowed';
                      label = `Booked (${match.userName || 'Client'})`;
                    } else if (isBlockedByExpert) {
                      if (isPassed) {
                        btnStyle = 'bg-red-50 text-red-700/60 border-red-100 opacity-60 cursor-not-allowed';
                        label = 'Blocked (Passed)';
                      } else {
                        btnStyle = 'bg-red-50 text-red-700 border-red-200 hover:bg-green-50 hover:text-green-700 hover:border-green-200';
                        label = 'Blocked (Click to Unblock)';
                      }
                    } else if (isPassed) {
                      btnStyle = 'bg-gray-100 text-gray-300 border-gray-200 opacity-60 cursor-not-allowed';
                      label = 'Passed';
                    }

                    const isDisabled = isBookedByClient || slotsLoading || isPassed;

                    return (
                      <button
                        key={slot}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => handleSlotToggle(slot)}
                        className={`flex flex-col items-center justify-center p-4 rounded-2xl border text-center transition-all duration-200 ${
                          !isDisabled ? 'cursor-pointer active:scale-95' : ''
                        } ${btnStyle}`}
                      >
                        <span className="text-base font-black tracking-tight mb-1">{formatTime12H(slot)}</span>
                        <span className="text-[10px] font-bold tracking-tight uppercase">{label}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Legend Indicator */}
              <div className="flex gap-4 pt-4 border-t border-gray-100 text-xs font-bold text-gray-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-emerald-50 rounded-full border border-emerald-200" />
                  Open / Available
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-indigo-50 rounded-full border border-indigo-100" />
                  Booked by Clients
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-red-50 rounded-full border border-red-200" />
                  Blocked by You
                </span>
              </div>

            </div>
          )}

          {/* TAB 3: EDIT BIO / PROFILE */}
          {activeTab === 'profile' && (
            <form onSubmit={handleProfileSubmit} className="space-y-8 max-w-2xl">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Experience */}
                <div>
                  <label htmlFor="exp" className="block text-sm font-bold text-gray-700 mb-2">
                    Years of Experience
                  </label>
                  <div className="relative rounded-xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Briefcase className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="exp"
                      type="number"
                      min="1"
                      required
                      placeholder="e.g. 8"
                      value={experience}
                      onChange={(e) => setExperience(e.target.value)}
                      className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl text-gray-900 font-semibold bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all text-sm"
                    />
                  </div>
                </div>

                {/* Hourly Rate */}
                <div>
                  <label htmlFor="rate" className="block text-sm font-bold text-gray-700 mb-2">
                    Hourly Rate (₹ INR)
                  </label>
                  <div className="relative rounded-xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <IndianRupee className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="rate"
                      type="number"
                      min="100"
                      required
                      placeholder="e.g. 1500 (Min ₹100)"
                      value={hourlyRate}
                      onChange={(e) => setHourlyRate(e.target.value)}
                      className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl text-gray-900 font-semibold bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Biography Description */}
              <div>
                <label htmlFor="desc" className="block text-sm font-bold text-gray-700 mb-2">
                  Biography & Qualifications
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 pt-3 pointer-events-none">
                    <FileText className="h-5 w-5 text-gray-400" />
                  </div>
                  <textarea
                    id="desc"
                    rows="6"
                    required
                    placeholder="Describe your consulting background..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl text-gray-900 font-semibold bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all text-sm resize-none"
                  />
                </div>
              </div>

              {/* Submit Control */}
              <div className="flex justify-end pt-4 border-t border-gray-100">
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="flex items-center justify-center px-8 py-3 border border-transparent rounded-2xl shadow-md text-sm font-black text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {profileSaving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Saving changes...
                    </>
                  ) : (
                    'Save Professional Bio'
                  )}
                </button>
              </div>

            </form>
          )}

          {/* TAB 4: MEDIA GALLERY */}
          {activeTab === 'gallery' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Professional Gallery</h2>
                  <p className="text-sm text-gray-500">Showcase your portfolio. Upload up to 5 images.</p>
                </div>
                <div>
                  <label className="relative flex items-center justify-center px-4 py-2 border border-transparent rounded-xl shadow-sm text-sm font-black text-white bg-purple-600 hover:bg-purple-700 cursor-pointer transition-colors">
                    <Image className="w-4 h-4 mr-2" />
                    Upload Photo
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/png, image/jpeg, image/webp" 
                      onChange={handleGalleryUpload} 
                      disabled={gallery.length >= 5} 
                    />
                  </label>
                  {gallery.length >= 5 && (
                    <p className="text-xs text-red-500 mt-2 font-bold">Gallery limit reached (5/5)</p>
                  )}
                </div>
              </div>

              {gallery.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl">
                  <Image className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">Your gallery is empty.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  {gallery.map((imgSrc, idx) => (
                    <div key={idx} className="relative group rounded-xl overflow-hidden shadow-sm border border-gray-200 bg-white aspect-square">
                      <img src={imgSrc} alt={`Gallery ${idx + 1}`} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button 
                          onClick={() => handleGalleryDelete(imgSrc)}
                          className="p-3 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors shadow-lg"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

      </div>

      {/* Rate Client Modal */}
      {rateModalBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={closeRateClientModal}>
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full border border-gray-100 m-4 animate-scale-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
              <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
                <Star className="w-6 h-6 text-amber-500 fill-amber-500" />
                Rate Client: {rateModalBooking.userName}
              </h3>
              <button 
                onClick={closeRateClientModal} 
                className="text-gray-400 hover:text-gray-600 p-1.5 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRateClientSubmit} className="space-y-6">
              {/* Stars selector */}
              <div className="space-y-2 text-center">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-1">Session Experience</label>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setClientRating(star)}
                      className="p-1 hover:scale-110 transition-transform cursor-pointer"
                    >
                      <Star 
                        className={`w-10 h-10 ${
                          star <= clientRating 
                            ? 'text-amber-500 fill-amber-500' 
                            : 'text-gray-200'
                        }`} 
                      />
                    </button>
                  ))}
                </div>
                <p className="text-xs font-bold text-gray-400 italic">
                  {clientRating === 5 && 'Excellent client (5/5)'}
                  {clientRating === 4 && 'Good client (4/5)'}
                  {clientRating === 3 && 'Average client (3/5)'}
                  {clientRating === 2 && 'Poor client (2/5)'}
                  {clientRating === 1 && 'Abusive / No Show client (1/5)'}
                </p>
              </div>

              {/* Comment text area */}
              <div className="space-y-2">
                <label htmlFor="clientComment" className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Written Feedback (Optional)</label>
                <textarea
                  id="clientComment"
                  rows="4"
                  placeholder="Share details of the client's behavior, punctuality, or goals..."
                  value={clientComment}
                  onChange={(e) => setClientComment(e.target.value)}
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 font-semibold transition-all text-sm resize-none"
                />
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="flex gap-4 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={closeRateClientModal}
                  className="flex-1 py-3 border border-gray-200 hover:bg-gray-50 text-gray-500 font-bold rounded-2xl transition-all cursor-pointer text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRatingSubmit}
                  className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-purple-500/10 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer text-sm"
                >
                  {isRatingSubmit ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Submitting...
                    </>
                  ) : (
                    'Submit Feedback'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default ExpertDashboard;
