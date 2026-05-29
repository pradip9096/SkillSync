import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { fetchUnreadMessageCount, fetchUnreadNotificationCount } from '../services/api';
import socket from '../services/socket';

const NotificationContext = createContext();

export const useNotification = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const fetchCounts = async () => {
    if (!user || (user.role !== 'Client' && user.role !== 'Expert')) return;
    try {
      const [msgRes, notifRes] = await Promise.all([
        fetchUnreadMessageCount(),
        fetchUnreadNotificationCount()
      ]);
      setUnreadMessages(msgRes.data.count);
      setUnreadNotifications(notifRes.data.count);
    } catch (err) {
      console.error('Failed to fetch counts', err);
    }
  };

  useEffect(() => {
    fetchCounts();

    if (user) {
      socket.emit('join_user_room', user.id);
      
      const handleNewMessage = (msg) => {
        if (msg.receiver === user.id) setUnreadMessages(prev => prev + 1);
      };
      
      const handleNewNotif = () => setUnreadNotifications(prev => prev + 1);

      socket.on('new_message', handleNewMessage);
      socket.on('new_notification', handleNewNotif);

      return () => {
        socket.off('new_message', handleNewMessage);
        socket.off('new_notification', handleNewNotif);
      };
    }
  }, [user]);

  return (
    <NotificationContext.Provider value={{ unreadMessages, unreadNotifications, fetchCounts }}>
      {children}
    </NotificationContext.Provider>
  );
};
