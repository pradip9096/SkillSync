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
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const loadConversations = async () => {
      try {
        const res = await fetchConversations();
        if (res && res.data) {
          setConversations(res.data);
        }
      } catch (err) {
        console.error('Error loading conversations:', err);
      } finally {
        setLoading(false);
      }
    };
    loadConversations();
  }, [user]);

  // 1. Load historical messages and join room when clicking a chat
  useEffect(() => {
    if (activeChat) {
      loadMessages(activeChat._id);
      const joinRoom = () => socket.emit('join_booking_room', activeChat._id);
      joinRoom();
      
      socket.on('connect', joinRoom);
      return () => {
        socket.off('connect', joinRoom);
      };
    }
  }, [activeChat]);

  // 2. Global socket listener to handle incoming messages in real-time
  useEffect(() => {
    const handleNewMessage = (msg) => {
      // Append to open chat window if it belongs there
      if (activeChat && msg.bookingId === activeChat._id) {
        setMessages(prev => {
          if (prev.some(m => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
        if (msg.receiver === user._id) {
           markChatAsReadGlobally(activeChat._id);
        }
      }

      // Always update the left sidebar with the latest message snippet
      setConversations(prev => prev.map(conv => {
        if (conv._id === msg.bookingId) {
          return { ...conv, lastMessage: msg };
        }
        return conv;
      }));
    };

    socket.on('new_message', handleNewMessage);
    return () => {
      socket.off('new_message', handleNewMessage);
    };
  }, [activeChat, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async (bookingId) => {
    try {
      const res = await fetchMessages(bookingId);
      setMessages(res.data);
      await markChatAsReadGlobally(bookingId);
    } catch (err) {
      console.error('Error loading messages:', err);
    }
  };

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || !activeChat) return;

    try {
      // The other user is stored in activeChat.otherUser._id
      const receiverId = activeChat.otherUser._id;
      
      const payload = {
        bookingId: activeChat._id,
        receiverId: receiverId,
        content: newMessage
      };
      
      const res = await sendMessage(payload);
      // Manually append the message to the UI instantly so the sender doesn't have to wait for the socket echo
      if (res && res.data) {
        setMessages(prev => {
          if (prev.some(m => m._id === res.data._id)) return prev;
          return [...prev, res.data];
        });
        
        // Optimistically update the left sidebar too
        setConversations(prev => prev.map(conv => {
          if (conv._id === activeChat._id) {
            return { ...conv, lastMessage: res.data };
          }
          return conv;
        }));
      }
      setNewMessage('');
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading conversations...</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 flex gap-6 h-[80vh]">
      {/* Conversations List */}
      <div className="w-1/3 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-y-auto">
        <h2 className="p-4 border-b border-gray-100 font-bold text-lg text-gray-800">Your Conversations</h2>
        <div className="p-2 flex flex-col gap-2">
          {(!conversations || conversations.length === 0) ? (
            <p className="text-gray-500 text-sm p-4 text-center">No active sessions to discuss.</p>
          ) : (
            (conversations || []).map(conv => {
              const otherName = conv.otherUser.name;
              return (
                <button
                  key={conv._id}
                  onClick={() => setActiveChat(conv)}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all w-full text-left ${activeChat?._id === conv._id ? 'bg-blue-50 border border-blue-100' : 'hover:bg-gray-50 border border-transparent'}`}
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
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
        {activeChat ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center gap-3">
              <h3 className="font-bold text-gray-800">
                {activeChat.otherUser.name}
              </h3>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {(!messages || messages.length === 0) ? (
                <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                  No messages yet. Say hello!
                </div>
              ) : (
                (messages || []).map(msg => {
                  const isMe = msg.sender === user?._id;
                  return (
                    <div key={msg._id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] p-3 rounded-2xl ${isMe ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-gray-100 text-gray-800 rounded-tl-sm'}`}>
                        <p className="text-sm">{msg.content}</p>
                        <span className={`text-[10px] mt-1 block ${isMe ? 'text-blue-200' : 'text-gray-400'}`}>
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour12: true, hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form onSubmit={handleSend} className="p-4 border-t border-gray-100 flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSend(e);
                  }
                }}
                placeholder="Type your message..."
                className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm"
              />
              <button
                type="submit"
                disabled={!newMessage.trim()}
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
