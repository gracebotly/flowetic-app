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
  PanelLeft,
  Plus,
  MessagesSquare,
  Sparkles,
  Share2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

import { createClient } from '@/lib/supabase/client';
import { useChat } from '@ai-sdk/react';

import { MessageInput } from "@/components/vibe/message-input";
import { PhaseIndicator } from "@/components/vibe/phase-indicator";
import { InlineChoice } from "@/components/vibe/inline-choice";
import { DesignSystemPair } from "@/components/vibe/design-system-pair";
import { PremiumInlineChoice } from "@/components/vibe/premium-inline-choice";
import { PremiumDesignSystemPair } from "@/components/vibe/premium-design-system-pair";
import { ModelSelector, type ModelId } from "./model-selector";
import { exportAsMarkdown, exportAsJSON } from "@/lib/export-chat";

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
      type: "outcome_cards";
      title?: string;
      options: Array<{
        id: string;
        title: string;
        description: string;
        previewImageUrl?: string;
        tags?: string[];
        metrics?: {
          primary: string[];
          secondary: string[];
        };
        category?: "dashboard" | "product" | "operations";
      }>;
    }
  | {
      type: "outcome_choices";
      choices: Array<{
        id: string;
        label: string;
        emoji?: string;
        description?: string;
      }>;
      helpAvailable?: boolean;
    }
  | {
      type: "style_bundles";
      title?: string;
      bundles: Array<{
        id: string;
        name: string;
        description: string;
        previewImageUrl?: string;
        palette?: { name: string; swatches: Array<{ name: string; hex: string }> };
        tags?: string[];
      }>;
    }
  | {
      type: "todos";
      title?: string;
      items: Array<{
        id: string;
        title: string;
        status: "pending" | "in_progress" | "completed";
        priority: "low" | "medium" | "high";
      }>;
    }
  | {
      type: "interactive_edit_panel";
      title?: string;
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
    }
  | {
      type: "storyboard_cards";
      title?: string;
      options: Array<{
        id: string;
        title: string;
        description: string;
        kpis: string[];
      }>;
    };

type DesignSystem = {
  id: string;
  name: string;
  emoji: string;
  colors: string;
  style: string;
  typography: string;
  bestFor: string;
  fullOutput?: string;
};

