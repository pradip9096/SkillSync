import { useState, useEffect } from 'react';
import { fetchNotifications } from '../services/api';
import { Bell, CheckCircle2, Info } from 'lucide-react';
import { useNotification } from '../context/NotificationContext';

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const { markNotifAsReadGlobally, markAllNotifsAsReadGlobally } = useNotification();

  const loadNotifications = async () => {
    try {
      const res = await fetchNotifications();
      setNotifications(res.data);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadNotifications();
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await markAllNotifsAsReadGlobally();
      setNotifications((notifications || []).map(n => ({ ...n, read: true })));
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await markNotifAsReadGlobally(id);
      setNotifications((notifications || []).map(n => n._id === id ? { ...n, read: true } : n));
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  };

  const unreadCount = (notifications || []).filter(n => !n.read).length;

  if (loading) return <div className="p-8 text-center">Loading notifications...</div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-3">
          <div className="bg-blue-100 p-2 rounded-xl">
            <Bell className="w-6 h-6 text-blue-600" />
          </div>
          Your Notifications
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
              {unreadCount} New
            </span>
          )}
        </h1>
        {unreadCount > 0 && (
          <button 
            onClick={handleMarkAllRead}
            className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-blue-600 transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" />
            Mark all as read
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col gap-[1px] bg-gray-100">
        {(!notifications || notifications.length === 0) ? (
          <div className="p-12 text-center bg-white">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bell className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-lg font-bold text-gray-800">No notifications</h3>
            <p className="text-gray-500 mt-1 text-sm">You're all caught up!</p>
          </div>
        ) : (
          (notifications || []).map(notif => (
            <div 
              key={notif._id} 
              onClick={() => !notif.read && handleMarkRead(notif._id)}
              className={`p-4 bg-white hover:bg-gray-50 transition-colors cursor-pointer flex gap-4 ${!notif.read ? 'border-l-4 border-l-blue-500' : 'border-l-4 border-l-transparent opacity-70'}`}
            >
              <div className="mt-1">
                <div className={`p-2 rounded-full ${!notif.read ? 'bg-blue-50' : 'bg-gray-50'}`}>
                  <Info className={`w-5 h-5 ${!notif.read ? 'text-blue-600' : 'text-gray-400'}`} />
                </div>
              </div>
              <div className="flex-1">
                <h4 className={`text-sm font-bold ${!notif.read ? 'text-gray-900' : 'text-gray-600'}`}>{notif.title}</h4>
                <p className={`text-sm mt-1 ${!notif.read ? 'text-gray-600' : 'text-gray-500'}`}>{notif.message}</p>
                <span className="text-[10px] text-gray-400 font-medium block mt-2">
                  {new Date(notif.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Notifications;
