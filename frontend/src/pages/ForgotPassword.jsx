import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Loader2, AlertCircle, CheckCircle, ArrowLeft, Key } from 'lucide-react';
import { forgotPassword } from '../services/api';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      setErrorMsg('Please enter your email address.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg('');
      setSuccessMsg('');
      const res = await forgotPassword(email);
      setSuccessMsg(res.data?.message || 'A password reset link has been sent to your email.');
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to submit request. Please try again.');
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
            <Key className="w-8 h-8" />
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Forgot Password</h2>
          <p className="mt-2 text-sm text-gray-600 font-medium">
            Enter your email address to receive a secure password reset link.
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
                <p className="text-sm font-bold text-red-800">Error requesting reset</p>
                <p className="text-xs text-red-700 mt-1 font-medium">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Success Alert Panel */}
          {successMsg ? (
            <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 rounded-r-xl flex items-start gap-3 animate-fade-in">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-green-800">Check Your Email</p>
                <p className="text-xs text-green-700 mt-1 font-medium">{successMsg}</p>
                <div className="mt-4">
                  <Link
                    to="/login"
                    className="inline-flex items-center text-xs font-bold text-green-800 hover:text-green-900 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to Login
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
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
                      Sending Link...
                    </>
                  ) : (
                    'Send Reset Link'
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Direct back to login */}
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

export default ForgotPassword;
