"use client";

import { ChatWorkspace } from "@/components/vibe/chat-workspace";

export default function ChatPage() {
  return (
    <div className="min-h-screen">
      <div className="px-8 pt-6">
        <ChatWorkspace showEnterVibeButton />
      </div>
    </div>
  );
}