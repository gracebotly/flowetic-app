'use client';

import { Mic, MicOff, Loader2 } from 'lucide-react';
import { useVoiceInput } from './hooks/useVoiceInput';
import { useState } from 'react';

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export function VoiceInputButton({ onTranscript, disabled = false }: VoiceInputButtonProps) {
  const [showError, setShowError] = useState(false);

  const {
    isListening,
    isProcessing,
    error,
    startListening,
    stopListening,
    clearError,
  } = useVoiceInput({
    onTranscript: (text) => {
      onTranscript(text);
      setShowError(false);
    },
    onError: () => {
      setShowError(true);
      setTimeout(() => {
        setShowError(false);
        clearError();
      }, 5000);
    },
  });

  return (
    <div className="relative">
      <button
        onClick={isListening ? stopListening : startListening}
        disabled={disabled || isProcessing}
        className={`
          relative p-2 rounded-full transition-all duration-200
          ${isListening
            ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
          }
          ${disabled || isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
          ${error && showError ? 'ring-2 ring-red-500' : ''}
        `}
        title={isListening ? 'Stop recording' : 'Start voice input'}
        type="button"
      >
        {isProcessing ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : isListening ? (
          <MicOff className="w-5 h-5" />
        ) : (
          <Mic className="w-5 h-5" />
        )}

        {isListening && (
          <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-75" />
        )}
      </button>

      {error && showError && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-red-500 text-white text-xs rounded shadow-lg whitespace-nowrap z-50">
          {error}
        </div>
      )}
    </div>
  );
}
