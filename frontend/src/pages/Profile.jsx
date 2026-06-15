/**
 * @file Profile.jsx
 * @description Secure profile page allowing users to view metadata and update display details or passwords.
 * 
 * Purpose: Fulfills the secure user profile management requirement.
 * Inputs: None.
 * Outputs: Renders the user profile dashboard and update forms.
 * Side Effects: Performs profile GET and PUT requests, syncs state with AuthContext.
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchUserProfile, updateUserProfile as apiUpdateUserProfile, uploadProfileImage } from '../services/api';
import { User, Phone, Lock, Loader2, AlertCircle, CheckCircle2, Shield, Mail, Camera, Eye, EyeOff } from 'lucide-react';

const Profile = () => {
  const { updateUserProfile: syncAuthContext } = useAuth(); // Use auth helper to get user details
  
  // Local form states
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [profileImage, setProfileImage] = useState('');
  const [rating, setRating] = useState(5.0);
  const [numReviews, setNumReviews] = useState(0);

  // UI state
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Fetch user profile on mount
  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        const { data } = await fetchUserProfile();
        if (data && data.user) {
          setEmail(data.user.email || '');
          setRole(data.user.role || '');
          setName(data.user.name || '');
          let displayPhone = data.user.phone || '';
          if (displayPhone.startsWith('+91')) {
            displayPhone = displayPhone.slice(3);
          }
          setPhone(displayPhone);
          setProfileImage(data.user.profileImage || '');
          setRating(data.user.rating !== undefined ? data.user.rating : 5.0);
          setNumReviews(data.user.numReviews || 0);
        }
      } catch (err) {
        console.error(err);
        setErrorMsg('Failed to load profile. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, []);

  // Handle 10-digit phone number inputs
  const handlePhoneChange = (e) => {
    let val = e.target.value.replace(/\D/g, ''); // keep only digits
    setPhone(val.slice(0, 10));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setIsSaving(true);
      setErrorMsg('');
      const formData = new FormData();
      formData.append('profileImage', file);

      const { data } = await uploadProfileImage(formData);
      setProfileImage(data.profileImage);
      setSuccessMsg('Profile picture updated successfully!');
      
      const localUser = JSON.parse(localStorage.getItem('user'));
      if (localUser) {
        localUser.profileImage = data.profileImage;
        localStorage.setItem('user', JSON.stringify(localUser));
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.error || 'Failed to upload image.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    // Validations
    let finalPhone = '';
    if (phone) {
      const cleanedPhone = phone.replace(/\D/g, '');
      if (!/^[6-9][0-9]{9}$/.test(cleanedPhone)) {
        setErrorMsg('Phone number must be a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.');
        return;
      }
      finalPhone = '+91' + cleanedPhone;
    }

    if (password) {
      if (password.length < 6) {
        setErrorMsg('New password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('New passwords do not match.');
        return;
      }
    }

    try {
      setIsSaving(true);
      const updateData = role === 'Admin' ? {} : { name, phone: finalPhone };
      if (password) {
        updateData.password = password;
      }

      const { data } = await apiUpdateUserProfile(updateData);
      
      if (data && data.success) {
        setSuccessMsg('Profile updated successfully!');
        setPassword('');
        setConfirmPassword('');
        
        // Sync AuthContext so Navbar and all consumers see the updated name/phone
        // immediately without requiring a page refresh.
        // Pass the bare 10-digit phone for context (matches how it's displayed everywhere).
        syncAuthContext(data.user.name, data.user.phone);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.error || 'Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Loading user profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-8 md:p-12 text-white shadow-xl mb-8 relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-1/4 -translate-y-1/4 w-96 h-96 rounded-full bg-white/5 pointer-events-none" />
          <div className="absolute left-0 bottom-0 -translate-x-1/4 translate-y-1/4 w-80 h-80 rounded-full bg-white/5 pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <span className="text-blue-100 text-xs font-black uppercase tracking-widest bg-white/10 px-3 py-1 rounded-full backdrop-blur-md">
                My Profile
              </span>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mt-3">
                {name || 'Account Settings'}
              </h1>
              <p className="text-blue-100 mt-2 font-medium text-sm md:text-base">
                Manage your credentials, phone number, and security preferences.
              </p>
            </div>
            
            <div className="flex items-center gap-3 flex-wrap">
              {role === 'Client' && (
                <span className={`text-xs font-black uppercase tracking-wider px-4 py-2 rounded-2xl border backdrop-blur-md ${
                  numReviews === 0 
                    ? 'border-gray-400/30 bg-gray-500/20 text-gray-200' 
                    : 'border-amber-400/30 bg-amber-500/20 text-amber-100'
                }`}>
                  {numReviews === 0 
                    ? 'New Client' 
                    : `★ ${rating.toFixed(1)} Reputation (${numReviews} ${numReviews === 1 ? 'review' : 'reviews'})`
                  }
                </span>
              )}
              <span className={`text-xs font-black uppercase tracking-wider px-4 py-2 rounded-2xl border backdrop-blur-md ${
                role === 'Admin' 
                  ? 'bg-red-500/20 text-red-100 border-red-400/30' 
                  : role === 'Expert' 
                    ? 'bg-purple-500/20 text-purple-100 border-purple-400/30' 
                    : 'bg-emerald-500/20 text-emerald-100 border-emerald-400/30'
              }`}>
                Role: {role}
              </span>
            </div>
          </div>
        </div>

        {/* Content Form */}
        <div className="bg-white shadow-lg rounded-3xl border border-gray-100 p-6 md:p-10">
          
          {/* Feedback alerts */}
          {errorMsg && (
            <div className="mb-8 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-2xl flex items-start gap-3 animate-fade-in">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-800">Validation Error</p>
                <p className="text-xs text-red-700 mt-1 font-medium">{errorMsg}</p>
              </div>
            </div>
          )}

          {successMsg && (
            <div className="mb-8 p-4 bg-green-50 border-l-4 border-green-500 rounded-r-2xl flex items-start gap-3 animate-fade-in">
              <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-green-800">Success</p>
                <p className="text-xs text-green-700 mt-1 font-medium">{successMsg}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleUpdate} className="space-y-8">
            
            {/* Avatar Upload */}
            <div className="flex items-center gap-6 pb-8 border-b border-gray-100">
              <div className="relative group">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 border-4 border-white shadow-lg">
                  {profileImage ? (
                    <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-blue-50 text-blue-500 font-bold text-3xl">
                      {name ? name.charAt(0).toUpperCase() : <User className="w-8 h-8" />}
                    </div>
                  )}
                </div>
                {role !== 'Admin' && (
                  <label className="absolute bottom-0 right-0 p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg cursor-pointer transition-colors z-10">
                    <Camera className="w-4 h-4" />
                    <input type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handleImageUpload} disabled={isSaving} />
                  </label>
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Profile Picture</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {role === 'Admin' 
                    ? 'System administration accounts do not require a profile picture.' 
                    : <>Upload a professional headshot to help people recognize you. <br/> Max size: 5MB (JPEG, PNG, WebP).</>}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-8 border-b border-gray-100">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-gray-400 mb-2">
                  Email Address
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    disabled
                    value={email}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 font-bold text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-gray-400 mb-2">
                  System Role
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Shield className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    disabled
                    value={role}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 font-bold text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Editable Profile Information */}
            {role !== 'Admin' && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <span className="w-1.5 h-6 bg-blue-600 rounded-full" />
                  Personal Details
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="name" className="block text-sm font-bold text-gray-700 mb-2">
                      Full Name
                    </label>
                    <div className="relative rounded-xl shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        id="name"
                        type="text"
                        placeholder="Enter your name"
                        value={name}
                        maxLength="50"
                        onChange={(e) => setName(e.target.value)}
                        className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl text-gray-900 font-semibold bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="phone" className="block text-sm font-bold text-gray-700 mb-2">
                      Phone Number
                    </label>
                    <div className="relative rounded-xl shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Phone className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        id="phone"
                        type="text"
                        placeholder="9876543210"
                        value={phone}
                        maxLength="10"
                        onChange={handlePhoneChange}
                        className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl text-gray-900 font-semibold bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all text-sm"
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-gray-400 font-medium">Must be a 10-digit mobile number.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Change Password (Optional) */}
            <div className="pt-6 border-t border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-blue-600 rounded-full" />
                Change Password
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="pass" className="block text-sm font-bold text-gray-700 mb-2">
                    New Password
                  </label>
                  <div className="relative rounded-xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="pass"
                      type={showPassword ? "text" : "password"}
                      placeholder="•••••••• (Min 6 chars)"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-xl text-gray-900 font-semibold bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="confirmPass" className="block text-sm font-bold text-gray-700 mb-2">
                    Confirm New Password
                  </label>
                  <div className="relative rounded-xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="confirmPass"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-xl text-gray-900 font-semibold bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Control */}
            <div className="pt-6 border-t border-gray-100 flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center justify-center px-8 py-3.5 border border-transparent rounded-2xl shadow-md text-sm font-black text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Saving Changes...
                  </>
                ) : (
                  'Save Profile'
                )}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
};

export default Profile;
