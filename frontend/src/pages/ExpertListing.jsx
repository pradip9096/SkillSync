/**
 * @file ExpertListing.jsx
 * @description Page component that displays a searchable and filterable list of experts.
 * 
 * Purpose: Allows users to browse experts, search by name, and filter by category.
 * Inputs: None.
 * Outputs: JSX element for the expert listing page.
 * Side Effects: Fetches expert data from the backend API on mount and filter changes.
 */

import { useState, useEffect } from 'react';
import { fetchExperts } from '../services/api';
import ExpertCard from '../components/ExpertCard';
import { useAuth } from '../context/AuthContext';
import { Search, Filter, Loader2, AlertCircle, ChevronDown } from 'lucide-react';

/**
 * ExpertListing Page Component.
 * 
 * Purpose: Manages the state for expert listings, search queries, and category filters.
 * Parameters: None.
 * Return value: {JSX.Element} The rendered expert listing page.
 * Side effects: Triggers API calls to fetch experts.
 */
const ExpertListing = () => {
  const { user } = useAuth();
  // State for storing the list of experts
  const [experts, setExperts] = useState([]);
  // State for managing loading and error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // State for search input and category filter
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');

  // Predefined list of expert categories
  const categories = ['Technology', 'Finance', 'Health', 'Marketing', 'Design', 'Business'];

  /**
   * Effect Hook to fetch experts whenever search or category filters change.
   * Includes a debounce mechanism to prevent excessive API calls while typing.
   */
  useEffect(() => {
    /**
     * Async function to fetch experts based on current filters.
     * 
     * Purpose: Calls the API and updates state with the results.
     */
    const getExperts = async () => {
      try {
        setLoading(true);
        // Fetch experts with current filter parameters
        const { data } = await fetchExperts({ search, category });
        setExperts(data.data);
        setError(null);
      } catch (err) {
        console.error(err);
        setError('Failed to fetch experts. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    /**
     * Debounce logic:
     * We wait for 500ms after the last keystroke or filter change before 
     * making the API request.
     */
    const delayDebounceFn = setTimeout(() => {
      getExperts();
    }, 500);

    // Cleanup function to clear the timeout if the effect is re-triggered
    return () => clearTimeout(delayDebounceFn);
  }, [search, category]);

  // Filter out the expert's own profile card if logged in
  const displayedExperts = (experts || []).filter(
    (exp) => !user || (exp.user !== user._id && exp.user?._id !== user._id)
  );

  return (
    <div className="min-h-screen bg-gray-50/50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Header Section */}
        <div className="mb-12 text-center animate-fade-in">
          <h1 className="text-5xl font-black text-gray-900 mb-4 tracking-tight">
            Find Your <span className="text-blue-600">Expert</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto font-medium">
            Connect with industry-leading professionals in real-time. Fast, secure, and reliable.
          </p>
        </div>

        {/* Filters & Search Section */}
        <div className="flex flex-col md:flex-row gap-4 mb-12 animate-fade-in delay-100">
          {/* Search Input with Icon */}
          <div className="relative flex-grow group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 group-focus-within:text-blue-500 transition-colors" />
            <input
              type="text"
              placeholder="Search experts by name..."
              className="w-full pl-12 pr-4 py-4 bg-white border border-gray-100 rounded-2xl shadow-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-medium"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Category Dropdown */}
          <div className="relative min-w-[240px]">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <select
              className="w-full pl-12 pr-10 py-4 bg-white border border-gray-100 rounded-2xl shadow-sm appearance-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none cursor-pointer font-medium transition-all duration-200 hover:border-blue-200"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
          </div>
        </div>

        {/* Content Display Section */}
        {loading ? (
          // Loading Spinner
          <div className="flex flex-col items-center justify-center py-24">
            <div className="relative">
              <Loader2 className="w-16 h-16 text-blue-600 animate-spin" />
              <div className="absolute inset-0 blur-2xl bg-blue-400/20 rounded-full animate-pulse"></div>
            </div>
            <p className="text-gray-500 font-bold mt-6 tracking-wide uppercase text-sm">Initializing...</p>
          </div>
        ) : error ? (
          // Error Message
          <div className="bg-red-50 border border-red-100 text-red-700 px-8 py-6 rounded-3xl flex items-center gap-4 animate-fade-in">
            <AlertCircle className="w-8 h-8 text-red-500" />
            <p className="font-semibold text-lg">{error}</p>
          </div>
        ) : (displayedExperts || []).length > 0 ? (
          // Grid of Expert Cards
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {(displayedExperts || []).map((expert, index) => (
              <ExpertCard key={expert._id} expert={expert} index={index} />
            ))}
          </div>
        ) : (
          // Empty State
          <div className="text-center py-24 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm animate-fade-in">
            <p className="text-gray-400 text-2xl font-bold">No matches found.</p>
            <p className="text-gray-300 mt-2">Try adjusting your filters or search terms.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExpertListing;
