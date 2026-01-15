"use client";

import { useRef } from "react";

export function MessageInput(props: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
  onAttachFiles?: (files: FileList) => void;
  onToggleVoice?: () => void;
  isListening?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const disabled = !!props.disabled;
  const canSend = !disabled && props.value.trim().length > 0;

  return (
    <div className="flex items-end gap-2 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
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

      <button
        type="button"
        aria-label="Attach file"
        title="Attach file"
        onClick={() => fileRef.current?.click()}
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        disabled={disabled}
      >
        📎
      </button>

      <textarea
        aria-label="Message input"
        placeholder="Type your message..."
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        rows={1}
        className="min-h-[44px] flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-[16px] leading-6 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-gray-50"
        disabled={disabled}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (canSend) props.onSend();
          }
        }}
      />

      <button
        type="button"
        aria-label="Voice input"
        title="Voice input"
        onClick={props.onToggleVoice}
        className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border ${
          props.isListening ? "border-red-300 bg-red-50 text-red-700" : "border-gray-200 text-gray-700 hover:bg-gray-50"
        } disabled:opacity-50`}
        disabled={disabled}
      >
        🎤
      </button>

      <button
        type="button"
        aria-label="Send message"
        title="Send"
        onClick={props.onSend}
        disabled={!canSend}
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        →
      </button>
    </div>
  );
}