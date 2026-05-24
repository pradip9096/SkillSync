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

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchExpertById, fetchBookedSlots, createBooking } from '../services/api';
import socket from '../services/socket';
import { useAuth } from '../context/AuthContext';
import { Calendar as CalendarIcon, Clock, User, Mail, Phone, MessageSquare, Loader2, ChevronLeft, CheckCircle, ShieldCheck, Star } from 'lucide-react';

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
    userPhone: '+91 ',
    notes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Pre-fill form from user details
  useEffect(() => {
    if (user) {
      const formatPhoneForInput = (phone) => {
        if (!phone) return '+91 ';
        let val = phone.replace(/\s/g, '');
        if (!val.startsWith('+91')) val = '+91' + val.replace(/^\+?9?1?/, '');
        let displayVal = val.slice(0, 13);
        if (displayVal.length > 3) {
          displayVal = displayVal.slice(0, 3) + ' ' + displayVal.slice(3);
        }
        return displayVal;
      };

      setFormData(prev => ({
        ...prev,
        userName: prev.userName || user.name || '',
        userEmail: prev.userEmail || user.email || '',
        userPhone: (prev.userPhone && prev.userPhone !== '+91 ') ? prev.userPhone : formatPhoneForInput(user.phone)
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
    const now = new Date();
    const istNow = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    const todayStr = istNow.toISOString().split('T')[0];
    
    // If selected date is not today, it can't be in the past
    if (selectedDate !== todayStr) return false;
    
    const [sHour, sMinute] = slotTime.split(':').map(Number);
    // Crucial Note: Because we manually added the 5.5-hour offset to istNow,
    // calling .getUTCHours() actually gives us the hour in India.
    const nowHour = istNow.getUTCHours();
    const nowMinute = istNow.getUTCMinutes();
    
    if (nowHour > sHour) return true;
    if (nowHour === sHour && nowMinute >= sMinute) return true;
    return false;
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
        setBookedSlots((prev) => [...prev, data.slotTime]);
      }
    });

    // Listener for when a booking is cancelled, releasing the slot
    socket.on('slot_released', (data) => {
      if (data.bookingDate === selectedDate) {
        setBookedSlots((prev) => prev.filter(slot => slot !== data.slotTime));
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
      // Construct payload and strip formatting from phone number
      const phoneClean = formData.userPhone.replace(/\s/g, '');
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
          Your session with <span className="font-bold text-gray-900">{expert.name}</span> is set for <span className="font-bold text-blue-600">{selectedDate}</span> at <span className="font-bold text-blue-600">{selectedSlot}</span>.
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
              <img 
                src={expert.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(expert.name)}&background=e0e7ff&color=4f46e5&size=512`} 
                alt={expert.name} 
                className="w-full h-80 object-cover" 
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(expert.name)}&background=e0e7ff&color=4f46e5&size=512`;
                }}
              />
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
              
              <div className="space-y-4">
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
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-bold transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Available Slots</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {timeSlots.map((slot) => {
                  const isBooked = bookedSlots.includes(slot.value);
                  const isPassed = isSlotInPast(slot.value);
                  const isDisabled = isBooked || isPassed;

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
                      onChange={(e) => setFormData({...formData, userName: e.target.value})}
                      className="w-full pl-14 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-bold transition-all"
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
                      onChange={(e) => setFormData({...formData, userEmail: e.target.value})}
                      className="w-full pl-14 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-bold transition-all"
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
                      placeholder="+91 XXXXXXXXXX"
                      pattern="\+91\s[0-9]{10}"
                      title="Please enter a 10-digit number after the +91 prefix"
                      value={formData.userPhone}
                      onChange={(e) => {
                        // Custom formatter for the Indian phone number input
                        let val = e.target.value.replace(/\s/g, ''); 
                        if (!val.startsWith('+91')) val = '+91' + val.replace(/^\+?9?1?/, '');
                        
                        let displayVal = val.slice(0, 13);
                        if (displayVal.length > 3) {
                           displayVal = displayVal.slice(0, 3) + ' ' + displayVal.slice(3);
                        }
                        setFormData({...formData, userPhone: displayVal});
                      }}
                      className="w-full pl-14 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-bold transition-all"
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
                      onChange={(e) => setFormData({...formData, notes: e.target.value})}
                      className="w-full pl-14 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-bold transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-6">
                {/* Submission Button */}
                <button 
                  disabled={isSubmitting || !selectedSlot}
                  type="submit"
                  className={`
                    w-full py-6 rounded-[2rem] font-black text-xl tracking-tight transition-all duration-500
                    ${isSubmitting || !selectedSlot
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700 shadow-2xl shadow-blue-500/30 hover:scale-[1.02] active:scale-95'
                    }
                  `}
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-3">
                      <Loader2 className="w-6 h-6 animate-spin" /> Finalizing Booking...
                    </span>
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
      </div>
    </div>
  );
};

export default ExpertDetail;
