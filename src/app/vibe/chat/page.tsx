"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// Reuse the same control-panel chat page by importing it directly.
// This keeps behavior identical, but removes the sidebar because this route
// is outside /control-panel layout.
import ControlPanelChatPage from "@/app/control-panel/chat/page";

export default function VibeChatPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
        <Link
          href="/control-panel/chat"
          className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          <ArrowLeft size={16} />
          Back to Control Panel
        </Link>

        <div className="text-sm font-semibold text-gray-900">Vibe Coding Mode</div>

        <div className="w-[160px]" />
      </div>

      <ControlPanelChatPage />
    </div>
  );
}