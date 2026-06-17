import { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import Peer from 'simple-peer';
import socket from '../services/socket';
import { fetchVideoToken } from '../services/api';

const WebRTCContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useWebRTC = () => useContext(WebRTCContext);

export const WebRTCProvider = ({ children }) => {
  const [peer, setPeer] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const peerRef = useRef(null);

  const cleanupPeer = useCallback(() => {
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    setPeer(null);
    setRemoteStream(null);
    setIsConnecting(false);
    setError(null);
  }, []);

  const initPeer = useCallback(async (bookingId, isInitiator, localStream) => {
    setIsConnecting(true);
    setError(null);
    cleanupPeer();

    try {
      // 1. Fetch STUN/TURN credentials securely from the backend
      const response = await fetchVideoToken(bookingId);
      const iceServers = response.data.data.iceServers;

      // 2. Initialize simple-peer instance
      const newPeer = new Peer({
        initiator: isInitiator,
        trickle: false, // Wait for full ICE gathering to simplify signaling
        stream: localStream,
        config: { iceServers },
      });

      // 3. Emit local signals (SDP/ICE) to the remote peer via Socket.io
      newPeer.on('signal', (data) => {
        socket.emit('webrtc_signal', { bookingId, signal: data });
      });

      // 4. Handle incoming remote stream
      newPeer.on('stream', (stream) => {
        setRemoteStream(stream);
        setIsConnecting(false);
      });

      // 5. Handle peer errors and cleanup
      newPeer.on('error', (err) => {
        console.error('WebRTC Peer Error:', err);
        setError(err.message || 'Connection failed');
        setIsConnecting(false);
      });

      newPeer.on('close', () => {
        cleanupPeer();
      });

      peerRef.current = newPeer;
      setPeer(newPeer);
    } catch (err) {
      console.error('Failed to initialize WebRTC:', err);
      setError(err.response?.data?.error || err.message || 'Failed to initialize video session');
      setIsConnecting(false);
    }
  }, [cleanupPeer]);

  // Global listener for incoming WebRTC signaling data
  useEffect(() => {
    const handleSignal = (signal) => {
      if (peerRef.current) {
        // Feed the remote SDP/ICE data into our local simple-peer instance
        peerRef.current.signal(signal);
      }
    };

    socket.on('webrtc_signal', handleSignal);
    return () => {
      socket.off('webrtc_signal', handleSignal);
    };
  }, []);

  return (
    <WebRTCContext.Provider value={{ peer, remoteStream, isConnecting, error, initPeer, cleanupPeer }}>
      {children}
    </WebRTCContext.Provider>
  );
};
