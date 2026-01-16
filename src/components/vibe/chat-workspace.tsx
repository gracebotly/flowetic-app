"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
  X,
  LayoutDashboard,
  Zap,
  FileText,
  Settings,
  Shield,
  Users,
  BarChart3,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { createClient } from '@/lib/supabase/client';
import { useCopilotAction } from "@copilotkit/react-core";
import { CopilotKit } from "@copilotkit/react-core";
import { StyleBundleCards } from "@/components/vibe/tool-renderers/style-bundle-cards";
import { TodoPanel } from "@/components/vibe/tool-renderers/todo-panel";
import { InteractiveEditPanel } from "@/components/vibe/tool-renderers/interactive-edit-panel";
import { PreviewInspector } from "@/components/vibe/preview/preview-inspector";
import { WidgetPropertiesDrawer } from "@/components/vibe/preview/widget-properties-drawer";
import { MessageInput } from "@/components/vibe/message-input";

type ViewMode = "terminal" | "preview" | "publish";

type JourneyMode =
  | "select_entity"
  | "recommend"
  | "align"
  | "style"
  | "build_preview"
  | "interactive_edit"
  | "deploy";

type ToolUiPayload =
  | {
      type: "style_bundles";
      title: string;
      bundles: Array<{
        id: string;
        name: string;
        description: string;
        previewImageUrl: string;
        palette: { name: string; swatches: Array<{ name: string; hex: string }> };
        tags: string[];
      }>;
    }
  | {
      type: "todos";
      title: string;
      items: Array<{
        id: string;
        title: string;
        status: "pending" | "in_progress" | "completed";
        priority: "low" | "medium" | "high";
      }>;
    }
  | {
      type: "interactive_edit_panel";
      title: string;
      interfaceId: string;
      widgets: Array<{
        id: string;
        title: string;
        kind: "metric" | "chart" | "table" | "other";
        enabled: boolean;
      }>;
      palettes: Array<{
        id: string;
        name: string;
        swatches: Array<{ name: string; hex: string }>;
      }>;
      density: "compact" | "comfortable" | "spacious";
    };

type Role = "user" | "assistant" | "system";

type LogType = "info" | "success" | "error" | "running";
type TerminalLog = { id: string; type: LogType; text: string; detail?: string };

type VibeContext = {
  platformType: "vapi" | "retell" | "n8n" | "make";
  sourceId: string;
  entityId?: string;
  externalId?: string;
  displayName?: string;
  entityKind?: string;
  skillMD?: string;
  lastIndexed?: string | null;
  eventCount?: number | null;
};

type VibeContextExtended = VibeContext & {
  interfaceId?: string;
  previewUrl?: string;
  previewVersionId?: string;
};

interface ChatWorkspaceProps {
  showEnterVibeButton?: boolean;
  requestNewConversationKey?: number;
  requestOpenConversationsKey?: number;
}

function isToolUiPayload(value: unknown): value is ToolUiPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value
  );
}

function getRightTabForToolUi(next: ToolUiPayload): ViewMode {
  if (next.type === "interactive_edit_panel") return "preview";
  // style bundles and todos are "planning/decision" items
  return "terminal";
}

