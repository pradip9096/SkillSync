import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Loader2, AlertCircle, CheckCircle, ArrowLeft, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { resetPassword as resetPasswordApi } from '../services/api';

const ResetPassword = () => {
  const { token } = useParams();
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();

  // Form states
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password || !confirmPassword) {
      setErrorMsg('Please fill in both fields.');
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

    try {
      setIsSubmitting(true);
      setErrorMsg('');
      setSuccessMsg('');

      const res = await resetPasswordApi(token, password);
      
      setSuccessMsg('Your password has been successfully reset!');
      
      // Brief delay to let the user see the success alert before auto-logging in and redirecting
      setTimeout(() => {
        const { token: receivedToken, user: receivedUser } = res.data;
        loginWithToken(receivedToken, receivedUser);
        
        // Redirect based on role
        if (receivedUser.role === 'Expert') {
          navigate('/expert-dashboard', { replace: true });
        } else if (receivedUser.role === 'Admin') {
          navigate('/admin', { replace: true });
        } else {
          navigate('/experts', { replace: true });
        }
      }, 2000);

    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to reset password. The link may be invalid or expired.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md animate-fade-in">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 text-white shadow-lg mb-4">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Reset Password</h2>
          <p className="mt-2 text-sm text-gray-600 font-medium">
            Please enter and confirm your new account password.
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
                <p className="text-sm font-bold text-red-800">Reset Failed</p>
                <p className="text-xs text-red-700 mt-1 font-medium">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Success Alert Panel */}
          {successMsg && (
            <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 rounded-r-xl flex items-start gap-3 animate-fade-in">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-green-800">Success!</p>
                <p className="text-xs text-green-700 mt-1 font-medium">{successMsg}</p>
                <p className="text-[10px] text-green-600 mt-2 animate-pulse">Logging you in and redirecting...</p>
              </div>
            </div>
          )}

          {!successMsg && (
            <form className="space-y-6" onSubmit={handleSubmit}>
              {/* New Password Field */}
              <div>
                <label htmlFor="password" className="block text-sm font-bold text-gray-700 mb-1">
                  New Password
                </label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-xl bg-gray-50 placeholder-gray-400 text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all text-sm"
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

              {/* Confirm Password Field */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-bold text-gray-700 mb-1">
                  Confirm New Password
                </label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
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
                      Resetting Password...
                    </>
                  ) : (
                    'Reset Password'
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Fallback Nav */}
          {!successMsg && (
            <div className="mt-6 text-center border-t border-gray-100 pt-6">
              <Link to="/login" className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-700 font-bold gap-1 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to Sign In
              </Link>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
