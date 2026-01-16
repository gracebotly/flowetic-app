"use client";

import Link from "next/link";
import { useState, useCallback } from "react";
import { PanelLeft, Plus, MessagesSquare } from "lucide-react";
import { ChatWorkspace } from "@/components/vibe/chat-workspace";

export default function VibeChatPage() {
  const [requestNewConversationKey, setRequestNewConversationKey] = useState(0);
  const [requestOpenConversationsKey, setRequestOpenConversationsKey] = useState(0);

  const requestNewConversation = useCallback(() => {
    setRequestNewConversationKey((k) => k + 1);
  }, []);

  const requestOpenConversations = useCallback(() => {
    setRequestOpenConversationsKey((k) => k + 1);
  }, []);

  return (
    <div className="relative flex flex-col h-screen overflow-hidden bg-[#0b1220]">
      {/* Left mini-rail */}
      <div className="absolute left-4 top-4 z-[60] flex flex-col gap-2">
        {/* Logo button = exit vibe mode */}
        <Link
          href="/control-panel/chat"
          title="Back to Control Panel"
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/15"
        >
          <PanelLeft size={18} />
        </Link>

        {/* New conversation */}
        <button
          type="button"
          title="New conversation"
          onClick={() => {
            requestNewConversation();
          }}
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/15"
        >
          <Plus size={18} />
        </button>

        {/* Conversations popup */}
        <button
          type="button"
          title="Conversations"
          onClick={() => {
            requestOpenConversations();
          }}
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/15"
        >
          <MessagesSquare size={18} />
        </button>
      </div>

      {/* REMOVE DRAWER - ChatWorkspace now handles conversations internally */}

      {/* Workspace area: padded so rail never blocks it */}
      <div className="relative flex-1 min-h-0 overflow-hidden px-20 py-4">
        <div className="h-full min-h-0 overflow-hidden">
          <ChatWorkspace
            showEnterVibeButton={false}
            requestNewConversationKey={requestNewConversationKey}
            requestOpenConversationsKey={requestOpenConversationsKey}
          />
        </div>
      </div>
    </div>
  );
}