"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PanelLeft, Plus, MessagesSquare, X } from "lucide-react";
import { ChatWorkspace } from "@/components/vibe/chat-workspace";

type Conversation = {
  id: string;
  title: string;
  updatedAt: string;
};

export default function VibeChatPage() {
  const conversations: Conversation[] = useMemo(
    () => [
      { id: "c1", title: "ChatBot Insights dashboard", updatedAt: "Just now" },
      { id: "c2", title: "ABC Dental dashboard", updatedAt: "2h ago" },
      { id: "c3", title: "Retell mapping questions", updatedAt: "Yesterday" },
    ],
    []
  );

  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="h-screen overflow-hidden bg-[#0b1220]">
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
            // MVP placeholder: later this will create a new thread + reset messages/logs
            setDrawerOpen(false);
          }}
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/15"
        >
          <Plus size={18} />
        </button>

        {/* Conversations popup */}
        <button
          type="button"
          title="Conversations"
          onClick={() => setDrawerOpen(true)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/15"
        >
          <MessagesSquare size={18} />
        </button>
      </div>

      {/* Conversations drawer */}
      {drawerOpen ? (
        <div className="absolute left-20 top-4 z-[60] w-[320px] overflow-hidden rounded-2xl border border-white/10 bg-[#0f172a] text-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="text-sm font-semibold">Conversations</div>
            <button
              type="button"
              title="Close"
              onClick={() => setDrawerOpen(false)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/10"
            >
              <X size={18} />
            </button>
          </div>

          <div className="max-h-[70vh] overflow-auto p-2">
            {conversations.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  // MVP placeholder: later loads that conversation thread
                  setDrawerOpen(false);
                }}
                className="w-full rounded-xl px-3 py-3 text-left hover:bg-white/10"
              >
                <div className="text-sm font-medium">{c.title}</div>
                <div className="mt-1 text-xs text-white/60">{c.updatedAt}</div>
              </button>
            ))} 
          </div>
        </div>
      ) : null}

      {/* Workspace area: padded so rail never blocks it */}
      <div className="relative h-screen overflow-hidden pl-20 pr-6 py-4">
        <div className="h-[calc(100vh-32px)] overflow-hidden">
          <ChatWorkspace showEnterVibeButton={false} />
        </div>
      </div>
    </div>
  );
}