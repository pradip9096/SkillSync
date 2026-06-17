import { useState } from 'react';
import { Mic, MicOff, Video, VideoOff, MonitorUp, PhoneOff } from 'lucide-react';
import useUserMedia from '../../hooks/useUserMedia';

const MediaControls = ({ localStream, peer, onLeave }) => {
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const { getDisplayMedia } = useUserMedia();

  const toggleAudio = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsAudioMuted(!isAudioMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoMuted(!isVideoMuted);
    }
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      const displayStream = await getDisplayMedia({ video: true });
      if (displayStream && peer) {
        const videoTrack = localStream.getVideoTracks()[0];
        const screenTrack = displayStream.getVideoTracks()[0];
        
        // simple-peer replaceTrack signature: replaceTrack(oldTrack, newTrack, oldStream)
        peer.replaceTrack(videoTrack, screenTrack, localStream);
        
        // Revert back when user clicks 'Stop sharing' from browser native UI
        screenTrack.onended = () => {
          peer.replaceTrack(screenTrack, videoTrack, localStream);
          setIsScreenSharing(false);
        };
        setIsScreenSharing(true);
      }
    } else {
      // Revert back via our custom UI button
      const videoTrack = localStream.getVideoTracks()[0];
      // Due to simple-peer internals, if we lost the track reference, we can use RTCRtpSender
      const senders = peer._pc.getSenders();
      const sender = senders.find(s => s.track.kind === 'video');
      if (sender) {
        sender.replaceTrack(videoTrack);
      }
      setIsScreenSharing(false);
    }
  };

  return (
    <div className="flex items-center justify-center space-x-4 bg-gray-900 p-4 rounded-xl shadow-lg mt-4 w-fit mx-auto border border-gray-800">
      <button 
        onClick={toggleAudio} 
        className={`p-3 rounded-full ${isAudioMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-700 hover:bg-gray-600'} text-white transition-colors`} 
        aria-label="Toggle Audio"
        data-testid="mute-audio-btn"
      >
        {isAudioMuted ? <MicOff size={24} /> : <Mic size={24} />}
      </button>
      
      <button 
        onClick={toggleVideo} 
        className={`p-3 rounded-full ${isVideoMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-700 hover:bg-gray-600'} text-white transition-colors`} 
        aria-label="Toggle Video"
        data-testid="mute-video-btn"
      >
        {isVideoMuted ? <VideoOff size={24} /> : <Video size={24} />}
      </button>
      
      <button 
        onClick={toggleScreenShare} 
        className={`p-3 rounded-full ${isScreenSharing ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'} text-white transition-colors`} 
        aria-label="Toggle Screen Share"
        title="Share Screen"
      >
        <MonitorUp size={24} />
      </button>
      
      <button 
        onClick={onLeave} 
        className="p-3 rounded-full bg-red-600 hover:bg-red-500 text-white transition-colors ml-4" 
        aria-label="Leave Session"
        title="Leave Session"
      >
        <PhoneOff size={24} />
      </button>
    </div>
  );
};

export default MediaControls;
