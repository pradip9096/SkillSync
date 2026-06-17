import React, { useEffect, useRef } from 'react';
import { useWebRTC } from '../../contexts/WebRTCContext';
import useUserMedia from '../../hooks/useUserMedia';
import MediaControls from './MediaControls';

const VideoSession = ({ bookingId, isInitiator, onLeave }) => {
  const { peer, remoteStream, isConnecting, error: webrtcError, initPeer, cleanupPeer } = useWebRTC();
  const { stream: localStream, getMedia, stopMedia, error: mediaError } = useUserMedia();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    const setupMedia = async () => {
      const stream = await getMedia();
      if (mounted && stream) {
        initPeer(bookingId, isInitiator, stream);
      }
    };
    setupMedia();

    return () => {
      mounted = false;
      stopMedia();
      cleanupPeer();
    };
  }, [bookingId, isInitiator, getMedia, initPeer, stopMedia, cleanupPeer]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  if (mediaError) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-white p-6 rounded-xl text-center flex-col" data-testid="media-error-ui">
        <p className="text-xl font-semibold mb-2 text-red-400">Camera Access Denied</p>
        <p className="text-gray-400">Please allow camera and microphone permissions to join the session.</p>
        <button onClick={onLeave} className="mt-6 px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-500 font-medium transition-colors">Go Back</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-black p-4 relative rounded-2xl overflow-hidden shadow-2xl">
      {webrtcError && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500/90 text-white px-6 py-3 rounded-lg shadow-xl text-sm font-medium">
          {webrtcError}
        </div>
      )}
      
      <div className="flex-1 relative w-full h-full overflow-hidden rounded-xl bg-gray-900 border border-gray-800">
        {/* Remote Video (Main viewport) */}
        {remoteStream ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center">
            <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-4" />
            <p className="text-gray-400 font-medium">
              {isConnecting ? 'Connecting to secure P2P node...' : 'Waiting for the other participant to join...'}
            </p>
          </div>
        )}

        {/* Local Video (Picture-in-Picture) */}
        {localStream && (
          <div className="absolute bottom-6 right-6 w-32 h-48 md:w-48 md:h-32 bg-gray-800 rounded-xl overflow-hidden shadow-2xl border-2 border-gray-700 z-10 transition-transform hover:scale-105">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover mirror-mode"
              style={{ transform: 'scaleX(-1)' }}
            />
          </div>
        )}
      </div>

      <MediaControls localStream={localStream} peer={peer} onLeave={onLeave} />
    </div>
  );
};

export default VideoSession;
