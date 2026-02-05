"use client";

import { useRef } from "react";
import { Mic, Send, Paperclip } from "lucide-react";
import { ModelSelector, type ModelId } from "./model-selector";
import { VoiceInputButton } from "./VoiceInputButton";

export function MessageInput(props: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
  onAttachFiles?: (files: FileList) => void;
  onToggleVoice?: () => void;
  isListening?: boolean;
  selectedModel?: ModelId;
  onModelSelect?: (modelId: ModelId) => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const disabled = !!props.disabled;
  const canSend = !disabled && props.value.trim().length > 0;

  const handleVoiceTranscript = (transcript: string) => {
    // Append voice transcript to current input value
    const newValue = props.value ? `${props.value} ${transcript}` : transcript;
    props.onChange(newValue);
  };

  return (
    <div className="relative flex items-end gap-2 rounded-2xl border border-gray-200 bg-white p-3 shadow-lg transition-all duration-300 hover:shadow-xl focus-within:border-indigo-300 focus-within:shadow-indigo-500/20">
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        multiple
        onChange={(e) => {
          const files = e.target.files;
          if (files && files.length > 0) props.onAttachFiles?.(files);
          // allow re-selecting same file
          e.currentTarget.value = "";
        }}
      />

      {props.selectedModel && props.onModelSelect ? (
        <ModelSelector
          selectedModel={props.selectedModel}
          onModelSelect={props.onModelSelect}
          onFileUpload={() => fileRef.current?.click()}
        />
      ) : (
        <button
          type="button"
          aria-label="Attach file"
          title="Attach file"
          onClick={() => fileRef.current?.click()}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-gray-600 hover:bg-gradient-to-br hover:from-indigo-50 hover:to-purple-50 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-50 transition-all duration-300"
          disabled={disabled}
        >
          <Paperclip size={18} />
        </button>
      )}

      <textarea
        aria-label="Message input"
        placeholder="Type your message..."
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        rows={1}
        className="min-h-[44px] flex-1 resize-none rounded-xl border border-gray-200 px-4 py-3 text-[15px] leading-6 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-200 disabled:bg-gray-50 transition-all duration-300"
        disabled={disabled}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (canSend) props.onSend();
          }
        }}
      />

      <VoiceInputButton
        onTranscript={handleVoiceTranscript}
        disabled={disabled}
      />

      <button
        type="button"
        aria-label="Send message"
        title="Send"
        onClick={props.onSend}
        disabled={!canSend}
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white hover:from-indigo-600 hover:to-purple-700 hover:shadow-lg hover:shadow-indigo-500/50 disabled:cursor-not-allowed disabled:from-gray-300 disabled:to-gray-400 disabled:shadow-none transition-all duration-300"
      >
        <Send size={18} />
      </button>
    </div>
  );
}