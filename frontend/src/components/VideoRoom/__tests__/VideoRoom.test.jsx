import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import VideoSession from '../VideoSession';
import MediaControls from '../MediaControls';
import { vi, describe, it, expect } from 'vitest';

// Mock the context and hooks
vi.mock('../../../contexts/WebRTCContext', () => ({
  useWebRTC: vi.fn()
}));
vi.mock('../../../hooks/useUserMedia', () => ({
  default: vi.fn()
}));

import { useWebRTC } from '../../../contexts/WebRTCContext';
import useUserMedia from '../../../hooks/useUserMedia';

describe('V&V 1: VideoSession Component Media Mocking', () => {
  it('renders "Camera Access Denied" UI fallback when media stream is denied', () => {
    // Setup WebRTC context mock
    useWebRTC.mockReturnValue({
      peer: null,
      remoteStream: null,
      isConnecting: false,
      error: null,
      initPeer: vi.fn(),
      cleanupPeer: vi.fn(),
    });

    // Setup useUserMedia mock to simulate a rejected permission
    useUserMedia.mockReturnValue({
      stream: null,
      getMedia: vi.fn(),
      stopMedia: vi.fn(),
      error: new Error('Permission denied'),
    });

    render(<VideoSession bookingId="123" isInitiator={true} onLeave={vi.fn()} />);
    
    expect(screen.getByTestId('media-error-ui')).toBeInTheDocument();
    expect(screen.getByText('Camera Access Denied')).toBeInTheDocument();
  });
});

describe('V&V 2: MediaControls Component State Toggling', () => {
  it('toggles the internal enabled state of the audio track when Mute button is clicked', () => {
    const mockAudioTrack = { enabled: true, kind: 'audio' };
    const mockLocalStream = {
      getAudioTracks: () => [mockAudioTrack],
      getVideoTracks: () => [],
    };

    useUserMedia.mockReturnValue({
      getDisplayMedia: vi.fn(),
    });

    render(<MediaControls localStream={mockLocalStream} peer={null} onLeave={vi.fn()} />);
    
    const muteAudioBtn = screen.getByTestId('mute-audio-btn');
    
    // Initial state is true
    expect(mockAudioTrack.enabled).toBe(true);
    
    // Click mute
    fireEvent.click(muteAudioBtn);
    expect(mockAudioTrack.enabled).toBe(false);
    
    // Click again to unmute
    fireEvent.click(muteAudioBtn);
    expect(mockAudioTrack.enabled).toBe(true);
  });
});
