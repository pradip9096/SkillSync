/**
 * @file ExpertDetail.jsx
 * @description Detailed profile page for an expert.
 * 
 * Purpose: Displays expert details and allows users to book available time slots.
 * Inputs: Expert ID from the URL parameters.
 * Outputs: JSX element for the expert profile and booking page.
 * Side Effects: 
 * - Fetches expert details and booked slots on mount.
 * - Establishes a Socket.io connection for real-time slot updates.
 * - Creates a booking record on the server via POST request.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchExpertById, fetchBookedSlots, createBooking } from '../services/api';
import socket from '../services/socket';
import { useAuth } from '../context/AuthContext';
import { Calendar as CalendarIcon, Clock, User, Mail, Phone, MessageSquare, Loader2, ChevronLeft, CheckCircle, ShieldCheck, Star, AlertCircle, X, ChevronRight } from 'lucide-react';

/**
 * ExpertDetail Page Component.
 * 
 * Purpose: Manages expert data fetching, slot availability, and booking form submission.
 * Parameters: None.
 * Return value: {JSX.Element} The rendered expert detail page.
 * Side effects: Socket connection, data fetching, and booking submission.
 */
const ExpertDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { user, updateUserProfile } = useAuth();

  // State Management
  const [expert, setExpert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bookedSlots, setBookedSlots] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [selectedDate, setSelectedDate] = useState(() => {
    // Initialize with current date in IST format
    const now = new Date();
    const istNow = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    //  The toISOString() method converts a Date object into a standardized string format (ISO 8601).
    return istNow.toISOString().split('T')[0]; 
  });
  const [selectedSlot, setSelectedSlot] = useState('');
  const [formData, setFormData] = useState({
    userName: '',
    userEmail: '',
    userPhone: '',
    notes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Lightbox state
  const [lightboxIdx, setLightboxIdx] = useState(null); // null = closed, number = open at that index

  const openLightbox = (idx) => setLightboxIdx(idx);
  const closeLightbox = useCallback(() => setLightboxIdx(null), []);
  const lightboxPrev = useCallback(() => {
    if (!expert?.gallery) return;
    setLightboxIdx(i => (i - 1 + expert.gallery.length) % expert.gallery.length);
  }, [expert]);
  const lightboxNext = useCallback(() => {
    if (!expert?.gallery) return;
    setLightboxIdx(i => (i + 1) % expert.gallery.length);
  }, [expert]);

  const isOwnProfile = !!(user && expert && (expert.user === user._id || expert.user?._id === user._id));

  // Keyboard handler: Escape closes lightbox, arrows navigate
  useEffect(() => {
    if (lightboxIdx === null) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') lightboxPrev();
      if (e.key === 'ArrowRight') lightboxNext();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxIdx, closeLightbox, lightboxPrev, lightboxNext]);

  // Pre-fill form from user details
  useEffect(() => {
    if (user) {
      const formatPhoneForInput = (phone) => {
        if (!phone) return '';
        let val = phone.replace(/\s|-/g, '');
        if (val.startsWith('+91')) {
          val = val.slice(3);
        }
        return val.slice(0, 10);
      };

      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData(prev => ({
        ...prev,
        userName: prev.userName || user.name || '',
        userEmail: prev.userEmail || user.email || '',
        userPhone: prev.userPhone || formatPhoneForInput(user.phone)
      }));
    }
  }, [user]);

  /**
   * Helper: Check if a time slot has already passed for the current day.
   * 
   * Purpose: Prevents users from booking slots in the past.
   * @param {string} slotTime - The time slot (e.g., "14:00").
   * @returns {boolean} True if the slot is in the past, false otherwise.
   */
  const isSlotInPast = (slotTime) => {
    if (!selectedDate) return false;
    const slotDateTime = new Date(`${selectedDate}T${slotTime}:00+05:30`);
    const slotMs = slotDateTime.getTime();
    if (Number.isNaN(slotMs)) return false;
    return slotMs <= new Date().getTime();
  };

  // Predefined time slots available for booking
  const timeSlots = [
    { value: '09:00', label: '09:00 AM' },
    { value: '10:00', label: '10:00 AM' },
    { value: '11:00', label: '11:00 AM' },
    { value: '12:00', label: '12:00 PM' },
    { value: '14:00', label: '02:00 PM' },
    { value: '15:00', label: '03:00 PM' },
    { value: '16:00', label: '04:00 PM' },
    { value: '17:00', label: '05:00 PM' },
    { value: '18:00', label: '06:00 PM' },
    { value: '19:00', label: '07:00 PM' },
    { value: '20:00', label: '08:00 PM' },
    { value: '21:00', label: '09:00 PM' },
    { value: '22:00', label: '10:00 PM' }
  ];

  /**
   * Effect Hook for Expert Data and Socket Listeners.
   * Joins the expert's room and listens for real-time slot updates.
   */
  useEffect(() => {
    /**
     * Fetches expert details from the API.
     */
    const getExpertData = async () => {
      try {
        const { data } = await fetchExpertById(id);
        setExpert(data.data);
        setReviews(data.reviews || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    getExpertData();

    // Socket: Join expert-specific room for real-time updates
    socket.emit('join_expert_room', id);

    // Listener for when a slot is booked by someone else
    socket.on('slot_booked', (data) => {
      if (data.bookingDate === selectedDate) {
        setBookedSlots((prev) => [...prev, { slotTime: data.slotTime }]);
      }
    });

    // Listener for when a booking is cancelled, releasing the slot
    socket.on('slot_released', (data) => {
      if (data.bookingDate === selectedDate) {
        setBookedSlots((prev) => prev.filter(s => (typeof s === 'string' ? s : s.slotTime) !== data.slotTime));
      }
    });

    // Cleanup: remove listeners when component unmounts
    return () => {
      socket.off('slot_booked');
      socket.off('slot_released');
    };
  }, [id, selectedDate]);

  /**
   * Effect Hook to fetch currently booked slots for the selected date.
   */
  useEffect(() => {
    /**
     * Fetches booked slots for the given expert and date.
     */
    const getBooked = async () => {
      try {
        const { data } = await fetchBookedSlots(id, selectedDate);
        setBookedSlots(data.data);
      } catch (err) {
        console.error(err);
      }
    };
    getBooked();
  }, [id, selectedDate]);

  /**
   * Handles the booking form submission.
   * 
   * Purpose: Validates selection, formats data, and sends the booking request to the server.
   * @param {React.FormEvent} e - Form submission event.
   */
  const handleBooking = async (e) => {
    e.preventDefault();
    if (!selectedSlot) return;

    try {
      setIsSubmitting(true);
      // Construct payload, strip any non-digits, and prepend +91 prefix
      let phoneClean = formData.userPhone.replace(/\D/g, '');
      if (phoneClean && !phoneClean.startsWith('+91')) {
        phoneClean = '+91' + phoneClean;
      }
      await createBooking({
        expert: id,
        bookingDate: selectedDate,
        slotTime: selectedSlot,
        ...formData,
        userPhone: phoneClean
      });

      // Update global context user details if they were empty/modified
      if (user) {
        updateUserProfile(formData.userName, phoneClean);
      }

      setSuccess(true);
      // Redirect to history page after a brief delay
      setTimeout(() => navigate('/my-bookings'), 3000);
    } catch (err) {
      alert(err.response?.data?.error || 'Booking failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render: Loading State
  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
    </div>
  );

  // Render: Error State (Expert not found)
  if (!expert) return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <p className="text-xl font-bold text-gray-400">Expert profile not found.</p>
      <button onClick={() => navigate('/')} className="mt-4 text-blue-600 font-bold">Return to Explore</button>
    </div>
  );

  // Render: Success Screen after booking
  if (success) return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 animate-fade-in">
      <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl text-center max-w-md w-full border border-green-50">
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce">
          <CheckCircle className="w-12 h-12 text-green-600" />
        </div>
        <h2 className="text-4xl font-black text-gray-900 mb-4 tracking-tight">Confirmed!</h2>
        <p className="text-lg text-gray-600 mb-8 leading-relaxed">
          Your session with <span className="font-bold text-gray-900">{expert.name}</span> is set for <span className="font-bold text-blue-600">{selectedDate}</span> at <span className="font-bold text-blue-600">{timeSlots.find(s => s.value === selectedSlot)?.label || selectedSlot}</span>.
        </p>
        <div className="flex items-center justify-center gap-2 text-gray-400 text-sm italic">
          <Loader2 className="w-4 h-4 animate-spin" />
          Redirecting to your history...
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      {/* Back Navigation */}
      <button 
        onClick={() => navigate('/')}
        className="group flex items-center gap-2 text-gray-500 hover:text-blue-600 mb-10 transition-all font-bold"
      >
        <ChevronLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform" /> 
        <span>Back to Explore</span>
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        
        {/* Left Column: Expert Sidebar Profile */}
        <div className="lg:col-span-4 sticky top-32">
          <div className="bg-white rounded-[2rem] shadow-xl shadow-blue-900/5 border border-gray-100 overflow-hidden animate-slide-up">
            <div className="relative">
              {(() => {
                const isPlaceholder = !expert.profileImage || 
                  expert.profileImage.includes('placehold.co') || 
                  expert.profileImage.includes('placehold.it') || 
                  expert.profileImage.includes('placeholder');
                const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(expert.name)}&background=e0e7ff&color=4f46e5&size=512`;
                const imageSrc = isPlaceholder ? avatarUrl : expert.profileImage;

                return (
                  <img 
                    src={imageSrc} 
                    alt={expert.name} 
                    className="w-full h-80 object-cover" 
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = avatarUrl;
                    }}
                  />
                );
              })()}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
              <div className="absolute bottom-6 left-6 right-6">
                <span className="inline-block px-3 py-1 text-xs font-black tracking-widest text-white uppercase bg-blue-600 rounded-lg mb-2">
                  {expert.category}
                </span>
                <h1 className="text-3xl font-black text-white leading-tight">{expert.name}</h1>
              </div>
            </div>
            
            <div className="p-8">
              <p className="text-gray-600 leading-relaxed mb-8 font-medium italic">"{expert.description}"</p>
              
              <div className="space-y-4 mb-8">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                  <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">Experience</span>
                  <span className="font-black text-gray-900">{expert.experience} Years</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-2xl">
                  <span className="text-sm font-bold text-blue-400 uppercase tracking-wider">Hourly Rate</span>
                  <span className="font-black text-blue-700">₹{expert.hourlyRate}/hr</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-2xl">
                  <span className="text-sm font-bold text-yellow-600 uppercase tracking-wider">Global Rating</span>
                  <span className="flex items-center gap-1.5 font-black text-yellow-700">
                    <Star className="w-4 h-4 fill-yellow-600" />
                    {expert.rating.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Slot Selection & Booking Form */}
        <div className="lg:col-span-8 space-y-8 animate-slide-up delay-100">
          
          {isOwnProfile && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded-2xl shadow-sm animate-fade-in">
              <div className="flex gap-3">
                <AlertCircle className="w-6 h-6 text-yellow-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-lg font-black text-yellow-800">You are viewing your own expert profile.</h3>
                  <p className="text-yellow-700 font-semibold mt-1">
                    You cannot book sessions with yourself. To manage your availability, please visit your{' '}
                    <button 
                      type="button"
                      onClick={() => navigate('/expert-dashboard')} 
                      className="underline font-black hover:text-yellow-900 transition-colors"
                    >
                      Expert Dashboard
                    </button>
                    .
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Section: Date & Slot Selection */}
          <div className="bg-white rounded-[2rem] shadow-xl shadow-blue-900/5 border border-gray-100 p-10">
            <div className="flex items-center justify-between mb-10 flex-wrap gap-4">
              <h2 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                <CalendarIcon className="w-8 h-8 text-blue-600" /> Choose Your Session
              </h2>
              <div className="px-4 py-2 bg-green-50 text-green-700 rounded-xl text-xs font-black flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" /> REAL-TIME AVAILABILITY
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
              <div className="space-y-2">
                <label htmlFor="bookingDate" className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Select Date</label>
                <div className="relative">
                  <input 
                    id="bookingDate"
                    name="bookingDate"
                    type="date" 
                    min={(() => {
                      const now = new Date();
                      const istNow = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
                      return istNow.toISOString().split('T')[0];
                    })()}
                    value={selectedDate}
                    disabled={isOwnProfile}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Available Slots</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {timeSlots.map((slot) => {
                  const isBooked = bookedSlots.some(s => (typeof s === 'string' ? s : s.slotTime) === slot.value);
                  const isPassed = isSlotInPast(slot.value);
                  const isDisabled = isBooked || isPassed || isOwnProfile;

                  return (
                    <button
                      key={slot.value}
                      disabled={isDisabled}
                      onClick={() => setSelectedSlot(slot.value)}
                      className={`
                        group relative py-5 rounded-2xl font-black transition-all duration-300
                        ${isDisabled 
                          ? 'bg-gray-100 text-gray-300 cursor-not-allowed grayscale' 
                          : selectedSlot === slot.value
                            ? 'bg-blue-600 text-white shadow-2xl shadow-blue-400 scale-105'
                            : 'bg-white border-2 border-gray-100 text-gray-700 hover:border-blue-500 hover:text-blue-600 hover:shadow-lg hover:shadow-blue-900/5'
                        }
                      `}
                    >
                      <span className="flex items-center justify-center gap-2">
                        {!isDisabled && <Clock className="w-4 h-4" />}
                        {slot.label}
                      </span>
                      {isDisabled && (
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] uppercase tracking-tighter text-gray-400/50 -rotate-12">
                          {isBooked ? 'Booked' : 'Passed'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section: Guest Information Form */}
          {!user ? (
            <div className="bg-white rounded-[2.5rem] shadow-xl shadow-blue-900/5 border border-gray-100 p-10 text-center space-y-6 animate-slide-up">
              <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto border border-blue-100 shadow-inner">
                <ShieldCheck className="w-10 h-10 text-blue-600 animate-pulse" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-gray-900">Authentication Required</h3>
                <p className="text-gray-500 font-medium max-w-sm mx-auto">
                  Please log in or sign up for a SkillSync account to reserve this slot and manage your sessions.
                </p>
              </div>
              <div className="pt-4">
                <button
                  type="button"
                  onClick={() => navigate('/login', { state: { from: { pathname: `/expert/${id}` } } })}
                  className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl transition-all shadow-xl shadow-blue-500/20 hover:scale-[1.02] active:scale-95 cursor-pointer"
                >
                  Sign In to Book
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleBooking} className="bg-white rounded-[2.5rem] shadow-xl shadow-blue-900/5 border border-gray-100 p-10 space-y-10">
              <h2 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                <User className="w-8 h-8 text-blue-600" /> Guest Information
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-3">
                  <label htmlFor="userName" className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Full Name</label>
                  <div className="relative group">
                    <User className="absolute left-4 top-4 w-6 h-6 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                    <input 
                      id="userName"
                      name="userName"
                      required
                      type="text" 
                      placeholder="Enter your name"
                      value={formData.userName}
                      disabled={isOwnProfile}
                      onChange={(e) => setFormData({...formData, userName: e.target.value})}
                      className="w-full pl-14 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <label htmlFor="userEmail" className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Email Address</label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-4 w-6 h-6 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                    <input 
                      id="userEmail"
                      name="userEmail"
                      required
                      type="email" 
                      placeholder="name@example.com"
                      value={formData.userEmail}
                      disabled={isOwnProfile}
                      onChange={(e) => setFormData({...formData, userEmail: e.target.value})}
                      className="w-full pl-14 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-3">
                  <label htmlFor="userPhone" className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Phone Number</label>
                  <div className="relative group">
                    <Phone className="absolute left-4 top-4 w-6 h-6 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                    <input 
                      id="userPhone"
                      name="userPhone"
                      required
                      type="tel" 
                      placeholder="9876543210"
                      pattern="[0-9]{10}"
                      title="Please enter a 10-digit mobile number"
                      value={formData.userPhone}
                      disabled={isOwnProfile}
                      onChange={(e) => {
                        let val = e.target.value.replace(/\D/g, ''); 
                        setFormData({...formData, userPhone: val.slice(0, 10)});
                      }}
                      className="w-full pl-14 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <label htmlFor="notes" className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Meeting Notes</label>
                  <div className="relative group">
                    <MessageSquare className="absolute left-4 top-4 w-6 h-6 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                    <input 
                      id="notes"
                      name="notes"
                      type="text" 
                      placeholder="Briefly describe your goals..."
                      value={formData.notes}
                      disabled={isOwnProfile}
                      onChange={(e) => setFormData({...formData, notes: e.target.value})}
                      className="w-full pl-14 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-6">
                {/* Submission Button */}
                <button 
                  disabled={isSubmitting || !selectedSlot || isOwnProfile}
                  type="submit"
                  className={`
                    w-full py-6 rounded-[2rem] font-black text-xl tracking-tight transition-all duration-500
                    ${isSubmitting || !selectedSlot || isOwnProfile
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700 shadow-2xl shadow-blue-500/30 hover:scale-[1.02] active:scale-95'
                    }
                  `}
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-3">
                      <Loader2 className="w-6 h-6 animate-spin" /> Finalizing Booking...
                    </span>
                  ) : isOwnProfile ? (
                    'Self-Booking Disabled'
                  ) : !selectedSlot ? (
                    'Select a Slot Above'
                  ) : (
                    'Secure My Appointment'
                  )}
                </button>
                <p className="text-center text-gray-400 text-xs mt-6 font-bold tracking-widest uppercase">
                  Encrypted & Secure Booking Environment
                </p>
              </div>
            </form>
          )}
        </div>

        {/* Full-Width: Professional Gallery */}
        {expert.gallery && expert.gallery.length > 0 && (
          <div className="mt-12 bg-white rounded-3xl border border-gray-100 p-8 shadow-xl animate-slide-up">
            <h2 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-3">
              <span className="text-2xl">🖼️</span> Professional Gallery
              <span className="text-sm font-bold text-gray-400 bg-gray-50 px-3 py-1 rounded-full border">
                {expert.gallery.length} {expert.gallery.length === 1 ? 'Photo' : 'Photos'}
              </span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {expert.gallery.map((imgSrc, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl overflow-hidden shadow-sm border border-gray-100 aspect-square cursor-zoom-in group relative"
                  onDoubleClick={() => openLightbox(idx)}
                  title="Double-click to view full size"
                >
                  <img
                    src={imgSrc}
                    alt={`Gallery ${idx + 1}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => { e.target.onerror = null; e.target.src = `https://ui-avatars.com/api/?name=G${idx+1}&background=e0e7ff&color=4f46e5&size=300`; }}
                  />
                  {/* Hover hint overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-[10px] font-black uppercase tracking-widest bg-black/50 px-2 py-1 rounded-full">
                      Double-click
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Lightbox Modal */}
            {lightboxIdx !== null && expert.gallery[lightboxIdx] && (
              <div
                className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm"
                onClick={closeLightbox}
              >
                {/* Close button */}
                <button
                  onClick={closeLightbox}
                  className="absolute top-5 right-5 z-10 p-2 rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors"
                  title="Close (Esc)"
                >
                  <X className="w-6 h-6" />
                </button>

                {/* Image counter */}
                <div className="absolute top-5 left-1/2 -translate-x-1/2 text-white/60 text-sm font-bold tracking-widest">
                  {lightboxIdx + 1} / {expert.gallery.length}
                </div>

                {/* Prev arrow */}
                {expert.gallery.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); lightboxPrev(); }}
                    className="absolute left-4 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors"
                    title="Previous (←)"
                  >
                    <ChevronLeft className="w-7 h-7" />
                  </button>
                )}

                {/* Full-size image */}
                <img
                  src={expert.gallery[lightboxIdx]}
                  alt={`Gallery ${lightboxIdx + 1}`}
                  className="max-w-[90vw] max-h-[85vh] object-contain rounded-2xl shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                  onError={(e) => { e.target.onerror = null; e.target.src = `https://ui-avatars.com/api/?name=G${lightboxIdx+1}&background=e0e7ff&color=4f46e5&size=512`; }}
                />

                {/* Next arrow */}
                {expert.gallery.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); lightboxNext(); }}
                    className="absolute right-4 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors"
                    title="Next (→)"
                  >
                    <ChevronRight className="w-7 h-7" />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Client Reviews Section */}
        <div className="mt-12 bg-white rounded-3xl border border-gray-100 p-8 shadow-xl animate-slide-up delay-200">
          <h2 className="text-2xl font-black text-gray-900 mb-8 flex items-center gap-3">
            <Star className="w-7 h-7 text-yellow-500 fill-yellow-500" />
            Client Reviews & Testimonials
            <span className="text-sm font-bold text-gray-400 bg-gray-50 px-3 py-1 rounded-full border">
              {reviews.length} {reviews.length === 1 ? 'Review' : 'Reviews'}
            </span>
          </h2>

          {reviews.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-gray-100 rounded-3xl">
              <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-400 font-bold text-sm uppercase tracking-widest">No reviews yet</p>
              <p className="text-xs text-gray-400 mt-2 font-medium">Be the first to share your experience after a completed session!</p>
            </div>
          ) : (
            <div className="space-y-6 divide-y divide-gray-100">
              {reviews.map((r, index) => (
                <div key={r._id} className={`pt-6 ${index === 0 ? 'pt-0' : ''} space-y-4`}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(r.userName)}&background=random&color=fff&size=80`}
                        alt={r.userName}
                        className="w-10 h-10 rounded-full border border-gray-200 object-cover shadow-sm"
                      />
                      <div>
                        <div className="font-black text-gray-900 text-sm">{r.userName}</div>
                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">
                          {new Date(r.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-4 h-4 ${star <= r.rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-200'}`}
                        />
                      ))}
                    </div>
                  </div>

                  {r.comment ? (
                    <blockquote className="text-gray-600 font-medium italic text-sm border-l-4 border-blue-100 pl-4 py-1 bg-gray-50/50 rounded-r-xl">
                      "{r.comment}"
                    </blockquote>
                  ) : (
                    <p className="text-gray-400 text-xs italic pl-4 font-semibold uppercase tracking-widest">
                      Rated {r.rating} stars (no written comment provided)
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExpertDetail;
