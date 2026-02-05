'use client';

import { useState, useCallback, useRef } from 'react';

interface UseVoiceInputOptions {
  onTranscript: (text: string) => void;
  onError?: (error: Error) => void;
}

export function useVoiceInput({ onTranscript, onError }: UseVoiceInputOptions) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startListening = useCallback(async () => {
    try {
      setIsListening(true);
      setError(null);

      console.log('[Voice] Requesting microphone access...');

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      mediaStreamRef.current = stream;
      console.log('[Voice] Microphone access granted');

      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsListening(false);
        setIsProcessing(true);

        try {
          console.log('[Voice] Processing audio...');

          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

          // Send to server-side API route
          const formData = new FormData();
          formData.append('audio', audioBlob, `recording.${mimeType.split('/')[1]}`);

          console.log('[Voice] Sending to transcription API...');

          const response = await fetch('/api/voice/transcribe', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Transcription failed');
          }

          const data = await response.json();
          const transcript = data.transcript;

          console.log('[Voice] Transcript received:', transcript);

          if (transcript && transcript.trim()) {
            onTranscript(transcript);
          } else {
            throw new Error('No speech detected');
          }
        } catch (err) {
          console.error('[Voice] Transcription error:', err);
          const errorMsg = err instanceof Error ? err.message : 'Failed to transcribe';
          setError(errorMsg);
          if (onError) onError(err as Error);
        } finally {
          setIsProcessing(false);

          if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
          }
        }
      };

      mediaRecorder.start();
      console.log('[Voice] Recording started');

      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          console.log('[Voice] Auto-stopping after 30 seconds');
          mediaRecorder.stop();
        }
      }, 30000);

    } catch (err) {
      console.error('[Voice] Setup error:', err);

      let errorMsg = 'Microphone access denied';
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          errorMsg = 'Please enable microphone in browser settings';
        } else if (err.name === 'NotFoundError') {
          errorMsg = 'No microphone found';
        }
      }

      setError(errorMsg);
      setIsListening(false);
      if (onError) onError(err as Error);
    }
  }, [onTranscript, onError]);

  const stopListening = useCallback(() => {
    console.log('[Voice] Stopping recording...');

    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    setIsListening(false);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isListening,
    isProcessing,
    error,
    startListening,
    stopListening,
    clearError,
  };
}
