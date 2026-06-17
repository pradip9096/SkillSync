/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { fetchUnreadMessageCount, fetchUnreadNotificationCount, markNotificationAsRead, markAllNotificationsAsRead, markMessagesAsRead } from '../services/api';
import socket from '../services/socket';

const NotificationContext = createContext();

export const useNotification = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [isSocketConnected, setIsSocketConnected] = useState(socket.connected);

  const fetchTimeoutRef = useRef(null);

  const fetchCounts = useCallback(async () => {
    if (!user || (user.role !== 'Client' && user.role !== 'Expert')) return;
    
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }
    
    return new Promise((resolve) => {
      fetchTimeoutRef.current = setTimeout(async () => {
        try {
          const [msgRes, notifRes] = await Promise.all([
            fetchUnreadMessageCount(),
            fetchUnreadNotificationCount()
          ]);
          setUnreadMessages(msgRes.data.count);
          setUnreadNotifications(notifRes.data.count);
          resolve();
        } catch (err) {
          console.error('Failed to fetch counts', err);
          resolve();
        }
      }, 300); // 300ms debounce
    });
  }, [user]);

  const markNotifAsReadGlobally = async (id) => {
    try {
      await markNotificationAsRead(id);
      setUnreadNotifications(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification as read globally:', err);
      throw err;
    }
  };

  const markAllNotifsAsReadGlobally = async () => {
    try {
      await markAllNotificationsAsRead();
      setUnreadNotifications(0);
    } catch (err) {
      console.error('Failed to mark all notifications as read globally:', err);
      throw err;
    }
  };

  const markChatAsReadGlobally = async (bookingId) => {
    try {
      await markMessagesAsRead(bookingId);
      await fetchCounts();
    } catch (err) {
      console.error('Failed to mark chat as read globally:', err);
      throw err;
    }
  };

  useEffect(() => {
     
    fetchCounts();

    const handleConnect = () => setIsSocketConnected(true);
    const handleDisconnect = () => setIsSocketConnected(false);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    if (user) {
      const joinUserRoom = () => socket.emit('join_user_room', user._id);
      joinUserRoom();
      socket.on('connect', joinUserRoom);
      
      const handleNewMessage = (msg) => {
        if (msg.receiver === user._id) setUnreadMessages(prev => prev + 1);
      };
      
      const handleNewNotif = () => setUnreadNotifications(prev => prev + 1);

      socket.on('new_message', handleNewMessage);
      socket.on('new_notification', handleNewNotif);

      return () => {
        socket.off('connect', handleConnect);
        socket.off('disconnect', handleDisconnect);
        socket.off('connect', joinUserRoom);
        socket.off('new_message', handleNewMessage);
        socket.off('new_notification', handleNewNotif);
      };
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <NotificationContext.Provider value={{ 
      unreadMessages, 
      unreadNotifications, 
      isSocketConnected,
      fetchCounts,
      markNotifAsReadGlobally,
      markAllNotifsAsReadGlobally,
      markChatAsReadGlobally
    }}>
      {children}
    </NotificationContext.Provider>
  );
};