export function ChatWorkspace({
  showEnterVibeButton = false,
  requestNewConversationKey,
  requestOpenConversationsKey,
}: ChatWorkspaceProps) {
  const router = useRouter();
  const [view, setView] = useState<ViewMode>("terminal");
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [chatMode, setChatMode] = useState<"chat" | "voice">("chat");
  const [isListening, setIsListening] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  // Conversation session state
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string>("vibe");
  const [newConvOpen, setNewConvOpen] = useState(false);
  const [newPlatformType, setNewPlatformType] = useState<"retell"|"make"|"n8n"|"vapi"|"activepieces"|"other">("retell");
  const [newSourceId, setNewSourceId] = useState<string>("");
  const [newEntityId, setNewEntityId] = useState<string>("");
  const [newTitle, setNewTitle] = useState<string>("");

  // Key-based external control effects
  useEffect(() => {
    if (typeof requestNewConversationKey !== "number") return;
    if (requestNewConversationKey <= 0) return;
    setNewConvOpen(true);
  }, [requestNewConversationKey]);

  useEffect(() => {
    if (typeof requestOpenConversationsKey !== "number") return;
    if (requestOpenConversationsKey <= 0) return;
    setSessionsOpen(true);
  }, [requestOpenConversationsKey]);

  // Message persistence state
  type Msg = { id: string; role: Role; content: string; createdAt?: string };
  const [messages, setMessages] = useState<Msg[]>([]);

  const [previewDevice, setPreviewDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0);

  const [previewDashboardId] = useState("demo-dashboard");
  const [previewVersionId, setPreviewVersionId] = useState("v1");

  const [authContext, setAuthContext] = useState<{
    userId: string | null;
    tenantId: string | null;
  }>({ userId: null, tenantId: null });

  const [backendWarning, setBackendWarning] = useState<string | null>(null);

  const [vibeContextSnapshot, setVibeContextSnapshot] = useState<any>(null);
  const [vibeContext, setVibeContext] = useState<VibeContextExtended | null>(null);
  const [vibeInitDone, setVibeInitDone] = useState(false);

  const [journeyMode, setJourneyMode] = useState<JourneyMode>("select_entity");
  const [selectedOutcome, setSelectedOutcome] = useState<"dashboard" | "tool" | "form" | "product" | null>(null);
  const [selectedStoryboard, setSelectedStoryboard] = useState<string | null>(null);
  const [selectedStyleBundleId, setSelectedStyleBundleId] = useState<string | null>(null);
  const [densityPreset, setDensityPreset] = useState<"compact" | "comfortable" | "spacious">("comfortable");
  const [paletteOverrideId, setPaletteOverrideId] = useState<string | null>(null);

  function buildCtxEnvelope(message: string) {
    return (
      "__FLOWETIC_CTX__:" +
      JSON.stringify({
        userId: authContext.userId,
        tenantId: authContext.tenantId,
        vibeContext,
        journey: {
          mode: journeyMode,
          selectedOutcome,
          selectedStoryboard,
          selectedStyleBundleId,
          densityPreset,
          paletteOverrideId,
        },
      }) +
      "\n" +
      message
    );
  }

  const [toolUi, setToolUi] = useState<ToolUiPayload | null>(null);
  const [currentSpec, setCurrentSpec] = useState<any | null>(null);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [propertiesOpen, setPropertiesOpen] = useState(false);

  

  async function loadSkillMD(skillKey: string | undefined) {
    // SkillMD not implemented yet; return empty string but keep contract.
    // Later: fetch(`/skills/${skillKey}/Skill.md`) or similar.
    return "";
  }

  async function refreshCurrentSpec() {
    if (!authContext.userId || !authContext.tenantId) return;
    if (!vibeContext?.interfaceId) return;

    const res = await fetch("/api/vibe/spec", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: authContext.userId,
        tenantId: authContext.tenantId,
        interfaceId: vibeContext.interfaceId,
      }),
    });

    const data = await res.json();
    if (res.ok) setCurrentSpec(data?.spec_json ?? null);
  }

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

  useEffect(() => {
    async function checkBackend() {
      if (!authContext.userId || !authContext.tenantId) return;

      try {
        const res = await fetch("/api/projects/list", { method: "GET" });
        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
          setBackendWarning(json?.message || "Backend error loading projects.");
          return;
        }

        if (json?.warning === "PROJECTS_TABLE_MISSING") {
          setBackendWarning("Projects DB tables are missing in this environment. Control Panel features may be limited until migrations are applied.");
          return;
        }

        setBackendWarning(null);
      } catch (e: any) {
        setBackendWarning(e?.message || "Backend connectivity error.");
      }
    }

    checkBackend();
  }, [authContext.userId, authContext.tenantId]);

  useEffect(() => {
    async function initFromSession() {
      if (!authContext.userId || !authContext.tenantId) return;
      if (vibeInitDone) return;

      const raw = sessionStorage.getItem("vibeContext");
      if (!raw) {
        setVibeInitDone(true);
        return;
      }

      let ctx: VibeContext | null = null;
      try {
        ctx = JSON.parse(raw);
      } catch {
        ctx = null;
      }

      if (!ctx?.platformType || !ctx?.sourceId) {
        setVibeInitDone(true);
        return;
      }

      setVibeContext(ctx);

      const skillText = await loadSkillMD(ctx.skillMD);

      // Initialize agent (first assistant message)
      try {
        const resp = await fetch("/api/agent/master", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "initialize",
            tenantId: authContext.tenantId,
            userId: authContext.userId,
            context: { ...ctx, skillMD: skillText },
          }),
        });

        const data = await resp.json().catch(() => ({}));

        if (!resp.ok || data?.type === "error") {
          addLog("error", "Agent init failed", data?.message || "Failed to initialize agent.");
          setVibeInitDone(true);
          return;
        }

        // Expecting { message } or { text }
        const first = String(data?.message || data?.text || "").trim();
        if (first) {
          setMessages((prev) => [
            ...prev,
            { id: `a-init-${Date.now()}`, role: "assistant", content: first },
          ]);
        }

        setVibeInitDone(true);
      } catch (e: any) {
        addLog("error", "Agent init failed", e?.message || "Failed to initialize agent.");
        setVibeInitDone(true);
      }
    }

    initFromSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authContext.userId, authContext.tenantId]);

  const [logs, setLogs] = useState<TerminalLog[]>([
    {
      id: "l1",
      type: "info",
      text: "Welcome to Dashboard Editor",
      detail:
        "Start chatting to build or edit your client dashboards.\nTry:\n• \"Create a dashboard for ABC Dental\"\n• \"Add a call volume chart\"\n• \"Change the header color to blue\"",
    },
  ]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const logsEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  // Load sessions on mount
  useEffect(() => {
    if (authContext.userId && authContext.tenantId) {
      loadSessions();
    }
  }, [authContext.userId, authContext.tenantId]);

  async function loadSessions() {
    if (!authContext.userId || !authContext.tenantId) return;
    const res = await fetch(`/api/journey-sessions?tenantId=${authContext.tenantId}&userId=${authContext.userId}`);
    const json = await res.json();
    if (!res.ok || !json.ok) throw new Error(json?.error || "FAILED_TO_LOAD_SESSIONS");
    setSessions(json.sessions ?? []);
    const first = (json.sessions ?? [])[0];
    if (first && !activeSessionId) {
      await switchToSession(first);
    }
  }

  // Session switching
  async function switchToSession(s: any) {
    setActiveSessionId(String(s.id));
    setThreadId(String(s.thread_id));
    setView("terminal"); // requirement: always default terminal
    setToolUi(null);

    // restore journey fields
    if (s.mode) setJourneyMode(s.mode);
    if (typeof s.selected_outcome !== "undefined") setSelectedOutcome(s.selected_outcome);
    if (typeof s.selected_storyboard !== "undefined") setSelectedStoryboard(s.selected_storyboard);
    if (typeof s.selected_style_bundle_id !== "undefined") setSelectedStyleBundleId(s.selected_style_bundle_id);
    if (typeof s.density_preset !== "undefined") setDensityPreset(s.density_preset);
    if (typeof s.palette_override_id !== "undefined") setPaletteOverrideId(s.palette_override_id);
    if (s.preview_version_id) setPreviewVersionId(String(s.preview_version_id));

    // ensure vibeContext carries threadId so master router uses it
    setVibeContext((prev: any) => (prev ? { ...prev, threadId: String(s.thread_id) } : prev));

    await loadThreadMessages(String(s.thread_id));
  }

  async function loadThreadMessages(tid: string) {
    if (!authContext.tenantId) return;
    const res = await fetch(`/api/journey-messages?tenantId=${authContext.tenantId}&threadId=${encodeURIComponent(tid)}&limit=200`);
    const json = await res.json();
    if (!res.ok || !json.ok) throw new Error(json?.error || "FAILED_TO_LOAD_MESSAGES");
    const msgs = (json.messages ?? []).map((m: any) => ({
      id: String(m.id),
      role: m.role as Role,
      content: String(m.content),
      createdAt: m.created_at,
    }));
    setMessages(msgs);
  }

  // Create new session
  async function createNewSession(title: string, platformType: string, sourceId: string, entityId: string) {
    const newThreadId = crypto.randomUUID();
    try {
      const resp = await fetch("/api/journey-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: authContext.tenantId,
          userId: authContext.userId,
          platformType,
          sourceId,
          entityId,
          threadId: newThreadId,
          title,
        }),
      });
      const data = await resp.json();
      if (data.ok) {
        setSessions(prev => [data.session, ...prev]);
        await switchToSession(data.session);
        setNewConvOpen(false);
      }
    } catch (e) {
      console.error("Failed to create session", e);
    }
  }

  // CopilotKit tool UI integration
  useCopilotAction({
    name: "displayToolUI",
    parameters: [
      { name: "toolUi", type: "object", description: "Tool UI from vibe router" },
    ],
    handler: ({ toolUi }: { toolUi: object }) => {
      if (isToolUiPayload(toolUi)) {
        setToolUi(toolUi);
        setView(getRightTabForToolUi(toolUi));
      } else {
        setToolUi(null);
      }
    },
  });

  function addLog(type: LogType, text: string, detail?: string) {
    setLogs((prev) => [...prev, { id: crypto.randomUUID(), type, text, detail }]);
  }

  function backToWizard() {
    try {
      sessionStorage.removeItem("vibeContext");
    } catch {}
    router.push("/control-panel/chat");
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
          await refreshCurrentSpec();
        } else {
          addLog("error", "Preview generation failed", result.message);
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        addLog("error", "Preview generation failed", message);
      }
    },
  });

  const sendMessage = async (userText: string) => {
    const text = String(userText ?? "").trim();
    if (!text || isLoading) return;

    // Save user message to persistence
    await fetch("/api/journey-messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId: authContext.tenantId,
        threadId,
        role: "user",
        content: text,
      }),
    });

    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: "user", content: text },
    ]);

    setIsLoading(true);
    try {
      const res = await fetch("/api/vibe/router", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: authContext.userId,
          tenantId: authContext.tenantId,
          vibeContext: { ...vibeContext, threadId },
          journey: {
            mode: journeyMode,
            selectedOutcome,
            selectedStoryboard,
            selectedStyleBundleId,
            densityPreset,
            paletteOverrideId,
          },
          userMessage: text,
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data?.error || "ROUTER_REQUEST_FAILED");

      if (data?.journey?.mode) setJourneyMode(data.journey.mode);
      if (typeof data?.journey?.selectedOutcome !== "undefined")
        setSelectedOutcome(data.journey.selectedOutcome);
      if (typeof data?.journey?.selectedStoryboard !== "undefined")
        setSelectedStoryboard(data.journey.selectedStoryboard);
      if (typeof data?.journey?.selectedStyleBundleId !== "undefined")
        setSelectedStyleBundleId(data.journey.selectedStyleBundleId);
      if (typeof data?.journey?.densityPreset !== "undefined")
        setDensityPreset(data.journey.densityPreset);
      if (typeof data?.journey?.paletteOverrideId !== "undefined")
        setPaletteOverrideId(data.journey.paletteOverrideId);

      setToolUi(data?.toolUi ?? null);

      if (data?.interfaceId) {
        setVibeContext((prev: any) => (prev ? { ...prev, interfaceId: data.interfaceId } : prev));
      }
      if (data?.previewUrl) {
        setVibeContext((prev: any) => (prev ? { ...prev, previewUrl: data.previewUrl } : prev));
        setView("preview");
        if (data?.previewVersionId) {
          setPreviewVersionId(data.previewVersionId);
          setVibeContext((prev: any) => (prev ? { ...prev, previewVersionId: data.previewVersionId } : prev));
        }
        await refreshCurrentSpec();
      }

      // Save assistant response to persistence
      if (data.text) {
        await fetch("/api/journey-messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenantId: authContext.tenantId,
            threadId,
            role: "assistant",
            content: data.text,
          }),
        });
      }

      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: "assistant", content: data.text || "" },
      ]);
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

  const sendFromInput = async () => {
    const userText = input.trim();
    if (!userText || isLoading) return;
    setInput("");
    await sendMessage(userText);
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
    <CopilotKit runtimeUrl="/api/copilotkit" agent="vibe">
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
          {/* LEFT: chat column */}
          <div className="flex w-[35%] min-w-[360px] flex-col border-r border-gray-300 bg-[#f9fafb] overflow-hidden">
            {backendWarning ? (
              <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {backendWarning}
              </div>
            ) : null}

            {/* Custom message list - replacing CopilotChat */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-4 py-6">
              {messages.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <TerminalIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Ready to build your workflow? Describe what you need.</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`mb-4 rounded-lg ${
                      msg.role === "user"
                      ? "bg-blue-50 border-l-4 border-blue-200 pl-4 py-2 flex justify-between items-center"
                      : "bg-gray-50 border-l-4 border-gray-200 pl-4 py-2"
                  }`}
                >
                  <div className="flex-1">
                    <div className="text-xs font-medium text-gray-600 mb-1">{msg.role}</div>
                    <div className="text-sm text-gray-800 whitespace-pre-wrap">{msg.content}</div>

                    {msg.role === "assistant" &&
                      msg.content.includes(
                        "What would you like to build—an analytics dashboard, a tool, or a form?"
                      ) && (
                        <div className="mt-4 grid grid-cols-3 gap-3">
                          <div
                            role="button"
                            tabIndex={0}
                            className="relative group cursor-pointer rounded-lg border border-gray-400/60 bg-gray-800/80 p-3 text-center transition-all hover:bg-[#3366cc] hover:border-[#3366cc]/50 focus:outline-none focus:ring-2 focus:ring-[#3366cc]/50"
                            onClick={async () => {
                              addLog("info", `User selected Dashboard outcome.`);
                              setSelectedOutcome("dashboard");
                              await sendMessage("__ACTION__:select_outcome:dashboard");
                            }}
                          >
                            <div className="mx-auto mb-3 size-16 flex items-center justify-center rounded-md bg-[#3366cc] text-white text shadow-sm group-hover:bg-white/10">
                              <LayoutDashboard size={28} />
                            </div>
                            <div className="text-xs font-semibold text-white">Dashboard</div>
                            <div className="text-xs text-gray-400">Analytics, grids, charts, reports</div>
                          </div>

                          <div
                            role="button"
                            tabIndex={0}
                            className="relative group cursor-pointer rounded-lg border border-gray-400/60 bg-gray-800/80 p-3 text-center transition-all hover:bg-[#3366cc] hover:border-[#3366cc]/50 focus:outline-none focus:ring-2 focus:ring-[#3366cc]/50"
                            onClick={async () => {
                              addLog("info", `User selected Tool outcome.`);
                              setSelectedOutcome("tool");
                              await sendMessage("__ACTION__:select_outcome:tool");
                            }}
                          >
                            <div className="mx-auto mb-3 size-16 flex items-center justify-center rounded-md bg-[#3366cc] text-white text shadow-sm group-hover:bg-white/10">
                              <Zap size={28} />
                            </div>
                            <div className="text-xs font-semibold text-white">Tool</div>
                            <div className="text-xs text-gray-400">Utils, processors, RPC, integrations</div>
                          </div>

                          <div
                            role="button"
                            tabIndex={0}
                            className="relative group cursor-pointer rounded-lg border border-gray-400/60 bg-gray-800/80 p-3 text-center transition-all hover:bg-[#3366cc] hover:border-[#3366cc]/50 focus:outline-none focus:ring-2 focus:ring-[#3366cc]/50"
                            onClick={async () => {
                              addLog("info", `User selected Form outcome.`);
                              setSelectedOutcome("form");
                              await sendMessage("__ACTION__:select_outcome:form");
                            }}
                          >
                            <div className="mx-auto mb-3 size-16 flex items-center justify-center rounded-md bg-[#3366cc] text-white text shadow-sm group-hover:bg-white/10">
                              <FileText size={28} />
                            </div>
                            <div className="text-xs font-semibold text-white">Form</div>
                            <div className="text-xs text-gray-400">Steps, schema, validation, submissions</div>
                          </div>
                        </div>
                      )}
                    </div>

                    {(msg.role === "assistant" || msg.role === "user") && (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(msg.content);
                        }}
                        className="ml-2 p-1 rounded hover:bg-gray-200"
                        title="Copy message"
                      >
                        <CopyButton text={msg.content} />
                      </button>
                    )}
                  </div>
                ))
              )}

            {isLoading && (
              <div className="mb-4 rounded-lg bg-gray-50 border-l-4 border-gray-200 pl-4 py-2">
                <div className="text-xs font-medium text-gray-600 mb-1">assistant</div>
                <div className="text-sm text-gray-400 animate-pulse">Thinking…</div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <MessageInput
            value={input}
            onChange={setInput}
            disabled={isLoading}
            isListening={isListening}
              onToggleVoice={() => {
                setChatMode((m) => (m === "chat" ? "voice" : "chat"));
                setIsListening((v) => !v);
                addLog("info", "Voice toggled (wiring next).");
              }}
              onAttachFiles={(files) => {
                addLog("info", `Attached ${files.length} file(s). (Upload wiring next.)`);
              }}
              onSend={() => {
                void sendFromInput();
              }}
            />
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
        </div>

          {/* Terminal View */}
          {view === "terminal" ? (
            <div className="flex flex-1 flex-col bg-[#1e1e1e] min-h-0 overflow-hidden">

              {toolUi && (toolUi.type === "style_bundles" || toolUi.type === "todos") ? (
                <div className="mb-3 rounded-xl border border-gray-700 bg-gray-900 p-3 text-gray-100">
                  {toolUi.type === "style_bundles" ? (
                    <StyleBundleCards
                      title={toolUi.title}
                      bundles={toolUi.bundles}
                      onSelect={async (bundleId) => {
                        setSelectedStyleBundleId(bundleId);
                        setToolUi(null);
                        await sendMessage(buildCtxEnvelope("__ACTION__:select_style_bundle:" + bundleId));
                      }}
                    />
                  ) : (
                    <TodoPanel title={toolUi.title} items={toolUi.items} />
                  )}
                </div>
              ) : null}
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
            <div className="relative flex h-full min-h-0 w-full">
              <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
                {toolUi && toolUi.type === "interactive_edit_panel" ? (
                  <div className="mb-3 rounded-xl border border-gray-200 bg-white p-3">
                    <InteractiveEditPanel
                      title={toolUi.title}
                      interfaceId={toolUi.interfaceId}
                      widgets={toolUi.widgets}
                      palettes={toolUi.palettes}
                      density={toolUi.density}
                      onApply={async (payload) => {
                        await sendMessage(buildCtxEnvelope("__ACTION__:interactive_edit:" + JSON.stringify(payload)));
                        setToolUi(null);
                      }}
                    />
                  </div>
                ) : null}
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
                    {vibeContext?.previewUrl ? (
                      <iframe
                        key={previewRefreshKey}
                        src={vibeContext.previewUrl}
                        className="h-full w-full rounded-xl border border-gray-200 bg-white"
                        sandbox="allow-scripts allow-same-origin"
                        title="Dashboard Preview"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center rounded-xl border border-gray-200 bg-white text-sm text-gray-500">
                        No preview yet. Continue the chat to generate a preview.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Inspector column */}
              <div className="w-[360px] flex-shrink-0 border-l border-gray-200 bg-[#f9fafb] p-3">
                <PreviewInspector
                  components={(currentSpec?.components ?? []) as any[]}
                  selectedId={selectedComponentId}
                  onSelect={(id) => {
                    setSelectedComponentId(id);
                    setPropertiesOpen(true);
                  }}
                />
              </div>

              {/* Properties Drawer */}
              <WidgetPropertiesDrawer
                open={propertiesOpen}
                onClose={() => setPropertiesOpen(false)}
                component={
                  selectedComponentId
                    ? ((currentSpec?.components ?? []).find((c: any) => c?.id === selectedComponentId) ?? null)
                    : null
                }
                onApply={async (actions) => {
                  setIsLoading(true);
                  try {
                    const res = await fetch("/api/vibe/router", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        userId: authContext.userId,
                        tenantId: authContext.tenantId,
                        vibeContext: { ...vibeContext, threadId },
                        journey: {
                          mode: journeyMode,
                          selectedOutcome,
                          selectedStoryboard,
                          selectedStyleBundleId,
                          densityPreset,
                          paletteOverrideId,
                        },
                        userMessage: `__ACTION__:interactive_edit:${JSON.stringify({
                          interfaceId: vibeContext?.interfaceId,
                          actions,
                        })}`,
                      }),
                    });

                    const data = await res.json();
                    if (!res.ok) throw new Error(data?.error || "INTERACTIVE_EDIT_FAILED");

                    setMessages((prev) => [
                      ...prev,
                      { id: `a-${Date.now()}`, role: "assistant", content: data.text || "Updated." },
                    ]);

                    // Refresh spec so inspector + drawer reflect changes immediately
                    await refreshCurrentSpec();

                    // If you display previewUrl via iframe keying, bump refreshKey
                    setPreviewRefreshKey((k) => k + 1);
                  } finally {
                    setIsLoading(false);
                  }
                }}
              />
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

    {/* Conversations Drawer */}
    {sessionsOpen && (
      <div className="fixed inset-0 z-50 flex">
        <div
          className="fixed inset-0 bg-black/50"
          onClick={() => setSessionsOpen(false)}
        ></div>
        <div className="relative ml-4 mt-4 w-[380px] rounded-2xl bg-slate-900 p-4 text-white shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold">Conversations</div>
            <button
              type="button"
              onClick={() => setSessionsOpen(false)}
              className="rounded-md px-2 py-1 text-white/80 hover:bg-white/10"
            >
              ✕
            </button>
          </div>

          <div className="space-y-2">
            {sessions.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/70">
                No conversations yet.
              </div>
            ) : (
              sessions.map((s) => (
                <button
                  key={String(s.id)}
                  type="button"
                  onClick={() => {
                    setActiveSessionId(String(s.id));
                    setThreadId(String(s.thread_id));
                    setView("terminal");
                    setSessionsOpen(false);
                  }}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left hover:bg-white/10"
                >
                  <div className="text-sm font-medium">
                    {String(s.title ?? s.platform_type ?? "Untitled")}
                  </div>
                  <div className="text-xs text-white/60">
                    {String(s.updated_at ?? s.created_at ?? "")}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    )}

    {/* New Conversation Modal */}
    {newConvOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setNewConvOpen(false)} />
        <div className="relative bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">New Conversation</h3>
            <button onClick={() => setNewConvOpen(false)} className="p-1 rounded-md hover:bg-gray-100">
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createNewSession(newTitle, newPlatformType, newSourceId, newEntityId);
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="New Dashboard Build"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
              <select
                value={newPlatformType}
                onChange={(e) => setNewPlatformType(e.target.value as any)}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="retell">Retell</option>
                <option value="make">Make</option>
                <option value="n8n">n8n</option>
                <option value="vapi">Vapi</option>
                <option value="activepieces">Activepieces</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Source ID</label>
              <input
                type="text"
                value={newSourceId}
                onChange={(e) => setNewSourceId(e.target.value)}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="demo-source"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Entity ID</label>
              <input
                type="text"
                value={newEntityId}
                onChange={(e) => setNewEntityId(e.target.value)}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="demo-entity"
              />
            </div>
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setNewConvOpen(false)}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
      </div>
    </CopilotKit>
  );
}
