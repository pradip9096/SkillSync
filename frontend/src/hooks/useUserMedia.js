import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Custom hook to manage WebRTC media streams (camera, microphone, and screen share).
 * Encapsulates the navigator.mediaDevices API.
 */
const useUserMedia = () => {
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const streamRef = useRef(null);

  const getMedia = useCallback(async (constraints = { video: true, audio: true }) => {
    setIsLoading(true);
    setError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      streamRef.current = mediaStream;
      return mediaStream;
    } catch (err) {
      setError(err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getDisplayMedia = useCallback(async (constraints = { video: true }) => {
    setIsLoading(true);
    setError(null);
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia(constraints);
      return displayStream;
    } catch (err) {
      setError(err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const stopMedia = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStream(null);
    }
  }, []);

  // Cleanup on unmount to prevent memory leaks and camera light staying on
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return { stream, error, isLoading, getMedia, getDisplayMedia, stopMedia };
};

export default useUserMedia;
