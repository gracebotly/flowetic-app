'use client';

import { useState, useCallback, useRef } from 'react';
import { chatVoice } from '@/mastra/voice/chatVoice';

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

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      mediaStreamRef.current = stream;

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
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          const arrayBuffer = await audioBlob.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);

          const readableStream = new ReadableStream({
            start(controller) {
              controller.enqueue(uint8Array);
              controller.close();
            },
          });

          const transcript = await chatVoice.listen(readableStream as any);

          if (transcript?.trim()) {
            onTranscript(transcript);
          } else {
            throw new Error('No speech detected');
          }
        } catch (err) {
          console.error('[Voice] Error:', err);
          setError('Failed to transcribe. Please try again.');
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

      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
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
