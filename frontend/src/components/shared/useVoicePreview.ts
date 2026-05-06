import { useState, useCallback, useRef, useEffect } from "react";
import { VoiceOption } from "./voiceConstants";
import { getAuthTokenGetter, getApiUrl } from "../../api/client";

export interface UseVoicePreviewReturn {
  playingPreview: string | null;
  handlePreview: (voice: VoiceOption) => Promise<void>;
  stopCurrentAudio: () => void;
}

export const useVoicePreview = (): UseVoicePreviewReturn => {
  const [playingPreview, setPlayingPreview] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopCurrentAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }
  }, []);

  const handlePreview = useCallback(async (voice: VoiceOption) => {
    if (!voice.previewUrl) return;

    if (playingPreview === voice.id) {
      stopCurrentAudio();
      setPlayingPreview(null);
      return;
    }

    stopCurrentAudio();
    setPlayingPreview(voice.id);

    let previewUrl = voice.previewUrl;
    
    // For local development with frontend dev server, don't prepend API URL
    // The frontend serves static files from /public/ through webpack dev server
    const isLocalDev = window.location.hostname === 'localhost' && !previewUrl.includes('/api/');
    if (!isLocalDev && previewUrl.startsWith('/')) {
      previewUrl = `${getApiUrl()}${previewUrl}`;
    }
    
    if (isLocalDev) {
      console.log("[VoicePreview] Local dev - using relative URL:", previewUrl);
    } else {
      console.log("[VoicePreview] Full URL:", previewUrl);
    }
    try {
      const tokenGetter = getAuthTokenGetter();
      if (tokenGetter) {
        const token = await tokenGetter();
        if (token && previewUrl.includes('/api/')) {
          const separator = previewUrl.includes('?') ? '&' : '?';
          previewUrl = `${previewUrl}${separator}token=${encodeURIComponent(token)}`;
        }
      }
    } catch (e) {
      // Token retrieval failed — try URL without token
    }

    const audio = new Audio(previewUrl);
    audioRef.current = audio;

    audio.onerror = () => {
      console.error("Failed to load voice preview audio:", voice.previewUrl);
      if (audioRef.current === audio) {
        audioRef.current = null;
      }
      setPlayingPreview(null);
    };

    audio.onended = () => {
      if (audioRef.current === audio) {
        audioRef.current = null;
      }
      setPlayingPreview(null);
    };

    audio.play().catch((err) => {
      console.error("Failed to play voice preview:", err);
      if (audioRef.current === audio) {
        audioRef.current = null;
      }
      setPlayingPreview(null);
    });
  }, [playingPreview, stopCurrentAudio]);

  useEffect(() => {
    return () => {
      stopCurrentAudio();
    };
  }, [stopCurrentAudio]);

  return {
    playingPreview,
    handlePreview,
    stopCurrentAudio,
  };
};