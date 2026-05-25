/**
 * @file Register.jsx
 * @description Secure signup page supporting role selection (Client vs Expert).
 * 
 * Purpose: Allows new users to create accounts with email, password, and starting role.
 * Inputs: Email, password, confirmPassword, and role.
 * Outputs: Renders registration form and handles submissions.
 * Side Effects: Performs registration POST request, updates AuthContext.
 */

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, Loader2, AlertCircle, Sparkles, UserCheck, User, Phone } from 'lucide-react';

const Register = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('Client'); // Default to Client
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  // Expert professional fields
  const [category, setCategory] = useState('Technology');
  const [experience, setExperience] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [description, setDescription] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    // Field validations
    if (!email || !password || !confirmPassword) {
      setErrorMsg('Please fill in all mandatory fields: Email and Password.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    if (role === 'Expert') {
      if (!name || !phone || !category || !experience || !hourlyRate || !description) {
        setErrorMsg('Please fill in all expert professional fields (Name, Phone, Category, Experience, Hourly Rate, Bio).');
        return;
      }
      const cleanPhone = phone.replace(/\D/g, '');
      if (!/^[0-9]{10}$/.test(cleanPhone)) {
        setErrorMsg('Phone number must be a valid 10-digit mobile number.');
        return;
      }
      if (isNaN(experience) || Number(experience) < 0) {
        setErrorMsg('Experience must be a positive number.');
        return;
      }
      if (isNaN(hourlyRate) || Number(hourlyRate) < 0) {
        setErrorMsg('Hourly rate must be a positive number.');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const extraFields = {
        ...(role === 'Expert' && {
          name,
          phone: '+91' + phone.replace(/\D/g, ''),
          category,
          experience: Number(experience),
          hourlyRate: Number(hourlyRate),
          description
        })
      };
      await register(email, password, role, extraFields);
      // Success, redirect to experts listing page
      navigate('/experts', { replace: true });
    } catch (err) {
      setErrorMsg(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md animate-fade-in">
        {/* Logo/Icon Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 text-white shadow-lg mb-4">
            <Sparkles className="w-8 h-8" />
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Create Account</h2>
          <p className="mt-2 text-sm text-gray-600 font-medium">
            Sign up to connect with real-time expert consultants.
          </p>
        </div>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md animate-slide-up">
        <div className="bg-white py-8 px-4 shadow sm:rounded-2xl sm:px-10 border border-gray-100">
          
          {/* Error Alert Panel */}
          {errorMsg && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-xl flex items-start gap-3 animate-fade-in">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-800">Registration Error</p>
                <p className="text-xs text-red-700 mt-1 font-medium">{errorMsg}</p>
              </div>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Full Name & Mobile Number Fields (Only shown for Expert signup) */}
            {role === 'Expert' && (
              <>
                {/* Full Name Field */}
                <div>
                  <label htmlFor="name" className="block text-sm font-bold text-gray-700 mb-1">
                    Full Name
                  </label>
                  <div className="relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="name"
                      type="text"
                      required
                      placeholder="John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl bg-gray-50 placeholder-gray-400 text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all text-sm"
                    />
                  </div>
                </div>

                {/* Mobile Number Field */}
                <div>
                  <label htmlFor="phone" className="block text-sm font-bold text-gray-700 mb-1">
                    Mobile Number
                  </label>
                  <div className="relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Phone className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="phone"
                      type="tel"
                      required
                      placeholder="9876543210"
                      value={phone}
                      onChange={(e) => {
                        let val = e.target.value.replace(/\D/g, '');
                        setPhone(val.slice(0, 10));
                      }}
                      className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl bg-gray-50 placeholder-gray-400 text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all text-sm"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-gray-500 font-medium">Must be a 10-digit mobile number</p>
                </div>
              </>
            )}

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-bold text-gray-700 mb-1">
                Email Address
              </label>
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl bg-gray-50 placeholder-gray-400 text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all text-sm"
                />
              </div>
            </div>

            {/* Role Selector Dropdown (Client vs Expert only, Admin blocked) */}
            <div>
              <label htmlFor="role" className="block text-sm font-bold text-gray-700 mb-1">
                Join As
              </label>
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <UserCheck className="h-5 w-5 text-gray-400" />
                </div>
                <select
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="block w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-xl bg-gray-50 text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all text-sm appearance-none cursor-pointer"
                >
                  <option value="Client">Client (Seeking Advice)</option>
                  <option value="Expert">Expert (Offering Advice)</option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-500">
                  ▼
                </div>
              </div>
            </div>

            {/* Expert Professional Details (Dynamic Section) */}
            {role === 'Expert' && (
              <div className="space-y-4 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50 my-2 animate-fade-in">
                <h3 className="text-sm font-bold text-indigo-900 flex items-center gap-1.5 mb-2">
                  <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
                  Expert Professional Profile
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="category" className="block text-xs font-bold text-gray-700 mb-1">
                      Category
                    </label>
                    <select
                      id="category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-xl bg-white text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs cursor-pointer"
                    >
                      <option value="Technology">Technology</option>
                      <option value="Finance">Finance</option>
                      <option value="Health">Health</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Design">Design</option>
                      <option value="Business">Business</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="experience" className="block text-xs font-bold text-gray-700 mb-1">
                      Experience (Years)
                    </label>
                    <input
                      id="experience"
                      type="number"
                      min="0"
                      required
                      placeholder="e.g. 5"
                      value={experience}
                      onChange={(e) => setExperience(e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-xl bg-white text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="hourlyRate" className="block text-xs font-bold text-gray-700 mb-1">
                    Hourly Rate (₹)
                  </label>
                  <input
                    id="hourlyRate"
                    type="number"
                    min="0"
                    required
                    placeholder="e.g. 1500"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-xl bg-white text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                  />
                </div>

                <div>
                  <label htmlFor="description" className="block text-xs font-bold text-gray-700 mb-1">
                    Professional Bio
                  </label>
                  <textarea
                    id="description"
                    rows="3"
                    required
                    placeholder="Briefly describe your expertise, services, and background..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-xl bg-white text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs resize-none"
                  />
                </div>
              </div>
            )}

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-bold text-gray-700 mb-1">
                Password
              </label>
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  placeholder="•••••••• (Min 6 chars)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl bg-gray-50 placeholder-gray-400 text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all text-sm"
                />
              </div>
            </div>

            {/* Confirm Password Field */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-bold text-gray-700 mb-1">
                Confirm Password
              </label>
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl bg-gray-50 placeholder-gray-400 text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all text-sm"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Creating account...
                  </>
                ) : (
                  'Sign Up'
                )}
              </button>
            </div>
          </form>

          {/* Direct to Login */}
          <div className="mt-6 text-center border-t border-gray-100 pt-6">
            <p className="text-sm text-gray-600 font-medium">
              Already have an account?{' '}
              <Link to="/login" className="text-indigo-600 hover:text-indigo-700 font-bold">
                Sign in here
              </Link>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Register;
