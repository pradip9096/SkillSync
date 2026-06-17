import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import VideoSession from '../components/VideoRoom/VideoSession';
import { WebRTCProvider } from '../contexts/WebRTCContext';
import { useAuth } from '../context/AuthContext';
import { fetchVideoToken } from '../services/api'; // just to test basic connectivity early if needed
import API from '../services/api';

const VideoRoomPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBooking = async () => {
      try {
        const response = await API.get(`/bookings/${id}`);
        setBooking(response.data.data);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load booking');
      }
    };
    fetchBooking();
  }, [id]);

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen w-full bg-gray-900 text-white flex-col">
        <h2 className="text-2xl font-bold mb-4 text-red-500">Error Joining Room</h2>
        <p className="text-gray-300 text-center max-w-md" data-testid="room-error-message">{error}</p>
        <button onClick={() => navigate('/my-bookings')} className="mt-6 px-6 py-2 bg-blue-600 rounded-lg font-semibold hover:bg-blue-500 transition-colors">Go Back</button>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const isInitiator = user?.role === 'Client';

  return (
    <div className="h-screen w-full bg-black fixed top-0 left-0 z-50">
      <WebRTCProvider>
        <VideoSession bookingId={id} isInitiator={isInitiator} onLeave={() => navigate('/my-bookings')} />
      </WebRTCProvider>
    </div>
  );
};

export default VideoRoomPage;
