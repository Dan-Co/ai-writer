import { useState, useRef, useCallback, useEffect } from 'react';

export interface UseSpeechToTextReturn {
  isRecording: boolean;
  recordingSeconds: number;
  audioBlob: Blob | null;
  error: string | null;
  isSupported: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  reset: () => void;
}

const MAX_RECORDING_SECONDS = 60;

/**
 * Reusable hook for recording audio from the browser microphone.
 * Extracted and generalized from VoiceAvatarPlaceholder.tsx recording logic.
 */
export const useSpeechToText = (): UseSpeechToTextReturn => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);

  const isSupported = typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    recorderRef.current = null;
    chunksRef.current = [];
    setIsRecording(false);
    setRecordingSeconds(0);
  }, []);

  const stopRecording = useCallback(() => {
    try {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      } else {
        cleanup();
      }
    } catch {
      cleanup();
    }
  }, [cleanup]);

  const startRecording = useCallback(async () => {
    if (!isSupported) {
      setError('Microphone is not supported in this browser.');
      return;
    }

    setError(null);
    setAudioBlob(null);
    cleanup();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        try {
          const chunks = [...chunksRef.current];
          const blob = new Blob(chunks, { type: mimeType });
          setAudioBlob(blob);
        } catch (err: any) {
          setError('Failed to create audio recording. Please try again.');
        } finally {
          cleanup();
        }
      };

      recorder.onerror = () => {
        setError('Recording error occurred. Please try again.');
        cleanup();
      };

      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((s) => {
          const next = s + 1;
          if (next >= MAX_RECORDING_SECONDS) {
            stopRecording();
          }
          return next;
        });
      }, 1000);
    } catch (e: any) {
      setError(e?.message || 'Failed to access microphone');
      cleanup();
    }
  }, [isSupported, cleanup, stopRecording]);

  const reset = useCallback(() => {
    setAudioBlob(null);
    setError(null);
    cleanup();
  }, [cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return {
    isRecording,
    recordingSeconds,
    audioBlob,
    error,
    isSupported,
    startRecording,
    stopRecording,
reset,
  };
};
