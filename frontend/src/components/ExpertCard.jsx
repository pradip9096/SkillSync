/**
 * @file ExpertCard.jsx
 * @description A reusable card component to display summary information for an expert.
 * 
 * Purpose: Provides a visual summary of an expert's profile, including their name, category, rating, and experience.
 * Inputs: Expert object and an index for animation.
 * Outputs: JSX element representing the expert card.
 * Side Effects: None.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Star, Briefcase, Award } from 'lucide-react';

/**
 * ExpertCard Component.
 * 
 * Purpose: Renders a card with expert details and a link to their profile.
 * @param {Object} props - Component props.
 * @param {Object} props.expert - The expert data object.
 * @param {string} props.expert._id - Unique ID of the expert.
 * @param {string} props.expert.name - Name of the expert.
 * @param {string} props.expert.category - Professional category.
 * @param {string} props.expert.description - Brief description.
 * @param {number} props.expert.rating - Expert's average rating.
 * @param {number} props.expert.experience - Years of experience.
 * @param {number} props.expert.hourlyRate - Cost per hour.
 * @param {string} [props.expert.profileImage] - URL to the profile image.
 * @param {number} props.index - The index in the list, used for staggered animation delays.
 * @returns {JSX.Element} The rendered expert card.
 * Side effects: None.
 */
const ExpertCard = ({ expert, index }) => {
  return (
    <div 
      className="group bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-xl transition-all duration-500 border border-gray-100 hover:-translate-y-2 animate-slide-up"
      // Staggered animation delay based on the card's position in the list
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="flex flex-col h-full">
        {/* Profile Image & Rating Badge */}
        <div className="relative h-56 bg-gray-200 overflow-hidden">
          <img 
            src={expert.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(expert.name)}&background=e0e7ff&color=4f46e5&size=256`} 
            alt={expert.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(expert.name)}&background=e0e7ff&color=4f46e5&size=256`;
            }}
          />
          {/* Rating overlay badge */}
          <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1.5">
            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
            <span className="text-sm font-bold text-gray-800">{expert.rating.toFixed(1)}</span>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-5 flex-grow">
          {/* Category Label */}
          <div className="mb-2">
            <span className="inline-block px-2 py-1 text-xs font-semibold tracking-wide text-blue-600 uppercase bg-blue-100 rounded-full">
              {expert.category}
            </span>
          </div>
          
          {/* Name and short description */}
          <h3 className="text-xl font-bold text-gray-900 mb-1">{expert.name}</h3>
          <p className="text-gray-600 text-sm line-clamp-2 mb-4">
            {expert.description}
          </p>

          {/* Quick stats: Experience and Hourly Rate */}
          <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
            <div className="flex items-center gap-1">
              <Award className="w-4 h-4 text-blue-500" />
              <span>{expert.experience} yrs exp</span>
            </div>
            <div className="flex items-center gap-1">
              <Briefcase className="w-4 h-4 text-green-500" />
              <span>₹{expert.hourlyRate}/hr</span>
            </div>
          </div>
        </div>

        {/* Footer: Action Button to view details */}
        <div className="p-5 pt-0 mt-auto">
          <Link 
            to={`/expert/${expert._id}`}
            className="block w-full bg-blue-600 hover:bg-blue-700 text-white text-center font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
          >
            View Profile & Book
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ExpertCard;
