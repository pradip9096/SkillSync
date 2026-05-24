import { Link } from 'react-router-dom';
import { Calendar, Users, Clock } from 'lucide-react';

function Home() {
  return (
    <div className="flex flex-col flex-grow">
      {/* Hero Section */}
      <section className="bg-indigo-600 text-white py-20 flex-grow flex items-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
            Expert Advice, <span className="text-indigo-200">Zero Conflicts.</span>
          </h1>
          <p className="mt-6 max-w-2xl mx-auto text-xl text-indigo-100">
            SkillSync connects you directly with industry leaders. View real-time availability and book your session instantly without the back-and-forth emails.
          </p>
          <div className="mt-10 flex justify-center gap-4">
            <Link
              to="/experts"
              className="px-8 py-3 border border-transparent text-base font-medium rounded-md text-indigo-600 bg-white hover:bg-indigo-50 md:py-4 md:text-lg md:px-10 shadow-lg transition duration-150 transform hover:scale-105"
            >
              Browse Experts
            </Link>
          </div>
        </div>
      </section>

      {/* Feature Highlights */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="w-12 h-12 inline-flex items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 mb-4">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Top Industry Experts</h3>
              <p className="text-gray-500">Access a curated list of professionals ready to help you solve your specific challenges.</p>
            </div>
            <div className="text-center p-6">
              <div className="w-12 h-12 inline-flex items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 mb-4">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Real-Time Booking</h3>
              <p className="text-gray-500">See live availability. As slots are booked, they disappear instantly so you never double-book.</p>
            </div>
            <div className="text-center p-6">
              <div className="w-12 h-12 inline-flex items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 mb-4">
                <Calendar className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Manage Your Schedule</h3>
              <p className="text-gray-500">Easily track and manage your upcoming and completed sessions from a unified dashboard.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Home;