type Choice = {
  id: string;
  label: string;
  emoji?: string;
  description?: string;
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
  const [view, setView] = useState<ViewMode>("preview");
  const [showDebug, setShowDebug] = useState<boolean>(false);
  const [input, setInput] = useState("");  const [chatMode, setChatMode] = useState<"chat" | "voice">("chat");
  const [isListening, setIsListening] = useState(false);
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelId>("glm-4.7");
  
  const { messages: uiMessages, sendMessage: sendUiMessage, status: uiStatus, error: uiError } = useChat({});

  async function sendAi(text: string, extraData?: Record<string, any>) {
    // CRITICAL: Send COMPLETE vibeContext, not individual fields
    await sendUiMessage(
      { text },
      {
        body: {
          data: {
            tenantId: authContext.tenantId,
            userId: authContext.userId,
            journeyThreadId: threadId,
            selectedModel,
            // Send ALL vibeContext fields (this was the bug!)
            platformType: vibeContext?.platformType,
            sourceId: vibeContext?.sourceId,
            entityId: vibeContext?.entityId,
            externalId: vibeContext?.externalId,
            displayName: vibeContext?.displayName,
            entityKind: vibeContext?.entityKind,
            skillMD: vibeContext?.skillMD,
            // Journey state
            phase: journeyMode,
            selectedOutcome,
            selectedStoryboard,
            selectedStyleBundleId,
            densityPreset,
            paletteOverrideId,
            // Merge any additional data
            ...(extraData ?? {}),
          },
        },
      },
    );
  }

  /**
   * This function is no longer needed - we use InlineChoice and DesignSystemPair instead
   * Keep it as a stub for backward compatibility with any remaining references
   */
  function renderToolUi(toolUi: any) {
    // All UI rendering now happens via message.choices and message.designSystemPair
    // This stub prevents build errors from any remaining references
    return null;
  }

  function renderToolPart(part: any) {
    const type: string = part?.type || '';
    const state: string = part?.state || '';

    if (!type.startsWith('tool-')) return null;

    // Show loading state
    if (state === 'streaming' || state === 'pending') {
      return (
        <div className="mt-2 flex items-center gap-2 text-xs text-white/60">
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white/60"></div>
          <span>Running {type.replace('tool-', '')}...</span>
        </div>
      );
    }

    if (state !== 'output-available') return null;

    const output = part.output;

    // ERROR HANDLING: Check if output is an error
    if (output?.error || output?.code?.includes('ERROR')) {
      return (
        <div className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-red-200 mb-1">
            <span className="text-red-400">⚠</span>
            Tool Error: {type.replace('tool-', '')}
          </div>
          <div className="text-xs text-red-300">{output.error || output.message || 'Unknown error'}</div>
        </div>
      );
    }

    // Only show raw tool output in debug mode
    if (!showDebug) {
      return null;
    }

    // Debug mode: show raw JSON
    return (
      <div className="mt-2 rounded-lg border border-white/10 bg-black/20 p-3">
        <div className="text-xs font-medium text-white/60 mb-2">
          [DEBUG] {type}
        </div>
        <pre className="text-xs text-white/40 font-mono overflow-auto max-h-96">
          {JSON.stringify(output, null, 2)}
        </pre>
      </div>
    );
  }
  
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  function getActionAcknowledgment(action: string): string {
    if (action.startsWith("__ACTION__:select_outcome:")) {
      const outcome = action.replace("__ACTION__:select_outcome:", "").trim();
      return outcome === "dashboard" 
        ? "You selected: Client ROI Dashboard" 
        : "You selected: Workflow Product";
    }
    
    if (action.startsWith("__ACTION__:select_storyboard:")) {
      const id = action.replace("__ACTION__:select_storyboard:", "").trim();
      const labels: Record<string, string> = {
        roi_proof: "ROI Proof",
        reliability_ops: "Reliability Ops",
        delivery_sla: "Delivery / SLA",
      };
      return `You selected: ${labels[id] || id}`;
    }
    
    if (action.startsWith("__ACTION__:select_style_bundle:")) {
      return "You selected a style bundle";
    }
    
    if (action === "__ACTION__:outcome_help_me_decide") {
      return "I'm not sure, help me decide";
    }
    
    return "Action received";
  }

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




  function buildCopilotEnvelope(userText: string) {
    const safeVibeContext = {
      ...(vibeContext ?? {}),
      threadId,
    };

    const payload = {
      userId: authContext.userId,
      tenantId: authContext.tenantId,
      threadId,
      selectedModel,
      vibeContext: safeVibeContext,
      journey: {
        mode: journeyMode,
        threadId,
        selectedOutcome,
        selectedStoryboard,
        selectedStyleBundleId,
        densityPreset,
        paletteOverrideId,
      },
    };

    return `__FLOWETIC_CTX__:${JSON.stringify(payload)}\n${userText}`;
  }

  function stripFloweticEnvelopeForDisplay(content: string): string {
    if (!content.startsWith("__FLOWETIC_CTX__:")) return content;
    const idx = content.indexOf("\n");
    if (idx === -1) return content;
    return content.slice(idx + 1);
  }

  const [toolUi, setToolUi] = useState<ToolUiPayload | null>(null);
  const [currentSpec, setCurrentSpec] = useState<any | null>(null);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [propertiesOpen, setPropertiesOpen] = useState(false);

  

async function loadSkillMD(platformType: string, sourceId: string, entityId?: string) {
  if (!authContext.tenantId || !platformType || !sourceId) {
    return "";
  }

  try {
    const supabase = createClient();

    const externalId = String(entityId || "").trim();
    if (!externalId) return "";

    const { data, error } = await supabase
      .from("source_entities")
      .select("skill_md")
      .eq("tenant_id", authContext.tenantId)
      .eq("source_id", sourceId)
      .eq("external_id", externalId)
      .maybeSingle();

    if (error) {
      console.error("[vibe] Error loading skillMD:", error);
      return "";
    }

    return (data?.skill_md as string) || "";
  } catch (e) {
    console.error("[vibe] Failed to load skillMD:", e);
    return "";
  }
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

      // Load skillMD before setting context
      const skillMD = await loadSkillMD(ctx.platformType, ctx.sourceId, ctx.entityId);
      const enrichedCtx = { ...ctx, skillMD };
      setVibeContext(enrichedCtx);

      try {
        // Kick off Phase 1 through AI SDK
        await sendAi("System: start Phase 1 outcome selection.", {
          userId: authContext.userId,
          tenantId: authContext.tenantId,
          threadId,
          selectedModel,
          vibeContext: enrichedCtx,
          journey: {
            mode: journeyMode,
            threadId,
            selectedOutcome,
            selectedStoryboard,
            selectedStyleBundleId,
            densityPreset,
            paletteOverrideId,
          },
        });
      } catch (e: any) {
        addLog("error", "Failed to start Phase 1", e?.message || "AI_SDK_INIT_FAILED");
      }

      setVibeInitDone(true);
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

    // Load skillMD for this session
    const skillMD = await loadSkillMD(s.platform_type, s.source_id, s.entity_id);

    // Update vibeContext with skillMD
    setVibeContext((prev: any) => ({
      ...prev,
      platformType: s.platform_type,
      sourceId: s.source_id,
      entityId: s.entity_id,
      skillMD,
      threadId: String(s.thread_id)
    }));

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
    
    // Load skillMD for the new session
    const skillMD = await loadSkillMD(platformType, sourceId, entityId);
    
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

  function addLog(type: LogType, text: string, detail?: string) {
    setLogs((prev) => [...prev, { id: crypto.randomUUID(), type, text, detail }]);
  }

  function backToWizard() {
    try {
      sessionStorage.removeItem("vibeContext");
    } catch {}
    router.push("/control-panel/chat");
  }

  function isInternalActionMessage(text: string): boolean {
    return text.startsWith("__ACTION__:");
  }

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (uiStatus === 'streaming') return;

    // Persist user message (keep existing behavior)
    try {
      await fetch("/api/journey-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: authContext.tenantId,
          threadId,
          role: "user",
          content: trimmed,
        }),
      });
    } catch {
      // non-fatal
    }

    // Keep your local UI list in sync (as your current UI renders from `messages`)
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: "user", content: trimmed },
    ]);

    if (trimmed.startsWith("__ACTION__:select_style_bundle:")) {
      addLog("running", "Generating preview…", "This can take ~10–30 seconds on first run.");
    }

    // ✅ SINGLE ENDPOINT: All phases use /api/chat with streaming
    try {
      await sendAi(trimmed, {
        userId: authContext.userId,
        tenantId: authContext.tenantId,
        journeyThreadId: threadId,
        threadId,
        selectedModel,
        vibeContext: vibeContext ? { ...vibeContext, threadId } : undefined,
        journey: {
          mode: journeyMode,
          threadId,
          selectedOutcome,
          selectedStoryboard,
          selectedStyleBundleId,
          densityPreset,
          paletteOverrideId,
        },
      });
    } catch (e: any) {
      addLog("error", "Chat request failed", e?.message ?? "Unknown error");
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: "assistant", content: "Request failed." },
      ]);
    }
  };

  const sendFromInput = async () => {
    const userText = input.trim();
    if (!userText || uiStatus === 'streaming') return;
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
    <div className="flex h-screen w-full overflow-hidden bg-[#0b1220]">
      {/* Left mini-rail */}
      <div className="absolute left-4 top-4 z-[60] flex flex-col gap-2">
        <Link
          href="/control-panel/chat"
          title="Back to Control Panel"
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/15"
        >
          <PanelLeft size={18} />
        </Link>

        <button
          type="button"
          title="New conversation"
          onClick={() => setNewConvOpen(true)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/15"
        >
          <Plus size={18} />
        </button>

        <button
          type="button"
          title="Conversations"
          onClick={() => setSessionsOpen(true)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/15"
        >
          <MessagesSquare size={18} />
        </button>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 min-h-0 pl-20">
        {/* Chat sidebar */}
        <div className={`flex flex-col border-r border-gray-700 bg-white overflow-hidden transition-all duration-300 ${
          isChatExpanded ? 'w-[720px]' : 'w-[480px]'
        }`}>
          {backendWarning && (
            <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {backendWarning}
            </div>
          )}

          {/* Phase Progress Indicator */}
          <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between">
            <PhaseIndicator currentMode={journeyMode} />
            
            {/* Expand button - show only in Phase 1 & 2 */}
            {(journeyMode === "recommend" || journeyMode === "align") && (
              <button
                type="button"
                onClick={() => setIsChatExpanded(!isChatExpanded)}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                title={isChatExpanded ? "Collapse view" : "Expand for more space"}
              >
                {isChatExpanded ? (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                    </svg>
                    <span>Collapse</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                    </svg>
                    <span>Expand</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Chat messages */}
          <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-4 py-6">
            {messages.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="flex items-start gap-4 p-6 rounded-xl bg-gradient-to-r from-indigo-500/5 to-purple-500/5 border border-indigo-500/20"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/50 flex-shrink-0">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">Dashboard Assistant</h3>
                  <p className="text-sm text-gray-600">
                    Start chatting to build or edit your client dashboards.
                  </p>
                </div>
              </motion.div>
            ) : (
              <>
                <div className="space-y-3">
                  {uiMessages.map((m) => {
                    const isUser = m.role === 'user';
                    // Check if message has toolUi, choices, or designSystemPair
                    const messageToolUi = (m as any)?.experimental_data?.toolUi || (m as any)?.data?.toolUi || (m as any)?.toolUi;
                    const messageChoices = (m as any)?.experimental_data?.choices || (m as any)?.data?.choices || (m as any)?.choices;
                    const messageDesignSystemPair = (m as any)?.experimental_data?.designSystemPair || (m as any)?.data?.designSystemPair || (m as any)?.designSystemPair;
                    const helpAvailable = (m as any)?.experimental_data?.helpAvailable || (m as any)?.data?.helpAvailable || (m as any)?.helpAvailable;
                    const hasMore = (m as any)?.experimental_data?.hasMore || (m as any)?.data?.hasMore || (m as any)?.hasMore;

                    return (
                      <div key={m.id} className={isUser ? 'text-right' : 'text-left'}>
                        <div className="inline-block max-w-[90%] rounded-xl px-3 py-2 bg-white/10 text-white">
                          {m.parts.map((part, idx) => {
                            if (part.type === 'text') {
                              return (
                                <div key={idx} className="whitespace-pre-wrap">
                                  {part.text}
                                </div>
                              );
                            }

                            // Hide tool-call and tool-result parts from user view
                            if (part.type === 'tool-call' || part.type === 'tool-result') {
                              return null;
                            }

                            if (part.type.startsWith('tool-')) {
                              return <div key={idx}>{renderToolPart(part)}</div>;
                            }

                            // Check for toolUi in data parts (disabled - now using InlineChoice/DesignSystemPair)
                            // if (part.type === 'data-toolUi' || part.type === 'data-tool-ui') {
                            //   const partToolUi = (part as any)?.data?.toolUi || (part as any)?.toolUi;
                            //   if (partToolUi) {
                            //     return <div key={idx}>{renderToolUi(partToolUi)}</div>;
                            //   }
                            // }

                            if (part.type.startsWith('data-')) {
                              const partData = (part as any).data || (part as any);

                              // Render outcome choices with premium UI
                              if (part.type === 'data-outcome-choices' || part.type.includes('outcome-choices')) {
                                const choices = partData.choices || [];
                                const helpAvailable = partData.helpAvailable;

                                if (choices.length > 0) {
                                  return (
                                    <div key={idx}>
                                      <PremiumInlineChoice
                                        choices={choices}
                                        onSelect={async (id: string) => {
                                          setSelectedOutcome(id as any);
                                          setJourneyMode("align");
                                          await sendAi(`I selected ${id}`);
                                        }}
                                        helpAvailable={helpAvailable}
                                        onHelp={
                                          helpAvailable
                                            ? async () => {
                                                await sendAi("Help me decide");
                                              }
                                            : undefined
                                        }
                                      />
                                    </div>
                                  );
                                }
                              }

                              // Render design system pairs with premium UI
                              if (part.type === 'data-design-system-pair' || part.type.includes('design-system-pair')) {
                                const systems = partData.systems || [];
                                const hasMore = partData.hasMore;

                                if (systems.length === 2) {
                                  return (
                                    <div key={idx}>
                                      <PremiumDesignSystemPair
                                        systems={systems as [any, any]}
                                        onSelect={async (id: string) => {
                                          setSelectedStyleBundleId(id);
                                          await sendAi(`I selected style ${id}`);
                                        }}
                                        onShowMore={
                                          hasMore
                                            ? async () => {
                                                await sendAi("Show different styles");
                                              }
                                            : undefined
                                        }
                                        hasMore={hasMore}
                                      />
                                    </div>
                                  );
                                }
                              }

                              // Hide other data parts by default
                              if (!showDebug) return null;

                              return (
                                <div key={idx} className="mt-2 rounded-lg border border-white/10 bg-black/20 p-2 text-xs text-white/80">
                                  <div className="text-white/60">[DEBUG] {part.type}</div>
                                  <pre className="overflow-auto whitespace-pre-wrap">
                                    {JSON.stringify(partData, null, 2)}
                                  </pre>
                                </div>
                              );
                            }

                            return null;
                          })}

                          {/* Render inline choices with premium UI */}
                          {messageChoices && messageChoices.length > 0 && (
                            <PremiumInlineChoice
                              choices={messageChoices}
                              onSelect={async (id: string) => {
                                setSelectedOutcome(id as any);
                                setJourneyMode("align");
                                await sendAi(`I selected ${id}`);
                              }}
                              helpAvailable={helpAvailable}
                              onHelp={
                                helpAvailable
                                  ? async () => {
                                      await sendAi("Help me decide");
                                    }
                                  : undefined
                              }
                            />
                          )}

                          {/* Render design system pairs with premium UI */}
                          {messageDesignSystemPair && messageDesignSystemPair.length === 2 && (
                            <PremiumDesignSystemPair
                              systems={messageDesignSystemPair as [any, any]}
                              onSelect={async (id: string) => {
                                setSelectedStyleBundleId(id);
                                await sendAi(`I selected style ${id}`);
                              }}
                              onShowMore={
                                hasMore
                                  ? async () => {
                                      await sendAi("Show different styles");
                                    }
                                  : undefined
                              }
                              hasMore={hasMore}
                            />
                          )}

                          {/* Render toolUi if present on message level (disabled - now using InlineChoice/DesignSystemPair) */}
                          {/* {messageToolUi && renderToolUi(messageToolUi)} */}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Render toolUi from phase router */}
                {toolUi && (
                  <div className="mt-3">
                    {toolUi.type === "outcome_choices" && toolUi.choices && (
                      <PremiumInlineChoice
                        choices={toolUi.choices}
                        onSelect={async (id: string) => {
                          setSelectedOutcome(id as any);
                          setToolUi(null);
                          setJourneyMode("align");
                          await sendMessage(`I selected ${id}`);
                        }}
                        helpAvailable={toolUi.helpAvailable}
                        onHelp={
                          toolUi.helpAvailable
                            ? async () => {
                                setToolUi(null);
                                await sendMessage("Help me decide");
                              }
                            : undefined
                        }
                      />
                    )}

                    {toolUi.type === "storyboard_cards" && toolUi.options && (
                      <div className="grid gap-3">
                        {toolUi.options.map((option: any) => (
                          <button
                            key={option.id}
                            onClick={async () => {
                              setSelectedStoryboard(option.id);
                              setToolUi(null);
                              await sendMessage(`__ACTION__:select_storyboard:${option.id}`);
                            }}
                            className="text-left rounded-lg border border-gray-200 p-4 hover:border-blue-500 hover:bg-blue-50 transition-all"
                          >
                            <div className="font-medium text-gray-900 mb-1">{option.title}</div>
                            <div className="text-sm text-gray-600 mb-2">{option.description}</div>
                            {option.kpis && option.kpis.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {option.kpis.map((kpi: string, idx: number) => (
                                  <span key={idx} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                                    {kpi}
                                  </span>
                                ))}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}

                    {toolUi.type === "style_bundles" && toolUi.bundles && (
                      <div className="grid gap-3">
                        {toolUi.bundles.map((bundle: any) => (
                          <button
                            key={bundle.id}
                            onClick={async () => {
                              setSelectedStyleBundleId(bundle.id);
                              setToolUi(null);
                              await sendMessage(`__ACTION__:select_style_bundle:${bundle.id}`);
                            }}
                            className="text-left rounded-lg border border-gray-200 p-4 hover:border-blue-500 hover:bg-blue-50 transition-all"
                          >
                            <div className="font-medium text-gray-900 mb-1">{bundle.name}</div>
                            <div className="text-sm text-gray-600 mb-2">{bundle.description}</div>
                            {bundle.palette && (
                              <div className="flex gap-1 mt-2">
                                {bundle.palette.swatches?.slice(0, 5).map((swatch: any, idx: number) => (
                                  <div
                                    key={idx}
                                    className="w-6 h-6 rounded border border-gray-300"
                                    style={{ backgroundColor: swatch.hex }}
                                    title={swatch.name}
                                  />
                                ))}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {uiError ? (
                  <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                    {String((uiError as any)?.message || uiError)}
                  </div>
                ) : null}

                {uiStatus === 'streaming' ? (
                  <div className="mt-2 text-xs text-white/60">Thinking…</div>
                ) : null}
              </>
            )}

            <div ref={messagesEndRef} />

            {process.env.NEXT_PUBLIC_DEBUG_CHAT === 'true' ? (
              <div className="mt-3 rounded-lg border border-white/10 bg-black/40 p-3 text-xs text-white/80">
                <div className="mb-2 text-white/60">DEBUG: last message parts</div>
                <pre className="overflow-auto whitespace-pre-wrap">
                  {JSON.stringify(uiMessages?.[uiMessages.length - 1]?.parts ?? [], null, 2)}
                </pre>
              </div>
            ) : null}
          </div>

          {/* Message input */}
          <div className="border-t border-gray-200 p-4">
            <MessageInput
              value={input}
              onChange={setInput}
              disabled={uiStatus === 'streaming'}
              isListening={isListening}
              selectedModel={selectedModel}
              onModelSelect={setSelectedModel}
              onToggleVoice={() => {
                setChatMode((m) => (m === "chat" ? "voice" : "chat"));
                setIsListening((v) => !v);
              }}
              onAttachFiles={(files) => {
                console.log("Files attached:", files.length);
              }}
              onSend={sendFromInput}
            />
          </div>
        </div>

        {/* Right: Preview area */}
        <div className="flex flex-1 flex-col min-w-0 bg-white">
          <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">
              {view === "preview" ? "Dashboard Preview" : view === "publish" ? "Deploy Dashboard" : "Current Changes"}
            </h2>
            
            <div className="flex items-center gap-2">
              {/* Share Button */}
              <button
                type="button"
                onClick={() => setShowShareModal(true)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 transition-colors"
                title="Export conversation"
              >
                <Share2 size={18} />
              </button>

              <div className="inline-flex items-center gap-1 rounded-lg bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => setView("terminal")}
                className={
                  view === "terminal"
                    ? "inline-flex h-9 w-9 items-center justify-center rounded-md bg-indigo-500 text-white"
                    : "inline-flex h-9 w-9 items-center justify-center rounded-md text-gray-600 hover:bg-white"
                }
              >
                <TerminalIcon size={18} />
              </button>
              
              <button
                type="button"
                onClick={() => setView("preview")}
                className={
                  view === "preview"
                    ? "inline-flex h-9 w-9 items-center justify-center rounded-md bg-indigo-500 text-white"
                    : "inline-flex h-9 w-9 items-center justify-center rounded-md text-gray-600 hover:bg-white"
                }
              >
                <Eye size={18} />
              </button>

              <button
                type="button"
                title="Deploy"
                onClick={() => setView("publish")}
                className={
                  view === "publish"
                    ? "inline-flex h-9 w-9 items-center justify-center rounded-md bg-indigo-500 text-white"
                    : "inline-flex h-9 w-9 items-center justify-center rounded-md text-gray-600 hover:bg-white"
                }
              >
                <Rocket size={18} />
              </button>
            </div>
          </div>
        </div>

          {view === "terminal" ? (
            <div className="flex flex-1 items-center justify-center bg-gray-50">
              <div className="text-center">
                <TerminalIcon className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p className="text-sm text-gray-500">
                  Terminal view removed - all interactions now in chat sidebar
                </p>
              </div>
            </div>
          ) : null}

          {/* Right Panel - Preview Area */}
          <div className="flex-1 bg-gray-50 relative">
            {vibeContext?.previewUrl ? (
              <div className="h-full">
                <iframe
                  src={vibeContext.previewUrl}
                  className="w-full h-full border-0"
                  title="Dashboard Preview"
                  sandbox="allow-scripts allow-same-origin"
                />
              </div>
            ) : journeyMode === "build_preview" ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Generating your preview...</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                <p>Preview will appear here after Phase 3</p>
              </div>
            )}
          </div>

          {view === "publish" && (
            <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50">
              <div className="text-center max-w-md px-6">
                <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white mb-6 shadow-lg shadow-indigo-500/50">
                  <Rocket size={40} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Ready to Deploy
                </h3>
                <p className="text-sm text-gray-600 mb-6">
                  Your dashboard is ready to go live. Click deploy to make it accessible to your clients.
                </p>
                <button
                  onClick={async () => {
                    // TODO: Implement actual deploy logic
                    alert("Deploy functionality coming soon!");
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-3 text-sm font-semibold text-white hover:from-indigo-600 hover:to-purple-700 shadow-lg shadow-indigo-500/50 transition-all duration-300"
                >
                  <Rocket size={18} />
                  Deploy Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Conversations Drawer */}
      {sessionsOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSessionsOpen(false)}></div>
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
                      void switchToSession(s);
                      setSessionsOpen(false);
                    }}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left hover:bg-white/10"
                  >
                    <div className="text-sm font-medium">{String(s.title ?? s.platform_type ?? "Untitled")}</div>
                    <div className="text-xs text-white/60">{String(s.updated_at ?? s.created_at ?? "")}</div>
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
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setNewConvOpen(false)}></div>
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
                void createNewSession(newTitle, newPlatformType, newSourceId, newEntityId);
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
                <button type="submit" className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
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
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black bg-opacity-50"
            onClick={() => setShowShareModal(false)}
          />
          <div className="relative bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Export Conversation</h3>
              <button
                onClick={() => setShowShareModal(false)}
                className="p-1 rounded-md hover:bg-gray-100"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-6">
              Choose your export format
            </p>

            <div className="space-y-3">
              {/* Markdown Export */}
              <button
                onClick={() => {
                  exportAsMarkdown(uiMessages as any);
                  setShowShareModal(false);
                }}
                className="w-full flex items-start gap-4 p-4 rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all group"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center group-hover:bg-blue-500 transition-colors">
                  <FileText className="w-5 h-5 text-blue-600 group-hover:text-white" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium text-gray-900 mb-1">Text (Markdown)</div>
                  <div className="text-sm text-gray-600">
                    Download conversation as markdown
                  </div>
                </div>
              </button>

              {/* JSON Export */}
              <button
                onClick={() => {
                  exportAsJSON(uiMessages as any);
                  setShowShareModal(false);
                }}
                className="w-full flex items-start gap-4 p-4 rounded-lg border-2 border-gray-200 hover:border-purple-500 hover:bg-purple-50 transition-all group"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center group-hover:bg-purple-500 transition-colors">
                  <FileText className="w-5 h-5 text-purple-600 group-hover:text-white" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium text-gray-900 mb-1">JSON</div>
                  <div className="text-sm text-gray-600">
                    Download as JSON for fine-tuning or debugging
                  </div>
                </div>
              </button>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => setShowShareModal(false)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Debug Toggle - Always Visible */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowDebug(!showDebug)}
        className={cn(
          "fixed bottom-6 right-6 z-50 p-3 rounded-full backdrop-blur-sm border transition-all shadow-xl",
          showDebug
            ? "bg-blue-600/90 border-blue-500 text-white"
            : "bg-gray-900/80 border-gray-700/50 text-gray-400 hover:text-white hover:border-gray-600"
        )}
        title={showDebug ? "Hide debug info" : "Show debug info"}
      >
        <TerminalIcon className="h-5 w-5" />
      </motion.button>

      {/* Debug Panel */}
      {showDebug && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-24 right-6 w-96 max-h-96 overflow-auto rounded-xl bg-black/95 backdrop-blur-sm border border-gray-800 p-4 shadow-2xl z-40"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-gray-400">Debug Info</span>
            <button onClick={() => setShowDebug(false)} className="text-gray-500 hover:text-gray-300">
              <X className="h-4 w-4" />
            </button>
          </div>
          <pre className="text-xs text-green-400 font-mono overflow-auto">
            {JSON.stringify({ phase: journeyMode, vibeContext, status: uiStatus }, null, 2)}
          </pre>
        </motion.div>
      )}
    </div>
  );
}