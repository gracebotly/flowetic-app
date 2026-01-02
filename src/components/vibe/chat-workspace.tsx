"use client";

import Link from "next/link";
import { CopyButton } from "@/components/chat/copy-button";
import {
  Terminal as TerminalIcon,
  Eye,
  Rocket,
  Wrench,
  Send,
  RefreshCw,
  CheckCircle,
  Paperclip,
  MessageCircle,
  Mic,
  ArrowLeft,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from '@/lib/supabase/client';
import { useCopilotAction } from "@copilotkit/react-core";

type ViewMode = "terminal" | "preview" | "publish";

type Role = "user" | "assistant" | "system";
type Msg = { id: string; role: Role; content: string };

type LogType = "info" | "success" | "error" | "running";
type TerminalLog = { id: string; type: LogType; text: string; detail?: string };

interface ChatWorkspaceProps {
  showEnterVibeButton?: boolean;
}

export function ChatWorkspace({ showEnterVibeButton = false }: ChatWorkspaceProps) {
  const [view, setView] = useState<ViewMode>("terminal");
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [chatMode, setChatMode] = useState<"chat" | "voice">("chat");
  const [isListening, setIsListening] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [previewDevice, setPreviewDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0);

  const [previewDashboardId] = useState("demo-dashboard");
  const [previewVersionId, setPreviewVersionId] = useState("v1");

  const [authContext, setAuthContext] = useState<{
    userId: string | null;
    tenantId: string | null;
  }>({ userId: null, tenantId: null });

  const [vibeContextSnapshot, setVibeContextSnapshot] = useState<any>(null);

  useEffect(() => {
    async function loadAuthContext() {
      const supabase = createClient();
      
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      
      if (!userId) {
        console.error('No authenticated user found');
        return;
      }
      
      const { data: membership } = await supabase
        .from('memberships')
        .select('tenant_id')
        .eq('user_id', userId)
        .single();
      
      setAuthContext({
        userId,
        tenantId: membership?.tenant_id || null
      });
    }
    
    loadAuthContext();
  }, []);

  useEffect(() => {
    async function loadVibeContext() {
      try {
        const res = await fetch("/api/vibe/context", { method: "GET" });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json?.ok) {
          setVibeContextSnapshot(json.snapshot);
        }
      } catch {
        // ignore
      }
    }
    loadVibeContext();
  }, []);

  const [logs, setLogs] = useState<TerminalLog[]>([
    {
      id: "l1",
      type: "info",
      text: "Welcome to Dashboard Editor",
      detail:
        "Start chatting to build or edit your client dashboards.\nTry:\n• \"Create a dashboard for ABC Dental\"\n• \"Add a call volume chart\"\n• \"Change the header color to blue\"",
    },
  ]);

  const [messages, setMessages] = useState<Msg[]>([
    {
      id: "m1",
      role: "assistant",
      content: "Hello! Welcome to GetFlowetic. How can I help you?",
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

  useCopilotAction({
    name: "generatePreview",
    description: "Generate a dashboard preview based on current context",
    parameters: [
      {
        name: "instructions",
        type: "string",
        description: "Optional instructions for the preview generation",
        required: false,
      },
    ],
    handler: async (args) => {
      if (!authContext.tenantId || !authContext.userId) {
        addLog("error", "Authentication required", "Please log in to generate previews");
        return;
      }

      const interfaceId = "demo-interface";

      addLog("running", "Generating dashboard preview...", "Starting workflow execution");

      try {
        const response = await fetch('/api/agent/master', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tenantId: authContext.tenantId,
            userId: authContext.userId,
            instructions: args.instructions,
            sourceId: 'demo-source',
            platformType: 'vapi',
            message: args.instructions || 'Generate dashboard preview',
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || 'Failed to generate preview');
        }

        if (result.type === 'success') {
          setPreviewVersionId(result.versionId);
          addLog("success", "Preview generated successfully!", `View at: ${result.previewUrl}`);
          setView("preview");
        } else {
          addLog("error", "Preview generation failed", result.message);
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        addLog("error", "Preview generation failed", message);
      }
    },
  });

  const send = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setIsLoading(true);
    setInput("");

    const userMsg: Msg = { id: `u-${Date.now()}`, role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const tenantId = authContext.tenantId;
      const userId = authContext.userId;

      if (!tenantId || !userId) {
        addLog("error", "Not authenticated", "Please log in and try again.");
        setIsLoading(false);
        return;
      }

      const interfaceId = "00000000-0000-0000-0000-000000000001";
      const sourceId = "00000000-0000-0000-0000-000000000002";
      const threadId = `demo-thread-${userId}`;
      const platformType = "vapi" as const;

      addLog("running", "Sending message to agent...", text);

      const resp = await fetch("/api/agent/master", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          userId,
          sourceId,
          platformType,
          message: text,
        }),
      });

      const data = await resp.json();

      if (!resp.ok || data.type === "error") {
        addLog("error", "Agent error", data.message || "Unknown agent error");
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: data.message || "Something went wrong.",
          },
        ]);
        return;
      }

      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: "assistant", content: data.text || "" },
      ]);

      addLog("success", "Agent responded");
    } catch (e: any) {
      addLog("error", "Request failed", e?.message ?? "Unknown error");
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: "assistant", content: "Request failed." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!authContext.userId || !authContext.tenantId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col mx-auto max-w-[1920px]">
      {showEnterVibeButton && (
        <div className="mb-4 flex justify-end">
          <Link
            href="/vibe/chat"
            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Enter Vibe Mode
          </Link>
        </div>
      )}

      <div className="flex h-full min-h-0 w-full overflow-hidden rounded-xl border border-gray-300 bg-white">
        {/* LEFT: chat (35%) - FIXED VERSION */}
        <div className="flex w-[35%] min-w-[360px] flex-col border-r border-gray-300 bg-[#f9fafb] overflow-hidden">
          {/* messages - enforced flex-1 with overflow containment */}
          <div className="flex-1 overflow-y-auto p-3 min-h-0">
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
                        : "bg-white border border-gray-300 text-gray-900"
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

          {/* input - explicitly prevent shrinking */}
          <div className="flex-shrink-0 border-t border-gray-300 bg-white p-3">
            <textarea
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-[14px] leading-6 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              rows={3}
              style={{ minHeight: 44, maxHeight: 120 }}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
            />
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  multiple
                  onChange={(e) => {
                    const count = e.target.files?.length ?? 0;
                    if (count > 0) addLog("info", `Attached ${count} file(s) (upload wiring next).`);
                  }}
                />

                <button
                  type="button"
                  title="Attach files"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md text-gray-600 hover:bg-white"
                >
                  <Paperclip size={18} />
                </button>

                {chatMode === "chat" ? (
                  <button
                    type="button"
                    title="Voice chat"
                    onClick={() => {
                      setChatMode("voice");
                      addLog("info", "Voice mode activated (wiring next).");
                    }}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md text-gray-600 hover:bg-white"
                  >
                    <Mic size={18} />
                  </button>
                ) : (
                  <button
                    type="button"
                    title="Stop voice / Switch to text"
                    onClick={() => {
                      setChatMode("chat");
                      setIsListening(false);
                      addLog("info", "Switched back to text mode.");
                    }}
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-md ${
                      isListening ? "bg-red-500 text-white" : "text-gray-600"
                    }`}
                  >
                    {isListening ? <MessageCircle size={18} /> : <Mic size={18} />}
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={send}
                disabled={isLoading || !input.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Send
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT: split view */}
        <div className="flex flex-1 flex-col min-w-0">
          <div className="flex items-center justify-between border-b border-gray-300 bg-white px-4 py-2 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="text-sm font-semibold text-gray-900">
                {view === "terminal" ? "Current Changes" : view === "preview" ? "Dashboard Preview" : "Publish"}
              </div>
              {view === "preview" && (
                <>
                  <div className="inline-flex items-center gap-1 rounded-lg bg-gray-100 p-1">
                    {(["desktop", "tablet", "mobile"] as const).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setPreviewDevice(d)}
                        className={
                          previewDevice === d
                            ? "rounded-md bg-blue-500 px-3 py-1 text-xs font-medium text-white"
                            : "rounded-md px-3 py-1 text-xs font-medium text-gray-700 hover:bg-white/60"
                        }
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewRefreshKey((k) => k + 1);
                      addLog("info", "Preview refreshed");
                    }}
                    className="ml-2 inline-flex items-center justify-center rounded-md p-2 text-gray-600 hover:bg-gray-200"
                    title="Refresh"
                  >
                    <RefreshCw size={16} />
                  </button>
                </>
              )}
            </div>
            <div className="inline-flex items-center gap-1 rounded-lg bg-gray-100 p-1">
              <button
                type="button"
                title="Terminal"
                onClick={() => setView("terminal")}
                className={
                  view === "terminal"
                    ? "inline-flex h-9 w-9 items-center justify-center rounded-md bg-blue-500 text-white"
                    : "inline-flex h-9 w-9 items-center justify-center rounded-md text-gray-600 hover:bg-white"
                }
              >
                <TerminalIcon size={18} />
              </button>
              <button
                type="button"
                title="Preview"
                onClick={() => setView("preview")}
                className={
                  view === "preview"
                    ? "inline-flex h-9 w-9 items-center justify-center rounded-md bg-blue-500 text-white"
                    : "inline-flex h-9 w-9 items-center justify-center rounded-md text-gray-600 hover:bg-white"
                }
              >
                <Eye size={18} />
              </button>
              <button
                type="button"
                title="Publish"
                onClick={() => setView("publish")}
                className={
                  view === "publish"
                    ? "inline-flex h-9 w-9 items-center justify-center rounded-md bg-blue-500 text-white"
                    : "inline-flex h-9 w-9 items-center justify-center rounded-md text-gray-600 hover:bg-white"
                }
              >
                <Rocket size={18} />
              </button>
            </div>
          </div>

          {/* Terminal View */}
          {view === "terminal" ? (
            <div className="flex flex-1 flex-col bg-[#1e1e1e] min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto pl-4 pr-2 py-4 font-mono text-[13px] leading-6 text-[#d4d4d4] thin-scrollbar">
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
            <div className="flex flex-1 flex-col bg-white min-h-0 overflow-hidden">
              <div className="flex flex-1 overflow-auto bg-white pt-4 pl-4 pb-4 pr-2 thin-scrollbar">
                <div
                  className="rounded-xl border border-gray-300 bg-white shadow-sm overflow-auto"
                  style={{
                    width:
                      previewDevice === "desktop"
                        ? "100%"
                        : previewDevice === "tablet"
                        ? 820
                        : 390,
                    height:
                      previewDevice === "desktop"
                        ? "100%"
                        : "auto",
                    maxWidth: "100%",
                    maxHeight: "100%",
                  }}
                >
                  <iframe
                    key={`${previewVersionId}-${previewRefreshKey}`}
                    src={`/preview/${previewDashboardId}/${previewVersionId}`}
                    className="h-full w-full border-0"
                    sandbox="allow-scripts allow-same-origin"
                    title="Dashboard Preview"
                  />
                </div>
              </div>
            </div>
          ) : null}

          {/* Publish View */}
          {view === "publish" ? (
            <div className="flex flex-1 items-center justify-center bg-white overflow-auto">
              <div className="mx-auto w-full max-w-[480px] px-6 py-12 text-center">
                <CheckCircle size={64} className="mx-auto mb-6 text-emerald-500" />
                <div className="mb-2 text-2xl font-semibold text-gray-900">Ready to Publish?</div>
                <div className="mb-8 text-sm text-gray-500">
                  This will replace the current dashboard for <span className="font-medium">[Client Name]</span>.
                </div>

                <div className="mb-8 rounded-lg border border-gray-300 bg-[#f9fafb] p-4 text-left text-[13px] leading-6">
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
                    Publish Now
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
    </div>
  );
}
