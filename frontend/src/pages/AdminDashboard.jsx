/**
 * @file AdminDashboard.jsx
 * @description Administrative dashboard for managing users, bookings, and experts.
 * 
 * Purpose: Central management panel restricted to Admin role.
 * Inputs: None.
 * Outputs: Renders user directories, booking states, and expert creator flows.
 * Side Effects: Performs admin API operations, updates local UI lists.
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  adminFetchUsers, 
  adminFetchBookings, 
  adminUpdateBookingStatus, 
  adminDeleteBooking,
  adminCreateExpert,
  adminDeleteExpert,
  adminResetPenalties,
  fetchExperts
} from '../services/api';
import { 
  Users, 
  Calendar, 
  UserCheck, 
  Plus, 
  Trash2, 
  Search, 
  Loader2, 
  X, 
  Check, 
  AlertCircle,
  FileText,
  Mail,
  Phone,
  Briefcase,
  IndianRupee,
  Lock,
  ChevronDown,
  Eye,
  EyeOff
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

const AdminDashboard = () => {
  // Navigation tabs: 'users', 'bookings', 'experts'
  const [activeTab, setActiveTab] = useState('users');

  // Backend state lists
  const [users, setUsers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [experts, setExperts] = useState([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null); // id of current action row
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // Search state for bookings
  const [bookingSearch, setBookingSearch] = useState('');
  
  // Search states for users and experts lists
  const [userSearch, setUserSearch] = useState('');
  const [expertSearch, setExpertSearch] = useState('');
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  // Modal State for adding expert
  const [showAddModal, setShowAddModal] = useState(false);
  const [newExpertEmail, setNewExpertEmail] = useState('');
  const [newExpertPassword, setNewExpertPassword] = useState('');
  const [showNewExpertPassword, setShowNewExpertPassword] = useState(false);
  const [newExpertName, setNewExpertName] = useState('');
  const [newExpertPhone, setNewExpertPhone] = useState('');
  const [newExpertCategory, setNewExpertCategory] = useState('Technology');
  const [newExpertExperience, setNewExpertExperience] = useState('');
  const [newExpertHourlyRate, setNewExpertHourlyRate] = useState('');
  const [newExpertDescription, setNewExpertDescription] = useState('');
  const [modalError, setModalError] = useState('');
  const [modalSubmitting, setModalSubmitting] = useState(false);

  // Helper helper since we don't have separate admin experts fetch
  const fetchAllExpertsPublicly = useCallback(async () => {
    return fetchExperts();
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      
      if (activeTab === 'users') {
        const { data } = await adminFetchUsers();
        const filteredUsers = (data.data || []).filter(u => u.role !== 'Admin');
        setUsers(filteredUsers);
      } else if (activeTab === 'bookings') {
        const { data } = await adminFetchBookings();
        setBookings(data.data);
      } else if (activeTab === 'experts') {
        // We fetch users and filter by expert role or fetch experts list. 
        // Let's call adminFetchUsers first to populate, and get experts.
        // Wait, for experts we can fetch the public GET /experts to list them, or write an admin route.
        // Since we want comprehensive expert statistics, let's fetch the users list and look for experts, 
        // or fetch from `/experts` directly.
        // Let's write a small backend call or use existing fetchExperts from api.js.
        // In backend, experts are stored in the Expert collection. 
        // Let's fetch all experts. Wait! In frontend api.js we have fetchExperts(params).
        // Let's import and fetch all experts using fetchExperts without pagination limit, or fetch from admin side.
        // Wait, let's look at adminController.js, we have `deleteExpertByAdmin` and `createExpertByAdmin` but no `getAllExpertsByAdmin` route.
        // However, we can use the standard fetchExperts API to get the experts list! Let's check how fetchExperts is implemented.
        // It retrieves the list. Let's make an API call to fetchExperts.
        const { data } = await fetchAllExpertsPublicly();
        setExperts(data.data || data);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, fetchAllExpertsPublicly]);

  // Fetch initial data based on active tab
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  // Handle booking status change
  const handleStatusChange = async (bookingId, newStatus) => {
    try {
      setActionLoading(bookingId);
      setErrorMsg('');
      setSuccessMsg('');
      const { data } = await adminUpdateBookingStatus(bookingId, newStatus);
      if (data.success) {
        setSuccessMsg('Booking status updated successfully!');
        // Update local state list
        setBookings(bookings.map(b => b._id === bookingId ? { ...b, status: newStatus } : b));
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.error || 'Failed to update booking status.');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle booking delete
  const handleDeleteBooking = async (bookingId) => {
    if (!window.confirm('Are you sure you want to delete this booking record? The time slot will be released.')) {
      return;
    }
    
    try {
      setActionLoading(bookingId);
      setErrorMsg('');
      setSuccessMsg('');
      const { data } = await adminDeleteBooking(bookingId);
      if (data.success) {
        setSuccessMsg('Booking deleted and slot released successfully.');
        setBookings(bookings.filter(b => b._id !== bookingId));
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to delete booking.');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle reset penalties
  const handleResetPenalties = async (userId) => {
    if (!window.confirm('Are you sure you want to reset strikes and lift booking suspensions for this user?')) {
      return;
    }

    try {
      setActionLoading(userId);
      setErrorMsg('');
      setSuccessMsg('');
      const { data } = await adminResetPenalties(userId);
      if (data.success) {
        setSuccessMsg('Strikes reset and booking suspension lifted successfully.');
        // Update local users list
        setUsers(users.map(u => u._id === userId ? { ...u, lateCancellationsCount: 0, suspendedUntil: null } : u));
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.error || 'Failed to reset penalties.');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle expert delete
  const handleDeleteExpert = async (expertId) => {
    if (!window.confirm('Are you sure you want to delete this expert? This will delete their profile, user credentials account, and all associated bookings!')) {
      return;
    }

    try {
      setActionLoading(expertId);
      setErrorMsg('');
      setSuccessMsg('');
      const { data } = await adminDeleteExpert(expertId);
      if (data.success) {
        setSuccessMsg('Expert profile and credentials deleted successfully.');
        setExperts(experts.filter(e => e._id !== expertId));
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to delete expert.');
    } finally {
      setActionLoading(null);
    }
  };

  // Create new expert
  const handleCreateExpertSubmit = async (e) => {
    e.preventDefault();
    setModalError('');
    setModalSubmitting(true);

    if (!newExpertEmail || !newExpertPassword || !newExpertName || !newExpertPhone || !newExpertCategory || !newExpertExperience || !newExpertHourlyRate) {
      setModalError('Please fill in all fields.');
      setModalSubmitting(false);
      return;
    }

    const cleanedPhone = newExpertPhone.replace(/\D/g, '');
    if (!/^[0-9]{10}$/.test(cleanedPhone)) {
      setModalError('Phone number must be a valid 10-digit mobile number.');
      setModalSubmitting(false);
      return;
    }

    if (isNaN(newExpertHourlyRate) || Number(newExpertHourlyRate) < 100) {
      setModalError('Hourly rate must be at least 100 rupees.');
      setModalSubmitting(false);
      return;
    }

    try {
      const expertData = {
        email: newExpertEmail,
        password: newExpertPassword,
        name: newExpertName,
        phone: '+91' + cleanedPhone,
        category: newExpertCategory,
        experience: Number(newExpertExperience),
        hourlyRate: Number(newExpertHourlyRate),
        description: newExpertDescription
      };

      const { data } = await adminCreateExpert(expertData);
      if (data.success) {
        setSuccessMsg(`Expert ${newExpertName} created successfully!`);
        setShowAddModal(false);
        // Reset fields
        setNewExpertEmail('');
        setNewExpertPassword('');
        setShowNewExpertPassword(false);
        setNewExpertName('');
        setNewExpertPhone('');
        setNewExpertCategory('Technology');
        setNewExpertExperience('');
        setNewExpertHourlyRate('');
        setNewExpertDescription('');
        // Reload list
        fetchData();
      }
    } catch (err) {
      console.error(err);
      setModalError(err.response?.data?.error || 'Failed to create expert.');
    } finally {
      setModalSubmitting(false);
    }
  };

  // Helper status styling
  const getStatusStyle = (status) => {
    switch (status) {
      case 'Confirmed': return 'bg-green-100 text-green-800 border-green-200';
      case 'Pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Completed': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Cancelled': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Keep suspension badges current without calling impure time APIs during render.
  useEffect(() => {
    const timerId = window.setInterval(() => setCurrentTime(Date.now()), 60000);
    return () => window.clearInterval(timerId);
  }, []);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setUserSearch('');
    setBookingSearch('');
    setExpertSearch('');
  };

  // Filter bookings list based on search bar (by client/expert name and email)
  const filteredBookings = bookings.filter(b => {
    const searchVal = bookingSearch.toLowerCase().trim();
    if (!searchVal) return true;
    
    const clientEmail = (b.userEmail || b.user?.email || '').toLowerCase();
    const clientName = (b.userName || b.user?.name || '').toLowerCase();
    const clientPhone = (b.userPhone || b.user?.phone || '').toLowerCase();
    const expertName = b.expert?.name?.toLowerCase() || '';
    const expertEmail = b.expert?.user?.email?.toLowerCase() || '';
    
    return clientEmail.includes(searchVal) || 
           clientName.includes(searchVal) || 
           clientPhone.includes(searchVal) ||
           expertName.includes(searchVal) || 
           expertEmail.includes(searchVal);
  });

  // Filter users list based on search bar (by name, email, or role)
  const filteredUsers = users.filter(u => {
    const searchVal = userSearch.toLowerCase().trim();
    if (!searchVal) return true;
    
    const name = u.name?.toLowerCase() || '';
    const email = u.email?.toLowerCase() || '';
    const role = u.role?.toLowerCase() || '';
    const phone = u.phone?.toLowerCase() || '';
    
    return name.includes(searchVal) || 
           email.includes(searchVal) || 
           role.includes(searchVal) || 
           phone.includes(searchVal);
  });

  // Filter experts list based on search bar (by name or category)
  const filteredExperts = experts.filter(e => {
    const searchVal = expertSearch.toLowerCase().trim();
    if (!searchVal) return true;
    
    const name = e.name?.toLowerCase() || '';
    const category = e.category?.toLowerCase() || '';
    
    return name.includes(searchVal) || 
           category.includes(searchVal);
  });

  return (
    <div className="min-h-screen bg-gray-50/50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Banner Section */}
        <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-xl mb-8 relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-1/4 -translate-y-1/4 w-80 h-80 rounded-full bg-blue-600/10 pointer-events-none" />
          <div className="relative z-10">
            <span className="text-blue-400 text-xs font-black uppercase tracking-widest bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
              System Administration
            </span>
            <h1 className="text-3xl font-black mt-4">Console Dashboard</h1>
            <p className="text-slate-400 mt-2 font-medium text-sm">
              Overview and configuration of users, experts, and scheduling bookings.
            </p>
          </div>
        </div>

        {/* Global Notifications */}
        {errorMsg && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-2xl flex items-start gap-3 animate-fade-in">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-800">Admin Action Error</p>
              <p className="text-xs text-red-700 mt-1 font-medium">{errorMsg}</p>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 rounded-r-2xl flex items-start gap-3 animate-fade-in">
            <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-green-800">Success</p>
              <p className="text-xs text-green-700 mt-1 font-medium">{successMsg}</p>
            </div>
          </div>
        )}

        {/* Tab Headers */}
        <div className="flex border-b border-gray-200 mb-8 overflow-x-auto gap-4">
          <button
            onClick={() => handleTabChange('users')}
            className={`flex items-center gap-2 pb-4 px-2 text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'users' 
                ? 'border-indigo-600 text-indigo-600 font-extrabold' 
                : 'border-transparent text-gray-500 hover:text-indigo-600'
            }`}
          >
            <Users className="w-4 h-4" />
            Users List
          </button>
          
          <button
            onClick={() => handleTabChange('bookings')}
            className={`flex items-center gap-2 pb-4 px-2 text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'bookings' 
                ? 'border-indigo-600 text-indigo-600 font-extrabold' 
                : 'border-transparent text-gray-500 hover:text-indigo-600'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Bookings Manager
          </button>

          <button
            onClick={() => handleTabChange('experts')}
            className={`flex items-center gap-2 pb-4 px-2 text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'experts' 
                ? 'border-indigo-600 text-indigo-600 font-extrabold' 
                : 'border-transparent text-gray-500 hover:text-indigo-600'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            Experts Directory
          </button>
        </div>

        {/* Content Panel */}
        <div className="bg-white shadow-md rounded-3xl border border-gray-100 p-6">
          
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center">
              <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
              <p className="text-gray-500 font-medium">Fetching dataset...</p>
            </div>
          ) : (
            <>
              {/* USERS TAB */}
              {activeTab === 'users' && (
                <div>
                  {/* Search bar */}
                  <div className="mb-6 relative rounded-2xl max-w-md">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      placeholder="Search users by name, email, role, or phone..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl bg-gray-50 placeholder-gray-400 text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all text-sm"
                    />
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-black uppercase tracking-wider text-gray-400">Name</th>
                          <th className="px-6 py-3 text-left text-xs font-black uppercase tracking-wider text-gray-400">Email</th>
                          <th className="px-6 py-3 text-left text-xs font-black uppercase tracking-wider text-gray-400">Role</th>
                          <th className="px-6 py-3 text-left text-xs font-black uppercase tracking-wider text-gray-400">Phone</th>
                          <th className="px-6 py-3 text-left text-xs font-black uppercase tracking-wider text-gray-400">Reputation</th>
                          <th className="px-6 py-3 text-left text-xs font-black uppercase tracking-wider text-gray-400">Strikes</th>
                          <th className="px-6 py-3 text-left text-xs font-black uppercase tracking-wider text-gray-400">Suspension</th>
                          <th className="px-6 py-3 text-left text-xs font-black uppercase tracking-wider text-gray-400">Joined Date</th>
                          <th className="px-6 py-3 text-right text-xs font-black uppercase tracking-wider text-gray-400">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100 font-medium text-sm">
                        {filteredUsers.map(u => (
                          <tr key={u._id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-gray-900 font-bold">{u.name || 'Not Provided'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-600">{u.email}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                u.role === 'Admin' 
                                  ? 'bg-red-50 text-red-700 border-red-100' 
                                  : u.role === 'Expert' 
                                    ? 'bg-purple-50 text-purple-700 border-purple-100' 
                                    : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                              }`}>
                                {u.role}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-500">{u.phone || 'N/A'}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {u.role === 'Client' && u.numReviews > 0 ? (
                                <span className="font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded" title={`${u.rating.toFixed(1)} based on ${u.numReviews} sessions`}>
                                  ★ {u.rating.toFixed(1)} ({u.numReviews})
                                </span>
                              ) : u.role === 'Client' ? (
                                <span className="text-gray-300 italic text-xs">New Client</span>
                              ) : (
                                <span className="text-gray-300 italic text-xs">N/A</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`font-bold px-2 py-0.5 rounded border ${u.lateCancellationsCount > 0 ? 'bg-orange-50 text-orange-700 border-orange-100' : 'bg-gray-50 text-gray-500 border-gray-100'}`}>
                                {u.lateCancellationsCount || 0} / 3
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-xs">
                              {u.suspendedUntil && new Date(u.suspendedUntil).getTime() > currentTime ? (
                                <span className="text-red-600 font-bold bg-red-50 border border-red-100 rounded-full px-2 py-0.5" title={`Until ${new Date(u.suspendedUntil).toLocaleString('en-IN', { hour12: true })}`}>
                                  Suspended
                                </span>
                              ) : (
                                <span className="text-green-600 font-bold bg-green-50 border border-green-100 rounded-full px-2 py-0.5">
                                  Active
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-400 text-xs">
                              {new Date(u.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-xs">
                              {((u.lateCancellationsCount && u.lateCancellationsCount > 0) || (u.suspendedUntil && new Date(u.suspendedUntil).getTime() > currentTime)) ? (
                                <button
                                  onClick={() => handleResetPenalties(u._id)}
                                  disabled={actionLoading === u._id}
                                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50 active:scale-95 inline-flex items-center gap-1"
                                >
                                  {actionLoading === u._id && <Loader2 className="w-3 h-3 animate-spin" />}
                                  Reset Penalties
                                </button>
                              ) : (
                                <span className="text-gray-400 italic">No Penalties</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredUsers.length === 0 && (
                      <p className="text-center text-gray-400 py-10">No users found matching search criteria.</p>
                    )}
                  </div>
                </div>
              )}

              {/* BOOKINGS TAB */}
              {activeTab === 'bookings' && (
                <div>
                  {/* Search bar */}
                  <div className="mb-6 relative rounded-2xl max-w-md">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      placeholder="Search by client/expert name or email..."
                      value={bookingSearch}
                      onChange={(e) => setBookingSearch(e.target.value)}
                      className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl bg-gray-50 placeholder-gray-400 text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all text-sm"
                    />
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-black uppercase tracking-wider text-gray-400">Client Info</th>
                          <th className="px-6 py-3 text-left text-xs font-black uppercase tracking-wider text-gray-400">Expert</th>
                          <th className="px-6 py-3 text-left text-xs font-black uppercase tracking-wider text-gray-400">Date & Slot</th>
                          <th className="px-6 py-3 text-left text-xs font-black uppercase tracking-wider text-gray-400">Status</th>
                          <th className="px-6 py-3 text-right text-xs font-black uppercase tracking-wider text-gray-400">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100 font-medium text-sm">
                        {filteredBookings.map(b => (
                          <tr key={b._id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="font-bold text-gray-900">{b.userName || b.user?.name || 'Unknown Client'}</div>
                              <div className="text-xs text-gray-500">{b.userEmail || b.user?.email || 'No email available'}</div>
                              <div className="text-xs text-gray-400">{b.userPhone || b.user?.phone || 'No phone available'}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="font-bold text-indigo-700">{b.expert?.name || 'Deleted Expert'}</div>
                              <div className="text-xs text-gray-400">{b.expert?.category}</div>
                              {b.expert?.user?.email && (
                                <div className="text-xs text-gray-500 font-semibold">{b.expert.user.email}</div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                              <div className="font-semibold text-xs">
                                {new Date(b.bookingDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}
                              </div>
                              <div className="text-xs font-black text-gray-900 mt-0.5">{formatTime12H(b.slotTime)}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <select
                                value={b.status}
                                disabled={actionLoading === b._id}
                                onChange={(e) => handleStatusChange(b._id, e.target.value)}
                                className={`text-xs font-bold rounded-lg border px-2.5 py-1 focus:outline-none cursor-pointer ${getStatusStyle(b.status)}`}
                              >
                                <option value="Pending">Pending</option>
                                <option value="Confirmed">Confirmed</option>
                                <option value="Completed">Completed</option>
                                <option value="Cancelled">Cancelled</option>
                              </select>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                              <button
                                disabled={actionLoading === b._id}
                                onClick={() => handleDeleteBooking(b._id)}
                                className="text-red-500 hover:text-red-700 disabled:opacity-50 p-1.5 hover:bg-red-50 rounded-lg transition-colors cursor-pointer inline-flex items-center"
                                title="Force Delete & Release"
                              >
                                {actionLoading === b._id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredBookings.length === 0 && (
                      <p className="text-center text-gray-400 py-10">No bookings matching criteria found.</p>
                    )}
                  </div>
                </div>
              )}

              {/* EXPERTS TAB */}
              {activeTab === 'experts' && (
                <div>
                  {/* Search bar & Action Header */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div className="flex-1 max-w-md relative rounded-2xl">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        placeholder="Search experts by name or category..."
                        value={expertSearch}
                        onChange={(e) => setExpertSearch(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-xl bg-gray-50 placeholder-gray-400 text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all text-sm"
                      />
                    </div>
                    
                    <button
                      onClick={() => setShowAddModal(true)}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-md shadow-indigo-100 cursor-pointer self-start md:self-auto"
                    >
                      <Plus className="w-4 h-4" />
                      Add New Expert
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-black uppercase tracking-wider text-gray-400">Expert Name</th>
                          <th className="px-6 py-3 text-left text-xs font-black uppercase tracking-wider text-gray-400">Category</th>
                          <th className="px-6 py-3 text-left text-xs font-black uppercase tracking-wider text-gray-400">Experience</th>
                          <th className="px-6 py-3 text-left text-xs font-black uppercase tracking-wider text-gray-400">Hourly Rate</th>
                          <th className="px-6 py-3 text-left text-xs font-black uppercase tracking-wider text-gray-400">Rating</th>
                          <th className="px-6 py-3 text-right text-xs font-black uppercase tracking-wider text-gray-400">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100 font-medium text-sm">
                        {filteredExperts.map(e => (
                          <tr key={e._id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-gray-900 font-bold">{e.name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-600">{e.category}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-500">{e.experience} Years</td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-900 font-bold">₹{e.hourlyRate} / hr</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1 text-xs font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">
                                ★ {e.rating ? e.rating.toFixed(1) : '0.0'} ({e.numReviews || 0})
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                              <button
                                disabled={actionLoading === e._id}
                                onClick={() => handleDeleteExpert(e._id)}
                                className="text-red-500 hover:text-red-700 disabled:opacity-50 p-1.5 hover:bg-red-50 rounded-lg transition-colors cursor-pointer inline-flex items-center"
                                title="Delete Expert"
                              >
                                {actionLoading === e._id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredExperts.length === 0 && (
                      <p className="text-center text-gray-400 py-10">No experts found matching search criteria.</p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

        </div>

      </div>

      {/* CREATE EXPERT DIALOG OVERLAY MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden animate-scale-up">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center bg-gray-50 px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                Add Expert Account
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleCreateExpertSubmit} className="flex flex-col flex-1 overflow-hidden">
              
              <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                {modalError && (
                  <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-xl flex items-start gap-3 animate-fade-in">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700 font-semibold">{modalError}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Email */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Email (User Login)</label>
                    <div className="relative rounded-lg shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-4 w-4 text-gray-400" />
                      </div>
                      <input
                        type="email"
                        required
                        placeholder="expert@skillsync.com"
                        value={newExpertEmail}
                        onChange={(e) => setNewExpertEmail(e.target.value)}
                        className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-xs font-semibold transition-all duration-200 hover:border-indigo-200"
                      />
                    </div>
                  </div>

                   {/* Password */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Password</label>
                    <div className="relative rounded-lg shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-4 w-4 text-gray-400" />
                      </div>
                      <input
                        type={showNewExpertPassword ? "text" : "password"}
                        required
                        placeholder="••••••••"
                        value={newExpertPassword}
                        onChange={(e) => setNewExpertPassword(e.target.value)}
                        className="block w-full pl-9 pr-9 py-2 border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-xs font-semibold transition-all duration-200 hover:border-indigo-200"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewExpertPassword(!showNewExpertPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                      >
                        {showNewExpertPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Name */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Display Name</label>
                    <div className="relative rounded-lg shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Users className="h-4 w-4 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        required
                        placeholder="Dr. John Doe"
                        value={newExpertName}
                        onChange={(e) => setNewExpertName(e.target.value)}
                        className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-xs font-semibold transition-all duration-200 hover:border-indigo-200"
                      />
                    </div>
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Phone Number</label>
                    <div className="relative rounded-lg shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Phone className="h-4 w-4 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        required
                        placeholder="9876543210"
                        value={newExpertPhone}
                        onChange={(e) => {
                          let val = e.target.value.replace(/\D/g, '');
                          setNewExpertPhone(val.slice(0, 10));
                        }}
                        className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-xs font-semibold transition-all duration-200 hover:border-indigo-200"
                      />
                    </div>
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Category</label>
                    <div className="relative">
                      <select
                        value={newExpertCategory}
                        onChange={(e) => setNewExpertCategory(e.target.value)}
                        className="block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-xs font-semibold appearance-none cursor-pointer transition-all duration-200 hover:border-indigo-200"
                      >
                        <option value="Technology">Technology</option>
                        <option value="Health">Health</option>
                        <option value="Design">Design</option>
                        <option value="Finance">Finance</option>
                        <option value="Marketing">Marketing</option>
                        <option value="Business">Business</option>
                      </select>
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      </div>
                    </div>
                  </div>

                  {/* Experience */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Experience (Years)</label>
                    <div className="relative rounded-lg shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Briefcase className="h-4 w-4 text-gray-400" />
                      </div>
                      <input
                        type="number"
                        required
                        min="1"
                        placeholder="e.g. 5"
                        value={newExpertExperience}
                        onChange={(e) => setNewExpertExperience(e.target.value)}
                        className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-xs font-semibold transition-all duration-200 hover:border-indigo-200"
                      />
                    </div>
                  </div>

                  {/* Hourly Rate */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Hourly Rate (₹ INR)</label>
                    <div className="relative rounded-lg shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <IndianRupee className="h-4 w-4 text-gray-400" />
                      </div>
                      <input
                        type="number"
                        required
                        min="100"
                        placeholder="e.g. 1500 (Min ₹100)"
                        value={newExpertHourlyRate}
                        onChange={(e) => setNewExpertHourlyRate(e.target.value)}
                        className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-xs font-semibold transition-all duration-200 hover:border-indigo-200"
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Professional Biography</label>
                    <div className="relative rounded-lg shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 pt-2.5 pointer-events-none">
                        <FileText className="h-4 w-4 text-gray-400" />
                      </div>
                      <textarea
                        rows="3"
                        placeholder="Tell us about the expert's qualifications..."
                        value={newExpertDescription}
                        onChange={(e) => setNewExpertDescription(e.target.value)}
                        className="block w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-xs font-semibold resize-none transition-all duration-200 hover:border-indigo-200"
                      />
                    </div>
                  </div>

                </div>
              </div>

              {/* Modal footer controls */}
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-5 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all active:scale-95 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="flex items-center gap-1 px-6 py-2 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-md shadow-indigo-100 hover:shadow-lg hover:shadow-indigo-200/50 hover:translate-y-[-1px] active:translate-y-[1px] disabled:opacity-50 cursor-pointer"
                >
                  {modalSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-1" />
                      Creating...
                    </>
                  ) : (
                    'Add Expert'
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

export default AdminDashboard;
