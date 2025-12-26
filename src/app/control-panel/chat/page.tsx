"use client";

import { PageHeader } from "@/components/layout/page-header";
import { CopyButton } from "@/components/chat/copy-button";
import {
  Terminal as TerminalIcon,
  Eye,
  Rocket,
  Wrench,
  Send,
  RefreshCw,
  CheckCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type ViewMode = "terminal" | "preview" | "deploy";

type Role = "user" | "assistant" | "system";
type Msg = { id: string; role: Role; content: string };

type LogType = "info" | "success" | "error" | "running";
type TerminalLog = { id: string; type: LogType; text: string; detail?: string };

export default function ChatPage() {
  const [view, setView] = useState<ViewMode>("terminal");
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Preview HTML for iframe srcDoc (MVP placeholder)
  const [previewHtml, setPreviewHtml] = useState<string>(
    `<div style="font-family: ui-sans-serif; padding: 24px; color: #111827;">
      <h2 style="margin:0 0 8px 0;">Dashboard Preview</h2>
      <p style="margin:0; color:#6b7280;">Preview will render here once generated.</p>
    </div>`
  );

  // Terminal logs
  const [logs, setLogs] = useState<TerminalLog[]>([
    {
      id: "l1",
      type: "info",
      text: "Welcome to Dashboard Editor",
      detail:
        "Start chatting to build or edit your client dashboards.\nTry:\n• \"Create a dashboard for ABC Dental\"\n• \"Add a call volume chart\"\n• \"Change the header color to blue\"",
    },
  ]);

  // Messages
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: "m1",
      role: "assistant",
      content:
        "Hi! Tell me what dashboard you want to build, and which platform (Vapi, Retell, n8n) you're connecting first.",
    },
  ]);

  const renderedMessages = useMemo(() => messages, [messages]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const logsEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [renderedMessages.length]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  function addLog(type: LogType, text: string, detail?: string) {
    setLogs((prev) => [...prev, { id: crypto.randomUUID(), type, text, detail }]);
  }

  async function send() {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    // Default right panel to terminal so users see "what's happening"
    setView("terminal");
    addLog("running", "Analyzing request...");

    try {
      const res = await fetch("/api/agent/master", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: [
            ...renderedMessages.map((m) => ({ role: m.role === "assistant" ? "assistant" : m.role, content: m.content })),
            { role: "user", content: trimmed },
          ],
        }),
      });

      if (!res.ok || !res.body) {
        addLog("error", "Agent request failed", `HTTP ${res.status}`);
        throw new Error(`Agent error: ${res.status}`);
      }

      addLog("success", "Connected to Master Agent");
      addLog("running", "Streaming response...");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        assistantText += decoder.decode(value, { stream: true });
        // Optional: could show partial streaming in UI later
      }

      assistantText = assistantText.trim();

      // Add assistant response
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: assistantText || "(empty response)" },
      ]);

      addLog("success", "Response received");

      // MVP: if the agent ever returns something that looks like HTML, place it in preview
      if (assistantText.includes("<html") || assistantText.includes("<div") || assistantText.includes("<body")) {
        setPreviewHtml(assistantText);
        addLog("success", "Preview updated");
      }
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Sorry—something went wrong. ${e?.message ?? ""}`,
        },
      ]);
      addLog("error", "Error", e?.message ?? "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <PageHeader title="Chat" subtitle="Build and edit dashboards with your AI assistant." />

      {/* Spec header bar (dark) */}
      <div className="mx-8 mt-6 flex h-[56px] items-center justify-between rounded-xl border border-white/10 bg-[#1f2937] px-6 text-white">
        <div className="text-[16px] font-semibold">Dashboard Editor</div>

        <div className="inline-flex items-center gap-2 rounded-lg bg-white/10 p-1">
          <button
            type="button"
            onClick={() => setView("terminal")}
            className={
              view === "terminal"
                ? "inline-flex items-center gap-2 rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white"
                : "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-gray-300 hover:bg-white/5 hover:text-gray-100"
            }
          >
            <TerminalIcon size={16} />
            <span className="hidden sm:inline">Terminal</span>
          </button>

          <button
            type="button"
            onClick={() => setView("preview")}
            className={
              view === "preview"
                ? "inline-flex items-center gap-2 rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white"
                : "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-gray-300 hover:bg-white/5 hover:text-gray-100"
            }
          >
            <Eye size={16} />
            <span className="hidden sm:inline">Preview</span>
          </button>

          <button
            type="button"
            onClick={() => setView("deploy")}
            className={
              view === "deploy"
                ? "inline-flex items-center gap-2 rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white"
                : "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-gray-300 hover:bg-white/5 hover:text-gray-100"
            }
          >
            <Rocket size={16} />
            <span className="hidden sm:inline">Deploy</span>
          </button>
        </div>
      </div>

      {/* Split layout 40/60 */}
      <div className="mx-8 mb-8 mt-4 flex min-h-[calc(100vh-220px)] overflow-hidden rounded-xl border border-gray-200 bg-white">
        {/* LEFT: chat (40%) */}
        <div className="flex w-[40%] min-w-[360px] flex-col border-r border-gray-200 bg-[#f9fafb]">
          {/* messages */}
          <div className="flex-1 overflow-y-auto p-4">
            {renderedMessages.map((m) => {
              if (m.role === "system") {
                return (
                  <div
                    key={m.id}
                    className="mx-auto my-3 w-fit rounded-md bg-gray-100 px-3 py-2 text-center text-[13px] text-gray-500"
                  >
                    {m.content}
                  </div>
                );
              }

              const isUser = m.role === "user";
              return (
                <div
                  key={m.id}
                  className={`mb-4 flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-3 ${
                      isUser
                        ? "bg-blue-500 text-white"
                        : "bg-white border border-gray-200 text-gray-900"
                    }`}
                  >
                    <div className="whitespace-pre-wrap text-[14px] leading-6">
                      {m.content}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* input */}
          <div className="border-t border-gray-200 bg-white p-4">
            <textarea
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-[14px] leading-6 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              rows={3}
              style={{ minHeight: 44, maxHeight: 120 }}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
            />
            <div className="mt-2 flex items-center justify-between">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-500 hover:bg-gray-100"
              >
                <Wrench size={16} />
                Tools
              </button>

              <button
                type="button"
                onClick={send}
                disabled={isLoading}
                className="inline-flex items-center gap-2 rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                <Send size={16} />
                Send
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT: dynamic panel (60%) */}
        <div className="flex w-[60%] flex-col">
          {/* Terminal View */}
          {view === "terminal" ? (
            <div className="flex h-full flex-col bg-[#1e1e1e]">
              <div className="border-b border-[#3d3d3d] bg-[#2d2d2d] px-4 py-3 text-[13px] text-[#cccccc]">
                Current Changes
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-4 font-mono text-[13px] leading-6 text-[#d4d4d4]">
                {logs.map((l) => {
                  const icon =
                    l.type === "success"
                      ? "✓"
                      : l.type === "error"
                      ? "✗"
                      : l.type === "running"
                      ? "⋯"
                      : "•";

                  const iconColor =
                    l.type === "success"
                      ? "text-emerald-400"
                      : l.type === "error"
                      ? "text-red-400"
                      : l.type === "running"
                      ? "text-amber-300"
                      : "text-gray-400";

                  return (
                    <div key={l.id} className="mb-3">
                      <div className="flex gap-2">
                        <span className={iconColor}>{icon}</span>
                        <span>{l.text}</span>
                      </div>
                      {l.detail ? (
                        <pre className="mt-1 whitespace-pre-wrap text-[#9ca3af]">{l.detail}</pre>
                      ) : null}
                    </div>
                  );
                })}
                <div ref={logsEndRef} />
              </div>
            </div>
          ) : null}

          {/* Preview View */}
          {view === "preview" ? (
            <div className="flex h-full flex-col bg-white">
              <div className="flex items-center justify-between border-b border-gray-200 bg-[#f9fafb] px-4 py-3 text-[13px] text-gray-900">
                <div>Dashboard Preview</div>
                <button
                  type="button"
                  onClick={() => {
                    // MVP: refresh just re-sets the same HTML
                    setPreviewHtml((v) => v);
                    addLog("info", "Preview refreshed");
                  }}
                  className="inline-flex items-center justify-center rounded-md p-2 text-gray-600 hover:bg-gray-200"
                  title="Refresh"
                >
                  <RefreshCw size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-hidden">
                <iframe
                  srcDoc={previewHtml}
                  className="h-full w-full border-0"
                  sandbox="allow-scripts allow-same-origin"
                  title="Dashboard Preview"
                />
              </div>
            </div>
          ) : null}

          {/* Deploy View */}
          {view === "deploy" ? (
            <div className="flex h-full items-center justify-center bg-white">
              <div className="mx-auto w-full max-w-[480px] px-6 py-12 text-center">
                <CheckCircle size={64} className="mx-auto mb-6 text-emerald-500" />
                <div className="mb-2 text-2xl font-semibold text-gray-900">Ready to Deploy?</div>
                <div className="mb-8 text-sm text-gray-500">
                  This will replace the current dashboard for <span className="font-medium">[Client Name]</span>.
                </div>

                <div className="mb-8 rounded-lg border border-gray-200 bg-[#f9fafb] p-4 text-left text-[13px] leading-6">
                  <div>
                    <span className="text-gray-500">Client:</span>{" "}
                    <span className="text-gray-900">ABC Dental</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Dashboard:</span>{" "}
                    <span className="text-gray-900">Main Dashboard (v2)</span>
                  </div>
                  <div>
                    <span className="text-gray-500">URL:</span>{" "}
                    <span className="text-gray-900">abc-dental.getflowetic.com</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Last deployed:</span>{" "}
                    <span className="text-gray-900">2 hours ago</span>
                  </div>
                </div>

                <div className="flex justify-center gap-3">
                  <button
                    type="button"
                    className="rounded-lg bg-blue-500 px-8 py-3 font-semibold text-white hover:bg-blue-600"
                  >
                    Deploy Now
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("terminal")}
                    className="rounded-lg border border-gray-300 px-8 py-3 font-semibold text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Mobile behavior note: MVP keeps desktop layout; responsive refinements later */}
    </div>
  );
}