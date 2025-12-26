"use client";

import { PageHeader } from "@/components/layout/page-header";
import { CopyButton } from "@/components/chat/copy-button";
import { useMemo, useState } from "react";

type Device = "desktop" | "tablet" | "mobile";

function deviceStyle(device: Device) {
  if (device === "mobile") return "w-[390px] h-[844px]";
  if (device === "tablet") return "w-[820px] h-[1180px]";
  return "w-full h-full";
}

type Role = "user" | "assistant";

type Msg = {
  id: string;
  role: Role;
  content: string;
};

export default function ChatPage() {
  const [device, setDevice] = useState<Device>("desktop");
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Temporary local state until CopilotKit Agent wiring is completed:
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: "m1",
      role: "assistant",
      content:
        "Hi! Tell me what dashboard you want to build, and which platform (Vapi, Retell, n8n) you're connecting first.",
    },
  ]);

  const rendered = useMemo(() => messages, [messages]);

  async function send() {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      // Call the Master Agent endpoint (OpenAI-backed)
      const res = await fetch("/api/agent/master", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: [
            ...rendered.map((m) => ({ role: m.role, content: m.content })),
            { role: "user", content: trimmed },
          ],
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Agent error: ${res.status}`);
      }

      // Read streaming response as text (MVP)
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        assistantText += decoder.decode(value, { stream: true });
      }

      const assistantMsg: Msg = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: assistantText,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Sorry—something went wrong calling the Master Agent. ${e?.message ?? ""}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <PageHeader title="Chat" subtitle="Build and edit dashboards with your AI assistant." />

      <div className="grid gap-6 px-8 pb-8 pt-6 lg:grid-cols-2">
        {/* Left: Headless chat */}
        <div className="min-h-[70vh] rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-4 py-3">
            <div className="text-sm font-semibold text-gray-900">Assistant</div>
            <div className="text-xs text-gray-500">Headless chat UI (custom)</div>
          </div>

          <div className="flex h-[calc(70vh-120px)] flex-col gap-3 overflow-auto p-4">
            {rendered.map((m) => {
              const isUser = m.role === "user";
              return (
                <div key={m.id} className="flex gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-semibold text-gray-700">
                        {isUser ? "You" : "Flowetic AI"}
                      </div>
                      <CopyButton text={m.content} />
                    </div>

                    <div
                      className={
                        isUser
                          ? "mt-1 whitespace-pre-wrap rounded-lg bg-blue-600 px-3 py-2 text-sm text-white"
                          : "mt-1 whitespace-pre-wrap rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-900"
                      }
                    >
                      {m.content}
                    </div>
                  </div>
                </div>
              );
            })}

            {isLoading ? <div className="text-xs text-gray-500">Thinking…</div> : null}
          </div>

          <div className="flex items-end gap-2 border-t border-gray-200 p-3">
            <textarea
              className="min-h-[44px] flex-1 resize-none rounded-md border border-gray-200 p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message…"
            />
            <button
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              type="button"
              onClick={send}
              disabled={isLoading}
            >
              Send
            </button>
          </div>
        </div>

        {/* Right: Preview scaffold */}
        <div className="min-h-[70vh] rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-gray-900">Preview</div>
              <div className="text-xs text-gray-500">Desktop / tablet / mobile</div>
            </div>

            <div className="flex items-center gap-2">
              {(["desktop", "tablet", "mobile"] as Device[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setDevice(d)}
                  className={
                    device === d
                      ? "rounded-full bg-blue-600 px-3 py-1 text-xs font-medium text-white"
                      : "rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                  }
                  type="button"
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="flex h-[calc(70vh-52px)] items-center justify-center overflow-auto p-4">
            <div className={`rounded-lg border bg-white ${deviceStyle(device)}`}>
              <div className="flex h-full w-full items-center justify-center text-sm text-gray-500">
                Preview surface goes here (iframe/internal renderer next).
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}