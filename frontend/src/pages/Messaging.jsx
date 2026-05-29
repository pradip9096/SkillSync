import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchConversations, fetchMessages, sendMessage } from '../services/api';
import socket from '../services/socket';
import { Send, User, MessageSquare } from 'lucide-react';
import { useNotification } from '../context/NotificationContext';

const Messaging = () => {
  const { user } = useAuth();
  const { markChatAsReadGlobally } = useNotification();
  const [conversations, setConversations] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showSidebarOnMobile, setShowSidebarOnMobile] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const markAsReadTimeoutRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  
  const activeChatRef = useRef(activeChat);
  const prevOtherUserIdRef = useRef(null);

  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  useEffect(() => {
    const loadConversations = async () => {
      try {
        const res = await fetchConversations();
        if (res && res.data) {
          setConversations(res.data);
        }
        setError(null);
      } catch (err) {
        console.error('Error loading conversations:', err);
        setError('Failed to load conversations. Please check your connection.');
      } finally {
        setLoading(false);
      }
    };
    loadConversations();
  }, [user]);

  const loadMessages = async (bookingId, append = false) => {
    if (append) setLoadingMore(true);
    try {
      const before = append && messages.length > 0 ? messages[0]._id : null;
      const res = await fetchMessages(bookingId, before);
      
      if (res.data.length < 50) setHasMore(false);
      else setHasMore(true);

      if (append) {
        setMessages(prev => [...res.data, ...prev]);
      } else {
        setMessages(res.data);
        await markChatAsReadGlobally(bookingId);
      }
      setError(null);
    } catch (err) {
      console.error('Error loading messages:', err);
      setError('Failed to load messages.');
    } finally {
      if (append) setLoadingMore(false);
    }
  };

  // 1. Load historical messages and join room when clicking a chat
  useEffect(() => {
    if (activeChat) {
      const otherUserId = activeChat.otherUser._id;
      const bookingId = activeChat._id;

      // Only reload messages if switching to a completely different user
      if (prevOtherUserIdRef.current !== otherUserId) {
        loadMessages(bookingId);
        prevOtherUserIdRef.current = otherUserId;
      }

      // Join current booking room for typing events
      const joinRoom = () => socket.emit('join_booking_room', bookingId);
      joinRoom();
      
      socket.on('connect', joinRoom);
      return () => {
        socket.off('connect', joinRoom);
        socket.emit('leave_booking_room', bookingId);
        setIsTyping(false);
      };
    } else {
      prevOtherUserIdRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChat?._id, activeChat?.otherUser?._id]);

  // 2. Global socket listener to handle incoming messages in real-time
  useEffect(() => {
    if (!user) return;

    const handleNewMessage = (msg) => {
      const currentActiveChat = activeChatRef.current;
      
      const isChatWithCurrentRecipient = currentActiveChat && (
        (msg.sender === currentActiveChat.otherUser._id && msg.receiver === user._id) ||
        (msg.sender === user._id && msg.receiver === currentActiveChat.otherUser._id)
      );

      if (isChatWithCurrentRecipient) {
        setMessages(prev => {
          if (prev.some(m => m._id === msg._id)) return prev;
          return [...prev, msg];
        });

        // Update activeChat's active channel bookingId dynamically if it changed
        if (msg.bookingId !== currentActiveChat._id) {
          setActiveChat(prev => {
            if (prev && prev.otherUser._id === currentActiveChat.otherUser._id) {
              return { ...prev, _id: msg.bookingId };
            }
            return prev;
          });
        }

        if (msg.receiver === user._id) {
           if (markAsReadTimeoutRef.current) clearTimeout(markAsReadTimeoutRef.current);
           markAsReadTimeoutRef.current = setTimeout(() => {
             markChatAsReadGlobally(msg.bookingId).catch(console.error);
           }, 2000);
        }
      }

      // Always update the left sidebar with the latest message snippet and sort by recency
      setConversations(prev => {
        const isFromOrToParticipant = (conv) => 
          conv.otherUser._id === msg.sender || conv.otherUser._id === msg.receiver;

        const updated = prev.map(conv => {
          if (isFromOrToParticipant(conv)) {
            return { 
              ...conv, 
              _id: msg.bookingId,
              lastMessage: msg 
            };
          }
          return conv;
        });

        return updated.sort((a, b) => {
          const dateA = a.lastMessage ? new Date(a.lastMessage.createdAt) : new Date(0);
          const dateB = b.lastMessage ? new Date(b.lastMessage.createdAt) : new Date(0);
          return dateB - dateA;
        });
      });
    };

    const handleUserTyping = (userId) => {
      const currentActiveChat = activeChatRef.current;
      if (currentActiveChat && currentActiveChat.otherUser._id === userId) {
        setIsTyping(true);
      }
    };

    const handleUserStopTyping = (userId) => {
      const currentActiveChat = activeChatRef.current;
      if (currentActiveChat && currentActiveChat.otherUser._id === userId) {
        setIsTyping(false);
      }
    };

    socket.on('new_message', handleNewMessage);
    socket.on('typing', handleUserTyping);
    socket.on('stop_typing', handleUserStopTyping);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('typing', handleUserTyping);
      socket.off('stop_typing', handleUserStopTyping);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleScroll = (e) => {
    if (e.target.scrollTop === 0 && hasMore && !loadingMore && activeChat) {
      loadMessages(activeChat._id, true);
    }
  };

  const handleTypingChange = (e) => {
    setNewMessage(e.target.value);
    if (activeChat) {
      socket.emit('typing', activeChat._id);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('stop_typing', activeChat._id);
      }, 1000);
    }
  };

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || !activeChat) return;

    try {
      const receiverId = activeChat.otherUser._id;
      
      const payload = {
        bookingId: activeChat._id,
        receiverId: receiverId,
        content: newMessage
      };
      
      const res = await sendMessage(payload);
      if (res && res.data) {
        setMessages(prev => {
          if (prev.some(m => m._id === res.data._id)) return prev;
          return [...prev, res.data];
        });
        
        // Optimistically update the left sidebar too and sort by recency
        setConversations(prev => {
          const updated = prev.map(conv => {
            if (conv._id === activeChat._id) {
              return { ...conv, lastMessage: res.data };
            }
            return conv;
          });
          return updated.sort((a, b) => {
            const dateA = a.lastMessage ? new Date(a.lastMessage.createdAt) : new Date(0);
            const dateB = b.lastMessage ? new Date(b.lastMessage.createdAt) : new Date(0);
            return dateB - dateA;
          });
        });
      }
      setNewMessage('');
      setError(null);
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message. Please try again.');
    }
  };

  if (loading) return <div className="p-8 text-center">Loading conversations...</div>;

  let lastDateString = null;

  return (
    <div className="w-full max-w-[98%] xl:max-w-[1500px] mx-auto px-2 py-2 sm:px-4 sm:py-4 md:py-6 flex flex-col sm:flex-row gap-2 sm:gap-4 md:gap-6 h-[calc(100vh-120px)] overflow-hidden">
      {/* Conversations List */}
      <div className={`w-full sm:w-[280px] md:w-[320px] lg:w-[360px] flex-shrink-0 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden ${showSidebarOnMobile ? 'flex' : 'hidden sm:flex'}`}>
        <h2 className="p-4 border-b border-gray-100 font-bold text-lg text-gray-800 flex-shrink-0">Your Conversations</h2>
        <div className="p-2 flex-1 overflow-y-auto flex flex-col gap-2">
          {(!conversations || conversations.length === 0) ? (
            <p className="text-gray-500 text-sm p-4 text-center">No active sessions to discuss.</p>
          ) : (
            (conversations || []).map(conv => {
              const otherName = conv.otherUser.name;
              return (
                <button
                  key={conv._id}
                  onClick={() => {
                    setActiveChat(conv);
                    setShowSidebarOnMobile(false);
                  }}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all w-full text-left ${activeChat?._id === conv._id ? 'bg-blue-50 border border-blue-100' : 'hover:bg-gray-50 border border-transparent'}`}
                  aria-label={`Chat with ${otherName}`}
                >
                  <div className="bg-gray-100 p-2 rounded-full">
                    <User className="w-5 h-5 text-gray-500" />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <h3 className="font-bold text-gray-800 text-sm truncate">{otherName}</h3>
                    <p className="text-xs text-gray-500 truncate">{conv.lastMessage?.content || 'Say hi!'}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 flex-col overflow-hidden relative ${!showSidebarOnMobile ? 'flex' : 'hidden sm:flex'}`}>
        {error && (
          <div className="absolute top-0 left-0 right-0 bg-red-100 text-red-700 px-4 py-2 text-sm text-center flex justify-between items-center z-10">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-900 font-bold ml-4 hover:opacity-75">×</button>
          </div>
        )}
        {activeChat ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center gap-3">
              <button 
                onClick={() => setShowSidebarOnMobile(true)}
                className="sm:hidden p-2 -ml-2 rounded-xl text-gray-500 hover:bg-gray-200"
                aria-label="Back to conversations"
              >
                &larr;
              </button>
              <h3 className="font-bold text-gray-800">
                {activeChat.otherUser.name}
              </h3>
            </div>

            {/* Messages */}
            <div 
              className="flex-1 overflow-y-auto p-4 space-y-4"
              onScroll={handleScroll}
              ref={messagesContainerRef}
              role="log"
              aria-live="polite"
            >
              {loadingMore && <div className="text-center text-xs text-gray-400 py-2">Loading older messages...</div>}
              {(!messages || messages.length === 0) ? (
                <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                  No messages yet. Say hello!
                </div>
              ) : (
                (messages || []).map(msg => {
                  const isMe = msg.sender === user?._id;
                  const msgDate = new Date(msg.createdAt).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
                  const showDateHeader = lastDateString !== msgDate;
                  lastDateString = msgDate;

                  return (
                    <div key={msg._id}>
                      {showDateHeader && (
                        <div className="flex justify-center my-4">
                          <span className="bg-gray-100 text-gray-500 text-xs px-3 py-1 rounded-full">{msgDate}</span>
                        </div>
                      )}
                      <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-2`}>
                        <div className={`max-w-[70%] p-3 rounded-2xl ${isMe ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-gray-100 text-gray-800 rounded-tl-sm'}`}>
                          <p className="text-sm">{msg.content}</p>
                          <span className={`text-[10px] mt-1 block ${isMe ? 'text-blue-200' : 'text-gray-400'}`}>
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour12: true, hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              {isTyping && (
                <div className="flex justify-start mb-2">
                  <div className="max-w-[70%] p-3 rounded-2xl bg-gray-100 text-gray-800 rounded-tl-sm text-sm italic text-gray-500">
                    typing...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form onSubmit={handleSend} className="p-4 border-t border-gray-100 flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={handleTypingChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSend(e);
                  }
                }}
                placeholder="Type your message..."
                aria-label="Message content"
                className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm"
              />
              <button
                type="submit"
                disabled={!newMessage.trim()}
                aria-label="Send message"
                className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
            <p>Select a conversation to start chatting</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Messaging;
