"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CopyButton } from "@/components/chat/copy-button";
import {
  Eye,
  Pencil,
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
import { DefaultChatTransport } from 'ai';

import { MessageInput } from "@/components/vibe/message-input";
import { PhaseIndicator } from "@/components/vibe/phase-indicator";
import { InlineChoice } from "@/components/vibe/inline-choice";
import { DesignSystemPair } from "@/components/vibe/design-system-pair";
import { DesignSystemCard } from './DesignSystemCard';
import { ProposalGallery } from './ProposalGallery';
import { ReasoningBlock } from "@/components/vibe/ReasoningBlock";
import { ErrorDisplay } from "@/components/vibe/ErrorDisplay";
import { ModelSelector, type ModelId } from "./model-selector";
import { exportAsMarkdown, exportAsJSON } from "@/lib/export-chat";
import {
  InteractiveEditPanel,
  DevicePreviewToolbar,
  type DeviceMode,
  type WidgetConfig,
  type Palette,
  type Density,
} from "@/components/vibe/editor";
import { ResponsiveDashboardRenderer } from "@/components/preview/ResponsiveDashboardRenderer";
import { EmptyPreviewState } from './EmptyPreviewState';
import { useEditActions } from "@/hooks/useEditActions";

type ViewMode = "preview" | "edit";

type JourneyMode =
  | "propose"
  | "build_edit"
  | "deploy";

// Legacy phase mapping for old sessions loaded from DB
const LEGACY_JOURNEY_MAP: Record<string, JourneyMode> = {
  select_entity: "propose",
  recommend: "propose",
  style: "propose",
  align: "propose",
  build_preview: "build_edit",
  interactive_edit: "build_edit",
};

function normalizeJourneyMode(mode: string): JourneyMode {
  return (LEGACY_JOURNEY_MAP[mode] ?? mode) as JourneyMode;
}

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
    };

type DesignSystem = {
  id: string;
  name: string;
  icon: string; // Lucide icon name (e.g., "Palette", "Sparkles")
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
  const [selectedModel, setSelectedModel] = useState<ModelId>("gemini-3-pro-preview");

  // Proposal state (2-phase journey)
  const [proposals, setProposals] = useState<import('@/types/proposal').ProposalsPayload | null>(null);
  const [isProposalLoading, setIsProposalLoading] = useState(false);
  const [selectedProposalIndex, setSelectedProposalIndex] = useState<number | null>(null);


  // Guard against concurrent init + user sends
  const initSendInFlight = useRef(false);

  const { messages: uiMessages, sendMessage: sendUiMessage, status: uiStatus, error: uiError } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: () => ({
        tenantId: authContextRef.current?.tenantId,
        userId: authContextRef.current?.userId,
        journeyThreadId: threadIdRef.current,
      }),
    }),
    onFinish: async ({ message }) => {
      // ──────────────────────────────────────────────────────────────
      // PHASE SYNC: Read authoritative phase from server after each response
      // ──────────────────────────────────────────────────────────────

      const serverPhase = (message as any).metadata?.serverPhase;
      if (serverPhase && serverPhase !== journeyModeRef.current) {
        const normalized = normalizeJourneyMode(serverPhase);
        console.log('[onFinish] Phase sync from metadata:', { from: journeyModeRef.current, to: normalized, raw: serverPhase });
        setJourneyMode(normalized);
      }

      if (message.parts) {
        const lastPhaseUpdate = [...(message.parts as any[])]
          .reverse()
          .find((part) =>
            part?.type === 'tool-advancePhase' &&
            part?.state === 'output-available' &&
            part?.output?.success
          );

        if (lastPhaseUpdate) {
          const newPhase = (lastPhaseUpdate as any).output.currentPhase || (lastPhaseUpdate as any).output.newPhase;
          if (newPhase && newPhase !== journeyModeRef.current) {
            console.log('[onFinish] Phase sync from advancePhase tool:', { from: journeyModeRef.current, to: newPhase });
            setJourneyMode(normalizeJourneyMode(newPhase));
          }
        }
      }

      if (message.parts) {
        const lastPreviewSave = [...(message.parts as any[])]
          .reverse()
          .find((part) =>
            part?.type === 'tool-savePreviewVersion' &&
            part?.state === 'output-available' &&
            (part as any).output?.success
          );

        if (lastPreviewSave) {
          const output = (lastPreviewSave as any).output;
          if (output?.previewUrl) {
            console.log('[onFinish] Preview saved → advancing to interactive_edit');
            setJourneyMode("build_edit");

            const url = String(output.previewUrl);
            const UUID_RE = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
            const match = url.match(new RegExp(`/preview/(${UUID_RE})/(${UUID_RE})`, 'i'));
            if (match) {
              setVibeContext((prev) => prev ? {
                ...prev,
                previewUrl: match[0],
                interfaceId: match[1],
                previewVersionId: match[2],
              } : prev);
            }
          }
        }
      }

      if (!serverPhase) {
        try {
          const tid = threadIdRef.current;
          const tenantId = authContextRef.current?.tenantId;
          if (tid && tenantId) {
            // Small delay to let server onFinish complete
            await new Promise(r => setTimeout(r, 500));
            const res = await fetch(
              `/api/journey-sessions/phase?tenantId=${encodeURIComponent(tenantId)}&threadId=${encodeURIComponent(tid)}`
            );
            if (res.ok) {
              const json = await res.json();
              if (json.phase && normalizeJourneyMode(json.phase) !== journeyModeRef.current) {
                const normalized = normalizeJourneyMode(json.phase);
                console.log('[onFinish] Phase sync from DB poll:', { from: journeyModeRef.current, to: normalized, raw: json.phase });
                setJourneyMode(normalized);

                if (json.phase === 'interactive_edit' && json.previewUrl) {
                  const url = String(json.previewUrl);
                  const UUID_RE = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
                  const match = url.match(new RegExp(`/preview/(${UUID_RE})/(${UUID_RE})`, 'i'));
                  if (match) {
                    setVibeContext((prev) => prev ? {
                      ...prev,
                      previewUrl: match[0],
                      interfaceId: match[1],
                      previewVersionId: match[2],
                    } : prev);
                  }
                }
              }
            }
          }
        } catch (pollErr) {
          console.warn('[onFinish] Phase poll failed (non-fatal):', pollErr);
        }
      }
    },
  });

  // Deduplicate messages by ID (workaround for Mastra + AI SDK v5 bug #9370)
  // This filters out duplicate message IDs, keeping the latest version of each
  // AND deduplicates identical text parts WITHIN a single message
  const dedupedMessages = useMemo(() => {
    const seen = new Map<string, (typeof uiMessages)[number]>();
    for (const msg of uiMessages) {
      seen.set(msg.id, msg);
    }
    const uniqueMessages = Array.from(seen.values());

    return uniqueMessages.map((msg) => {
      if (msg.role !== 'assistant' || !msg.parts || msg.parts.length <= 1) return msg;
      const seenTexts = new Set<string>();
      const dedupedParts = msg.parts.filter((part) => {
        if (part.type !== 'text') return true;
        const text = (part as { type: 'text'; text: string }).text?.trim();
        if (!text || seenTexts.has(text)) return false;
        seenTexts.add(text);
        return true;
      });
      if (dedupedParts.length === msg.parts.length) return msg;
      return { ...msg, parts: dedupedParts };
    });
  }, [uiMessages]);

  // ━━━ Bridge: Extract previewUrl from tool results ━━━━━━━━━━━━━━━━━━━━━━━━━
  // Detects preview URLs from:
  // 1. Direct tool-invocation parts (savePreviewVersion, persistPreviewVersion)
  // 2. Workflow wrapper tool results (runGeneratePreviewWorkflow)
  // 3. Agent text output containing /preview/ URLs (fallback)
  useEffect(() => {
    // Strict UUID regex - requires exactly 36 characters in 8-4-4-4-12 format
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const UUID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

    function trySetPreview(previewUrl: string, interfaceId: string, versionId: string) {
      if (!previewUrl || !interfaceId || !versionId) return;

      // CRITICAL: Validate UUIDs are exactly 36 characters - prevents truncated IDs
      if (!UUID_REGEX.test(interfaceId) || !UUID_REGEX.test(versionId)) {
        console.error('[Preview Bridge] Invalid UUID format - skipping:', {
          interfaceId: interfaceId?.length,
          versionId: versionId?.length,
          interfaceIdValue: interfaceId,
          versionIdValue: versionId,
        });
        return;
      }

      if (vibeContext?.previewUrl === previewUrl) return; // Already set

      console.log("[Preview Bridge] Setting preview:", { previewUrl, interfaceId, versionId });

      setVibeContext((prev) => prev ? {
        ...prev,
        previewUrl,
        previewVersionId: versionId,
        interfaceId,
      } : prev);

      setJourneyMode("build_edit");
      setView("preview");
    }

    for (const msg of dedupedMessages) {
      if (msg.role !== "assistant") continue;

      const parts = (msg as any).parts ?? (msg as any).content;
      if (!Array.isArray(parts)) continue;

      for (const part of parts) {
        // Guard: skip undefined/null parts to prevent TypeError on .state access
        if (!part || typeof part !== 'object') continue;

        const partType = String(part?.type ?? "");

        // ── Strategy 1: Direct tool parts — savePreviewVersion / persistPreviewVersion (v5) ──
        if (
          (partType === "tool-savePreviewVersion" || partType === "tool-persistPreviewVersion") &&
          part?.state === "output-available"
        ) {
          const output = part?.output;
          if (output?.previewUrl) {
            trySetPreview(output.previewUrl, output.interfaceId ?? "", output.versionId ?? "");
          }
        }

        // ── Strategy 2: Workflow wrapper tool — runGeneratePreviewWorkflow (v5) ──
        if (
          partType === "tool-runGeneratePreviewWorkflow" &&
          part?.state === "output-available"
        ) {
          const output = part?.output;
          if (output?.previewUrl) {
            trySetPreview(output.previewUrl, output.interfaceId ?? "", output.previewVersionId ?? output.versionId ?? "");
          }
        }

        // ── Strategy 3: Workflow results streamed as tool-generatePreview ──
        // In AI SDK v5 + Mastra, workflow tools appear as `tool-{toolId}` type parts
        if (
          (partType === "tool-generatePreview" || partType === "tool-runGeneratePreviewWorkflow") &&
          part?.state === "output-available"
        ) {
          const output = part?.output;
          if (output?.previewUrl) {
            trySetPreview(
              output.previewUrl,
              output.interfaceId ?? "",
              output.previewVersionId ?? output.versionId ?? ""
            );
          }
          // Also check nested step results (workflow output contains step results)
          const stepResults = output?.steps ?? output?.stepResults;
          if (stepResults) {
            const persist = stepResults.persistPreviewVersion ?? stepResults.finalize;
            if (persist?.output?.previewUrl) {
              trySetPreview(
                persist.output.previewUrl,
                persist.output.interfaceId ?? "",
                persist.output.versionId ?? persist.output.previewVersionId ?? ""
              );
            }
          }
        }

        // ── Strategy 4: Parse previewUrl from agent text output (fallback) ──
        if (part?.type === "text" && typeof part?.text === "string") {
          // Use strict UUID pattern to prevent truncated matches
          const previewUrlMatch = part.text.match(new RegExp(`/preview/(${UUID_PATTERN})/(${UUID_PATTERN})`, 'i'));
          if (previewUrlMatch) {
            const [fullMatch, extractedInterfaceId, extractedVersionId] = previewUrlMatch;
            trySetPreview(fullMatch, extractedInterfaceId, extractedVersionId);
          }
        }

        // ── Strategy 5: delegateToPlatformMapper wrapper tool ──
        // When masterRouterAgent delegates to platformMappingMaster, the previewUrl
        // is returned in the wrapper tool's output as tool-{toolId} type
        if (
          partType === "tool-delegateToPlatformMapper" &&
          part?.state === "output-available"
        ) {
          const output = part?.output;
          if (output?.previewUrl && output?.success) {
            // Extract interfaceId and versionId from the URL if not provided directly
            // Use strict UUID pattern to prevent truncated matches
            const urlMatch = String(output.previewUrl).match(new RegExp(`/preview/(${UUID_PATTERN})/(${UUID_PATTERN})`, 'i'));
            if (urlMatch) {
              const [, extractedInterfaceId, extractedVersionId] = urlMatch;
              trySetPreview(
                output.previewUrl,
                output.interfaceId ?? extractedInterfaceId,
                output.previewVersionId ?? extractedVersionId
              );
            }
          }
        }

        // ── Strategy 6: Handle interactive_edit_panel tool results (AI SDK v5) ──
        if (
          partType === "tool-showInteractiveEditPanel" &&
          part?.state === "output-available"
        ) {
          const output = part?.output;
          if (output?.success && output?.widgets) {
            setEditWidgets(output.widgets);
            setEditPalettes(output.palettes || []);
            setEditDensity(output.density || "comfortable");
            setSelectedPaletteId(output.selectedPaletteId || null);
            setEditPanelOpen(true);
          }
        }
      }

    }
  }, [dedupedMessages]); // eslint-disable-line react-hooks/exhaustive-deps

  async function sendAi(text: string, extraData?: Record<string, any>) {
    if (uiStatus === 'streaming') {
      console.warn('[sendAi] Blocked: already streaming');
      return;
    }
    // AI SDK v5: Pass dynamic context in the second argument of sendMessage
    // Request-level options are evaluated at call time, avoiding stale closures

    if (!authContext.tenantId || !authContext.userId) {
      console.warn('[sendAi] Auth not ready - tenantId or userId missing');
      return;
    }

    const payload = {
      tenantId: authContext.tenantId,
      userId: authContext.userId,
      journeyThreadId: threadId,
      selectedModel,
      // Vibe context fields
      platformType: vibeContext?.platformType,
      sourceId: vibeContext?.sourceId,
      entityId: vibeContext?.entityId,
      externalId: vibeContext?.externalId,
      displayName: vibeContext?.displayName,
      entityKind: vibeContext?.entityKind,
      skillMD: vibeContext?.skillMD,
      // Journey state — USE REFS to avoid stale closures
      // See: https://ai-sdk.dev/docs/troubleshooting/use-chat-stale-body-data
      phase: journeyModeRef.current,
      selectedOutcome: selectedOutcomeRef.current,
      selectedStyleBundleId: selectedStyleBundleIdRef.current,
      densityPreset,
      paletteOverrideId,
      ...extraData,
    };

    await sendUiMessage(
      {
        role: 'user',
        parts: [{ type: 'text', text }],
      },
      { body: payload }
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
      const errorMessage = output.error || output.message || JSON.stringify(output, null, 2) || 'Unknown error';
      const toolName = type.replace('tool-', '').replace(/_/g, ' ');

      return (
        <ErrorDisplay
          error={errorMessage}
          title={`Tool Error: ${toolName}`}
        />
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
    
    // Legacy: storyboard action tokens handled gracefully (phase removed)
    if (action.startsWith("__ACTION__:select_storyboard:")) {
      return "Selection received";
    }
    
    if (action.startsWith("__ACTION__:select_style_bundle:")) {
      return "You selected a style bundle";
    }
    
    if (action === "__ACTION__:outcome_help_me_decide") {
      return "I'm not sure, help me decide";
    }
    
    return "Action received";
  }

  /**
   * Handle suggested action button clicks from suggestAction tool
   */
  async function handleSuggestedAction(actionId: string, payload?: Record<string, any>) {
    if (uiStatus === 'streaming') return;
    
    console.log('[handleSuggestedAction]', actionId, payload);
    
    // Map actionId to appropriate action
    switch (actionId) {
      case 'generate-preview':
      case 'generate-dashboard-preview':
        // Send with explicit build signal so the backend knows to bypass agent
        await sendAi('Generate Dashboard Preview', {
          forceBuildPreview: true,
        });
        break;
      case 'select-style':
        await sendAi('Show different styles');
        break;
      case 'confirm-selection':
        await sendAi('Confirm my selection');
        break;
      case 'show-alternatives':
        await sendAi('Show me alternatives');
        break;
      case 'view-preview':
        // Handle preview navigation from suggestAction tool
        if (payload?.url) {
          const url = String(payload.url);
          // Use strict UUID pattern to prevent truncated matches
          const UUID_PATTERN_LOCAL = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
          const urlMatch = url.match(new RegExp(`/preview/(${UUID_PATTERN_LOCAL})/(${UUID_PATTERN_LOCAL})`, 'i'));
          if (urlMatch) {
            const [fullUrl, extractedInterfaceId, extractedVersionId] = urlMatch;
            console.log('[handleSuggestedAction] Setting preview from action:', {
              url: fullUrl,
              interfaceId: extractedInterfaceId,
              versionId: extractedVersionId,
            });
            setVibeContext((prev) => prev ? {
              ...prev,
              previewUrl: fullUrl,
              interfaceId: extractedInterfaceId,
              previewVersionId: extractedVersionId,
            } : prev);
            setJourneyMode("build_edit");
            setView("preview");
          }
        }
        break;
      default:
        // For backwards compatibility with text-based action labels
        await sendAi(actionId.replace(/-/g, ' '));
        break;
    }
  }

  // Conversation session state
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  // FIXED: Default to a proper UUID instead of the URL slug "vibe".
  // The old default caused getJourneySession to receive "vibe" as journeyThreadId,
  // which failed UUID validation. A real session threadId is set by switchToSession()
  // or createNewSession(), but the initial value must also be a valid UUID.
  const [threadId, setThreadId] = useState<string>(() => crypto.randomUUID());
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

  // ── Refs for stale-closure protection ──
  // This ensures auto-resubmissions (onFinish/shouldContinue) include tenantId.
  // See: https://ai-sdk.dev/docs/troubleshooting/use-chat-stale-body-data
  const authContextRef = useRef(authContext);
  useEffect(() => { authContextRef.current = authContext; }, [authContext]);
  const threadIdRef = useRef(threadId);
  useEffect(() => { threadIdRef.current = threadId; }, [threadId]);

  const [backendWarning, setBackendWarning] = useState<string | null>(null);

  const [vibeContextSnapshot, setVibeContextSnapshot] = useState<any>(null);
  const [vibeContext, setVibeContext] = useState<VibeContextExtended | null>(null);
  const [vibeInitDone, setVibeInitDone] = useState(false);

  const [journeyMode, setJourneyMode] = useState<JourneyMode>("propose");
  const [selectedOutcome, setSelectedOutcome] = useState<"dashboard" | "product" | null>(null);
  const [selectedStyleBundleId, setSelectedStyleBundleId] = useState<string | null>(null);
  const [densityPreset, setDensityPreset] = useState<"compact" | "comfortable" | "spacious">("comfortable");

  const journeyModeRef = useRef(journeyMode);
  useEffect(() => { journeyModeRef.current = journeyMode; }, [journeyMode]);
  const selectedOutcomeRef = useRef(selectedOutcome);
  useEffect(() => { selectedOutcomeRef.current = selectedOutcome; }, [selectedOutcome]);
  const selectedStyleBundleIdRef = useRef(selectedStyleBundleId);
  useEffect(() => { selectedStyleBundleIdRef.current = selectedStyleBundleId; }, [selectedStyleBundleId]);
  const [paletteOverrideId, setPaletteOverrideId] = useState<string | null>(null);

  // Interactive editor state
  const [editPanelOpen, setEditPanelOpen] = useState(false);
  const [deviceMode, setDeviceMode] = useState<DeviceMode>("desktop");
  const [isMobile, setIsMobile] = useState(false);

  // Edit panel data (populated from interactive_edit_panel tool result)
  const [editWidgets, setEditWidgets] = useState<WidgetConfig[]>([]);
  const [loadedSpec, setLoadedSpec] = useState<any>(null);
  const [loadedDesignTokens, setLoadedDesignTokens] = useState<any>(null);
  const [editPalettes, setEditPalettes] = useState<Palette[]>([]);
  const [editDensity, setEditDensity] = useState<Density>("comfortable");
  const [selectedPaletteId, setSelectedPaletteId] = useState<string | null>(null);

  // Derive effective design tokens from selected palette
  const effectiveDesignTokens = useMemo(() => {
    const base = loadedDesignTokens ?? { colors: { primary: "#3b82f6" }, borderRadius: 8 };
    if (!selectedPaletteId || editPalettes.length === 0) {
      return base;
    }
    const selectedPalette = editPalettes.find((p) => p.id === selectedPaletteId);
    if (!selectedPalette) {
      return base;
    }
    // Extract colors from palette swatches (swatches format: { name, hex })
    const paletteColors: Record<string, string> = {};
    for (const swatch of selectedPalette.swatches) {
      paletteColors[swatch.name.toLowerCase()] = swatch.hex;
    }
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: paletteColors.primary || base.colors?.primary || "#3b82f6",
        secondary: paletteColors.secondary || base.colors?.secondary || "#64748B",
        accent: paletteColors.accent || base.colors?.accent || "#14B8A6",
        background: paletteColors.background || base.colors?.background || "#F8FAFC",
      },
    };
  }, [loadedDesignTokens, selectedPaletteId, editPalettes]);

  // Initialize edit actions hook
  const editActions = useEditActions({
    tenantId: authContext.tenantId ?? "default",
    userId: authContext.userId ?? "default",
    interfaceId: vibeContext?.interfaceId ?? "",
    platformType: vibeContext?.platformType ?? "vapi",
    onSuccess: (result) => {
      // Update preview URL when edits are applied
      if (result.previewUrl) {
        setVibeContext((prev) => prev ? { ...prev, previewUrl: result.previewUrl } : prev);
      }
    },
    onError: (error) => {
      console.error("[ChatWorkspace] Edit action error:", error);
    },
  });

  // Widget reorder handler
  const handleReorderWidgets = (widgets: WidgetConfig[]) => {
    setEditWidgets(widgets);
    editActions.reorderWidgets(widgets.map((w) => w.id));
  };

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

    // entityId can be either the UUID (source_entities.id) or the platform external_id
    // Try UUID first (from journey_sessions.entity_id), fall back to external_id
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(externalId);
    let query = supabase
      .from("source_entities")
      .select("skill_md")
      .eq("tenant_id", authContext.tenantId)
      .eq("source_id", sourceId);
    if (isUuid) {
      query = query.eq("id", externalId);
    } else {
      query = query.eq("external_id", externalId);
    }
    const { data, error } = await query.maybeSingle();

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

  // Auto-expand chat for recommend phase
  useEffect(() => {
    if (journeyMode === 'propose') {
      setIsChatExpanded(true);
      if (!proposals) {
        setIsProposalLoading(true);
      }
    } else {
      setIsChatExpanded(false);
    }
  }, [journeyMode, proposals]);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Auto-open edit panel when in interactive_edit mode
  useEffect(() => {
    if (journeyMode === "build_edit") {
      setEditPanelOpen(true);
      setView("edit");
      // Auto-populate widgets from spec if showInteractiveEditPanel wasn't called
      if (editWidgets.length === 0 && loadedSpec?.components?.length > 0) {
        const derived: WidgetConfig[] = loadedSpec.components.map((comp: any, idx: number) => ({
          id: comp.id || `widget-${idx}`,
          title: comp.props?.title || comp.type || `Widget ${idx + 1}`,
          kind: (
            comp.type === "MetricCard" || comp.type === "kpi-card" || comp.type === "kpi" || comp.type === "kpi_card" || comp.type === "metric-card" ? "metric" as const :
            comp.type === "LineChart" || comp.type === "BarChart" || comp.type === "PieChart" || comp.type === "DonutChart" || comp.type === "AreaChart" || comp.type === "TimeseriesChart" || comp.type === "line-chart" || comp.type === "bar-chart" || comp.type === "pie-chart" ? "chart" as const :
            comp.type === "DataTable" || comp.type === "data-table" || comp.type === "data_table" || comp.type === "table" ? "table" as const :
            "other" as const
          ),
          enabled: !comp.props?.hidden,
        }));
        setEditWidgets(derived);
      }
    }
  }, [journeyMode, loadedSpec]);

  // ── Fetch dashboard spec when interfaceId/versionId are set ──
  useEffect(() => {
    const fetchDashboardSpec = async () => {
      if (!vibeContext?.interfaceId || !vibeContext?.previewVersionId) {
        return;
      }

      try {
        const res = await fetch(
          `/api/interfaces/${vibeContext.interfaceId}/versions/${vibeContext.previewVersionId}`,
          { credentials: 'include' }  // CRITICAL: Include cookies for auth
        );

        if (!res.ok) {
          console.error('[fetchDashboardSpec] Failed to fetch spec:', res.status);
          return;
        }

        const data = await res.json();
        console.log('[fetchDashboardSpec] Loaded spec:', {
          interfaceId: vibeContext.interfaceId,
          versionId: vibeContext.previewVersionId,
          componentCount: data.spec_json?.components?.length ?? 0,
        });

        setLoadedSpec(data.spec_json);
        setLoadedDesignTokens(data.design_tokens);
      } catch (error) {
        console.error('[fetchDashboardSpec] Error:', error);
      }
    };

    fetchDashboardSpec();
  }, [vibeContext?.interfaceId, vibeContext?.previewVersionId]);

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
        // Initialize dashboard journey through AI SDK
        initSendInFlight.current = true;
        await sendAi("System: initialize dashboard journey.", {
          userId: authContext.userId,
          tenantId: authContext.tenantId,
          threadId,
          selectedModel,
          // ✅ FIX: Pass context as FLAT top-level keys so sendAi doesn't depend on stale React state
          platformType: enrichedCtx.platformType,
          sourceId: enrichedCtx.sourceId,
          entityId: enrichedCtx.entityId,
          externalId: enrichedCtx.externalId,
          displayName: enrichedCtx.displayName,
          entityKind: enrichedCtx.entityKind,
          skillMD: enrichedCtx.skillMD,
          vibeContext: enrichedCtx,
          journey: {
            mode: journeyMode,
            threadId,
            selectedOutcome,
            selectedStyleBundleId,
            densityPreset,
            paletteOverrideId,
          },
        });
      } catch (e: any) {
        addLog("error", "Failed to initialize dashboard journey", e?.message || "AI_SDK_INIT_FAILED");
      }

      initSendInFlight.current = false;
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
  const prevStatusRef = useRef<string>('');

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

  // ✅ SMART DEBUG: Only logs when status actually changes
  useEffect(() => {
    // Only run in development with debug enabled
    if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DEBUG_CHAT === 'true') {
      // Only log when status changes (prevents infinite loops)
      if (uiStatus !== prevStatusRef.current) {
        console.group('🔍 Chat Debug - Status Change');
        console.log('Status changed:', prevStatusRef.current, '→', uiStatus);
        console.log('Journey mode:', journeyMode);
        console.log('Total messages:', uiMessages.length);

        if (uiMessages.length > 0) {
          const lastMsg = uiMessages[uiMessages.length - 1];
          console.log('Last message:', {
            id: lastMsg.id,
            role: lastMsg.role,
            partsCount: lastMsg.parts?.length || 0,
            parts: lastMsg.parts,
          });
        }

        console.groupEnd();
        prevStatusRef.current = uiStatus;
      }
    }
  }, [uiStatus, journeyMode, uiMessages]);

  async function loadSessions() {
    if (!authContext.userId || !authContext.tenantId) return;
    const res = await fetch(`/api/journey-sessions?tenantId=${authContext.tenantId}&userId=${authContext.userId}`);
    const json = await res.json();
    if (!res.ok || !json.ok) throw new Error(json?.error || "FAILED_TO_LOAD_SESSIONS");
    setSessions(json.sessions ?? []);
    // FIXED: Do NOT auto-resume last session.
    // Old behavior loaded stale phase state (e.g., interactive_edit with old selections).
    // User must explicitly pick "Resume" or start a new conversation.
    // The vibeContext from sessionStorage (set by the wizard) drives new sessions.
  }

  // Session switching
  async function switchToSession(s: any) {
    setActiveSessionId(String(s.id));
    setThreadId(String(s.thread_id));
    setView("preview"); // default to preview view
    setToolUi(null);

    // restore journey fields
    if (s.mode) setJourneyMode(normalizeJourneyMode(s.mode));
    if (typeof s.selected_outcome !== "undefined") {
      // Validate that the value matches the agent schema
      const validOutcomes: Array<"dashboard" | "product"> = ["dashboard", "product"];
      if (validOutcomes.includes(s.selected_outcome as any)) {
        setSelectedOutcome(s.selected_outcome);
      }
    }
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

    // Reset all journey state to prevent bleed from previous sessions
    setJourneyMode("propose");
    setSelectedOutcome(null);
    setSelectedStyleBundleId(null);
    setEditPanelOpen(false);
    setMessages([]);

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
    if (initSendInFlight.current) return; // Block sends while system init is in flight

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
          <div className="border-b border-gray-200 px-4 py-3">
            <PhaseIndicator currentMode={journeyMode} />
          </div>

          {/* Expand button - show only in recommend phase (separate div) */}
          <div className="border-b border-gray-200 px-4 py-2 flex justify-end">
            {/* Expand button - show only in recommend phase */}
            {journeyMode === "propose" && (
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
            {dedupedMessages.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <motion.div
                    className="w-2.5 h-2.5 bg-indigo-400 rounded-full"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  <span>Starting session...</span>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {dedupedMessages.map((m, messageIdx) => {
                    const isUser = m.role === 'user';

                    // Hide internal system init messages from display
                    if (isUser && m.parts?.some(p => p.type === 'text' && (p as any).text?.startsWith('System:'))) {
                      return null;
                    }

                    // For assistant messages, render reasoning blocks separately
                    if (!isUser) {
                      const isLastMessage = messageIdx === dedupedMessages.length - 1;
                      const isCurrentlyStreaming = uiStatus === 'streaming' && isLastMessage;

                      return (
                        <div key={`${m.id}-${messageIdx}`} className="text-left mb-4">
                          {/* Render single reasoning block (combine all reasoning parts) */}
                          {(() => {
                            const reasoningParts = m.parts?.filter(
                              (part) => part.type === 'reasoning' && (part as any).text
                            );

                            if (!reasoningParts || reasoningParts.length === 0) return null;

                            // Combine all reasoning text into one block
                            const combinedReasoningText = reasoningParts
                              .map((part) => (part as any).text)
                              .join('\n\n---\n\n');

                            return (
                              <ReasoningBlock
                                key={`reasoning-combined-${m.id}`}
                                text={combinedReasoningText}
                                isStreaming={isCurrentlyStreaming}
                                thinkingDuration={undefined}
                              />
                            );
                          })()}

                          {/* Then render the main message content */}
                          <div className={cn(
                            "inline-block max-w-[90%] rounded-xl px-4 py-2 bg-gray-100 text-gray-900"
                          )}>
                            {(() => {
                              // Parts-based structural suppression: if this message has ANY tool output,
                              // suppress ALL assistant text parts to prevent fabricated style descriptions.
                              const hasToolOutput = m.parts?.some(
                                (p: any) => p.type?.startsWith('tool-') &&
                                  ((p as any).state === 'output-available' || (p as any).state === 'output-error')
                              );

                              return m.parts?.map((part, idx) => {

                              // ✅ RENDER: Custom outcome choices
                            if (part.type === 'data-outcome-choices') {
                              return (
                                <InlineChoice
                                  key={idx}
                                  choices={(part as any).data?.choices || (part as any).choices || []}
                                  onSelect={async (id) => {
                                    if (uiStatus === 'streaming') return;
                                    // Map outcome IDs to their categories for the agent schema
                                    // The agent expects 'dashboard' or 'product', not the specific outcome ID
                                    const categoryMap: Record<string, "dashboard" | "product"> = {
                                      workflow_ops: "dashboard",
                                      call_analytics: "dashboard",
                                      voice_analytics: "dashboard",
                                      workflow_product: "product",
                                      voice_product: "product",
                                    };
                                    const category = categoryMap[id] || (id.includes("product") ? "product" : "dashboard");

                                    setSelectedOutcome(category);
                                    // DO NOT eagerly set journeyMode here.
                                    // The server's autoAdvancePhase determines the correct next phase
                                    // (it may be 'recommend' still if wireframe is needed, or 'style').
                                    // Phase will sync via onFinish DB poll.
                                    // setJourneyMode("style"); // REMOVED — causes desync
                                    await sendAi(`I selected ${id}`, {
                                      selectedOutcome: category,
                                    });
                                  }}
                                  onHelp={
                                    (part as any).data?.helpAvailable || (part as any).helpAvailable
                                      ? () => {
                                          void sendAi("Help me decide");
                                        }
                                      : undefined
                                  }
                                />
                              );
                            }

                            // ✅ RENDER: Proposals (from deterministic propose bypass)
                            if (part.type === 'data-proposals') {
                              const proposalData = (part as any).data as import('@/types/proposal').ProposalsPayload;
                              if (proposalData && !proposals) {
                                setTimeout(() => {
                                  setProposals(proposalData);
                                  setIsProposalLoading(false);
                                }, 0);
                              }
                              return null;
                            }

                            // ✅ RENDER: Single design system card (from deterministic style bypass)
                            if (part.type === 'data-design-system-card' || part.type === 'data-design-system') {
                              const dsData = (part as any).data || {};
                              const styleName = dsData.style?.name || 'Custom Design';
                              const colors = dsData.colors || {};
                              const charts = dsData.charts || [];

                              const system = {
                                id: styleName,
                                name: styleName,
                                icon: 'Palette' as const,
                                colors: [
                                  colors.primary,
                                  colors.secondary,
                                  colors.accent,
                                ].filter(Boolean).join(' / '),
                                style: dsData.style?.keywords || dsData.style?.type || 'Professional',
                                typography: `${dsData.typography?.headingFont || dsData.fonts?.heading?.split(',')[0] || 'Inter'} + ${dsData.typography?.bodyFont || dsData.fonts?.body?.split(',')[0] || 'Inter'}`,
                                bestFor: dsData.reasoning || 'Your workflow',
                                charts: charts,
                              };

                              return (
                                <DesignSystemCard
                                  key={idx}
                                  system={system}
                                  onSelect={() => {
                                    setSelectedStyleBundleId(system.id);
                                    void sendAi(`I selected style ${system.name}`, {
                                      selectedStyleBundleId: system.id,
                                    });
                                  }}
                                  onRegenerate={() => {
                                    void sendAi("I don't like this design. Generate a completely different style for my workflow.");
                                  }}
                                />
                              );
                            }

                            // ✅ RENDER: Custom design system pairs
                            if (part.type === 'data-design-system-pair') {
                              const systems = (part as any).data?.systems || (part as any).systems || [];
                              if (systems.length === 2) {
                                return (
                                  <DesignSystemPair
                                    key={idx}
                                    systems={systems as [any, any]}
                                    hasMore={(part as any).data?.hasMore || (part as any).hasMore}
                                    onSelect={async (id: string) => {
                                      if (uiStatus === 'streaming') return;
                                      setSelectedStyleBundleId(id);
                                      // FIX: Pass id explicitly to avoid React stale closure.
                                      // setState is batched — selectedStyleBundleId is still
                                      // the OLD value when sendAi reads it from closure.
                                      // See: https://ai-sdk.dev/docs/troubleshooting/use-chat-stale-body-data
                                      await sendAi(`I selected style ${id}`, {
                                        selectedStyleBundleId: id,
                                      });
                                    }}
                                    onShowMore={
                                      (part as any).data?.hasMore || (part as any).hasMore
                                        ? () => {
                                            void sendAi("Show different styles");
                                          }
                                        : undefined
                                    }
                                  />
                                );
                              }
                            }

                            // ✅ RENDER: runDesignSystemWorkflow → DesignSystemCard (AI SDK v5)
                            // Render only the generated custom design system.
                            if (part.type === 'tool-runDesignSystemWorkflow' && (part as any).state === 'output-available') {
                              const output = (part as any).output;

                              if (output?.success && output?.designSystem) {
                                const ds = output.designSystem;
                                const styleName = String(ds.style?.name || 'Professional Clean').trim();
                                const styleBundleId = styleName || 'Professional Clean';
                                const primarySystem = {
                                  id: styleBundleId,
                                  name: ds.style?.name || 'Professional Clean',
                                  icon: 'Palette' as const,
                                  colors: [
                                    ds.colors?.primary,
                                    ds.colors?.secondary,
                                    ds.colors?.accent,
                                  ].filter(Boolean).join(' / '),
                                  style: ds.style?.keywords || ds.style?.type || 'Professional',
                                  typography: `${ds.typography?.headingFont || 'Inter'} + ${ds.typography?.bodyFont || 'Inter'}`,
                                  bestFor: output.reasoning || 'Your workflow',
                                  charts: Array.isArray(ds.charts) ? ds.charts : [],
                                };
                                return (
                                  <DesignSystemCard
                                    key={idx}
                                    system={primarySystem}
                                    onSelect={() => {
                                      setSelectedStyleBundleId(primarySystem.id);
                                      void sendAi(`I selected style ${primarySystem.name}`, {
                                        selectedStyleBundleId: primarySystem.id,
                                      });
                                    }}
                                    onRegenerate={() => {
                                      void sendAi("I don't like this design. Generate a completely different style for my workflow.");
                                    }}
                                  />
                                );
                              }

                              if (output?.error) {
                                return (
                                  <ErrorDisplay
                                    key={(part as any).toolCallId || idx}
                                    error={output.error}
                                    title="Design System Generation Failed"
                                  />
                                );
                              }

                              return null;
                            }

                            // ✅ RENDER: Design system from delegateToDesignAdvisor (regeneration)
                            if (
                              (part.type === 'tool-invocation' &&
                                (part as any).toolName === 'delegateToDesignAdvisor' &&
                                (part as any).state === 'result') ||
                              (part.type === 'tool-delegateToDesignAdvisor' &&
                                (part as any).state === 'output-available')
                            ) {
                              const result = (part as any).result || (part as any).output || {};
                              const ds = result.designSystem || {};
                              if (ds.style?.name || ds.colors?.primary) {
                                const system = {
                                  id: ds.style?.name || 'Custom Design',
                                  name: ds.style?.name || 'Custom Design',
                                  icon: 'Palette' as const,
                                  colors: [
                                    ds.colors?.primary,
                                    ds.colors?.secondary,
                                    ds.colors?.accent,
                                  ].filter(Boolean).join(' / '),
                                  style: ds.style?.keywords || ds.style?.type || 'Professional',
                                  typography: `${ds.fonts?.heading?.split(',')[0] || 'Inter'} + ${ds.fonts?.body?.split(',')[0] || 'Inter'}`,
                                  bestFor: result.response?.split('\n')[0] || 'Your workflow',
                                  charts: (ds.charts || []).map((c: any) => ({
                                    type: String(c?.type || ''),
                                    bestFor: String(c?.bestFor || ''),
                                  })),
                                };
                                return (
                                  <DesignSystemCard
                                    key={idx}
                                    system={system}
                                    onSelect={() => {
                                      setSelectedStyleBundleId(system.id);
                                      void sendAi(`I'll take the ${system.name} style`, {
                                        selectedStyleBundleId: system.id,
                                      });
                                    }}
                                    onRegenerate={() => {
                                      void sendAi('Generate a completely different style for my workflow.');
                                    }}
                                  />
                                );
                              }
                            }

                              // ✅ RENDER: suggestAction tool as clickable button
                              // MUST be before the tool-* catch-all or it's unreachable
                              if (part.type === 'tool-suggestAction' && (part as any).state === 'input-available') {
                                const input = (part as any).input as { label: string; actionId: string; payload?: Record<string, any> };
                                return (
                                  <button
                                    key={(part as any).toolCallId || idx}
                                    onClick={() => handleSuggestedAction(input.actionId, input.payload)}
                                    disabled={uiStatus === 'streaming'}
                                    className={cn(
                                      "mt-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all",
                                      "bg-indigo-600 text-white hover:bg-indigo-700",
                                      "disabled:opacity-50 disabled:cursor-not-allowed",
                                      "flex items-center gap-2"
                                    )}
                                  >
                                    <span>▶</span>
                                    <span>{input.label}</span>
                                  </button>
                                );
                              }
                            // ✅ HIDE: All tool parts (catch-all — must be AFTER specific tool handlers)
                            // AI SDK v5: tool parts are typed as tool-{toolName}, no generic tool-call/tool-result
                            if (part.type?.startsWith('tool-')) {
                              return null;
                            }

                              // ✅ HIDE: Step-start (reasoning is handled by ReasoningBlock above)
                              if (part.type === 'step-start') {
                                return null;
                              }

                              // ✅ HIDE: Reasoning (already rendered above)
                              if (part.type === 'reasoning') {
                                return null;
                              }

                              // ✅ SHOW: Text content (with fallback __ACTION__ parser for backwards compatibility)
                              if (part.type === 'text') {
                                const text = (part as any).text || '';
                                // Only suppress text that looks like fabricated style descriptions
                                // Do NOT suppress all text — that kills the entire chat UX
                                if (hasToolOutput && (
                                  text.includes('## Phase 3:') ||
                                  text.includes('**Option A:') ||
                                  text.includes('**Option B:') ||
                                  text.includes('Design Philosophy') ||
                                  (text.includes('Color Palette') && text.includes('#'))
                                )) {
                                  return null;
                                }
                                // Parse __ACTION__ tokens for backwards compatibility with existing agent responses
                                const actionPattern = /__ACTION__\n([\s\S]*?)\n__ACTION__/g;
                                const segments: Array<{ type: 'text' | 'action'; content: string }> = [];
                                let lastIndex = 0;
                                let match: RegExpExecArray | null;
                                
                                while ((match = actionPattern.exec(text)) !== null) {
                                  if (match.index > lastIndex) {
                                    segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
                                  }
                                  segments.push({ type: 'action', content: match[1].trim() });
                                  lastIndex = match.index + match[0].length;
                                }
                                
                                const remaining = text.slice(lastIndex);
                                if (remaining) {
                                  segments.push({ type: 'text', content: remaining });
                                }
                                
                                // If no action tokens found, render as plain text
                                if (segments.length === 0 || (segments.length === 1 && segments[0].type === 'text')) {
                                  return (
                                    <div key={idx} className="whitespace-pre-wrap prose prose-sm max-w-none prose-gray">
                                      {text}
                                    </div>
                                  );
                                }
                                
                                // Render mixed content with action buttons
                                return (
                                  <div key={idx} className="space-y-2">
                                    {segments.map((seg, segIdx) => {
                                      if (seg.type === 'text') {
                                        return (
                                          <div key={segIdx} className="whitespace-pre-wrap prose prose-sm max-w-none prose-gray">
                                            {seg.content}
                                          </div>
                                        );
                                      }
                                      // Render action as button
                                      return (
                                        <button
                                          key={segIdx}
                                          onClick={() => handleSuggestedAction(seg.content.toLowerCase().replace(/\s+/g, '-'), {})}
                                          disabled={uiStatus === 'streaming'}
                                          className={cn(
                                            "px-4 py-2.5 rounded-lg font-medium text-sm transition-all",
                                            "bg-indigo-600 text-white hover:bg-indigo-700",
                                            "disabled:opacity-50 disabled:cursor-not-allowed",
                                            "flex items-center gap-2"
                                          )}
                                        >
                                          <span>▶</span>
                                          <span>{seg.content}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                );
                              }

                              return null;
                            });
                            })()}
                          </div>
                        </div>
                      );
                    }

                    // For user messages, render normally
                    return (
                      <div key={`${m.id}-${messageIdx}`} className="text-right mb-4">
                        <div className={cn(
                          "inline-block max-w-[90%] rounded-xl px-4 py-2 bg-indigo-600 text-white"
                        )}>
                          {m.parts?.map((part, idx) => {
                            if (part.type === 'text') {
                              return (
                                <div key={idx} className="whitespace-pre-wrap">
                                  {(part as any).text}
                                </div>
                              );
                            }
                            return null;
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {/* Show "Thinking..." when streaming OR when last message has no text */}
                  {(uiStatus === 'streaming' || (dedupedMessages.length > 0 && dedupedMessages[dedupedMessages.length - 1].role === 'assistant' && !dedupedMessages[dedupedMessages.length - 1].parts?.some(p => p.type === 'text'))) && (
                    <div className="flex items-center gap-2 text-sm text-gray-500 my-2">
                      <motion.div
                        className="w-3 h-3 bg-indigo-500 rounded-full"
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                      <span>Thinking...</span>
                    </div>
                  )}
                </div>

                {/* Render toolUi from phase router */}
                {toolUi && (
                  <div className="mt-3">
                    {toolUi.type === "outcome_choices" && toolUi.choices && (
                      <InlineChoice
                        choices={toolUi.choices}
                        onSelect={async (id: string) => {
                          if (uiStatus === 'streaming') return;
                          // Map outcome IDs to their categories for the agent schema
                          const categoryMap: Record<string, "dashboard" | "product"> = {
                            workflow_ops: "dashboard",
                            call_analytics: "dashboard",
                            voice_analytics: "dashboard",
                            workflow_product: "product",
                            voice_product: "product",
                          };
                          const category = categoryMap[id] || (id.includes("product") ? "product" : "dashboard");

                          setSelectedOutcome(category);
                          setToolUi(null);
                          // FIX: Pass category explicitly to avoid stale closure (AI SDK docs)
                          await sendAi(`__ACTION__:select_outcome:${id}`, {
                            selectedOutcome: category,
                          });
                        }}
                        onHelp={toolUi.helpAvailable ? () => {
                          setToolUi(null);
                          void sendMessage("__ACTION__:outcome_help_me_decide");
                        } : undefined}
                      />
                    )}

                    {/* storyboard_cards removed — storyboard/align phase eliminated */}

                    {toolUi.type === "style_bundles" && toolUi.bundles && (
                      <div className="grid gap-3">
                        {toolUi.bundles.map((bundle: any) => (
                          <button
                            key={bundle.id}
                            disabled={uiStatus === 'streaming'}
                            onClick={async () => {
                              if (uiStatus === 'streaming') return;
                              setSelectedStyleBundleId(bundle.id);
                              setToolUi(null);
                              // FIX: Pass explicit override for stale closure
                              await sendAi(`__ACTION__:select_style_bundle:${bundle.id}`, {
                                selectedStyleBundleId: bundle.id,
                              });
                            }}
                            className={`text-left rounded-lg border border-gray-200 p-4 transition-all ${
                              uiStatus === 'streaming'
                                ? 'opacity-50 cursor-not-allowed'
                                : 'hover:border-blue-500 hover:bg-blue-50'
                            }`}
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
                  <ErrorDisplay
                    error={String((uiError as any)?.message || uiError)}
                    title="Chat Error"
                  />
                ) : null}
              </>
            )}

            <div ref={messagesEndRef} />

            {/* Debug moved to console - check F12 */}
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
              {view === "edit" ? "Edit Dashboard" : "Dashboard Preview"}
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

              {/* Toggle bar: only visible after preview exists */}
              {vibeContext?.previewUrl && (
                <div
                  className="inline-flex items-center gap-1 rounded-lg bg-gray-100 p-1"
                  role="tablist"
                  aria-label="Preview mode"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={view === "preview"}
                    aria-label="Preview mode"
                    title="Preview"
                    onClick={() => {
                      setView("preview");
                      setEditPanelOpen(false);
                      // If we were in interactive_edit, go back to build_preview
                      // so the iframe renders instead of ResponsiveDashboardRenderer
                      if (journeyMode === "build_edit") {
                        setJourneyMode("build_edit");
                      }
                    }}
                    className={cn(
                      "inline-flex h-9 w-9 items-center justify-center rounded-md cursor-pointer transition-colors duration-200",
                      view === "preview"
                        ? "bg-indigo-500 text-white"
                        : "text-gray-600 hover:bg-white hover:text-gray-900"
                    )}
                  >
                    <Eye size={18} />
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={view === "edit"}
                    aria-label="Edit mode"
                    title="Edit Dashboard"
                    onClick={() => {
                      setView("edit");
                      setJourneyMode("build_edit");
                      setEditPanelOpen(true);
                      setDeviceMode("desktop");
                      // Auto-populate editWidgets from loadedSpec when user clicks Edit
                      // (showInteractiveEditPanel tool only runs when LLM initiates edit mode)
                      if (editWidgets.length === 0 && loadedSpec?.components?.length > 0) {
                        const derived: WidgetConfig[] = loadedSpec.components.map((comp: any, idx: number) => ({
                          id: comp.id || `widget-${idx}`,
                          title: comp.props?.title || comp.type || `Widget ${idx + 1}`,
                          kind: (
                            comp.type === "MetricCard" || comp.type === "kpi-card" || comp.type === "kpi" || comp.type === "kpi_card" || comp.type === "metric-card" ? "metric" as const :
                            comp.type === "LineChart" || comp.type === "BarChart" || comp.type === "PieChart" || comp.type === "DonutChart" || comp.type === "AreaChart" || comp.type === "TimeseriesChart" || comp.type === "line-chart" || comp.type === "bar-chart" || comp.type === "pie-chart" ? "chart" as const :
                            comp.type === "DataTable" || comp.type === "data-table" || comp.type === "data_table" || comp.type === "table" ? "table" as const :
                            "other" as const
                          ),
                          enabled: !comp.props?.hidden,
                        }));
                        setEditWidgets(derived);
                      }
                      // Auto-populate palettes from design tokens if empty
                      if (editPalettes.length === 0 && loadedDesignTokens) {
                        const colors = loadedDesignTokens?.colors || {};
                        setEditPalettes([
                          {
                            id: "current",
                            name: "Current",
                            swatches: [
                              { name: "Primary", hex: colors.primary || "#2563EB" },
                              { name: "Secondary", hex: colors.secondary || "#64748B" },
                              { name: "Accent", hex: colors.accent || "#14B8A6" },
                              { name: "Background", hex: colors.background || "#F8FAFC" },
                            ],
                          },
                          {
                            id: "dark",
                            name: "Dark Mode",
                            swatches: [
                              { name: "Primary", hex: "#60A5FA" },
                              { name: "Secondary", hex: "#94A3B8" },
                              { name: "Accent", hex: "#2DD4BF" },
                              { name: "Background", hex: "#0F172A" },
                            ],
                          },
                          {
                            id: "vibrant",
                            name: "Vibrant",
                            swatches: [
                              { name: "Primary", hex: "#8B5CF6" },
                              { name: "Secondary", hex: "#EC4899" },
                              { name: "Accent", hex: "#F59E0B" },
                              { name: "Background", hex: "#FFFBEB" },
                            ],
                          },
                        ]);
                        setSelectedPaletteId("current");
                      }
                    }}
                    className={cn(
                      "inline-flex h-9 w-9 items-center justify-center rounded-md cursor-pointer transition-colors duration-200",
                      view === "edit"
                        ? "bg-indigo-500 text-white"
                        : "text-gray-600 hover:bg-white hover:text-gray-900"
                    )}
                  >
                    <Pencil size={18} />
                  </button>
                </div>
              )}
          </div>
        </div>

          {/* Right Panel - Preview Area */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Device preview toolbar - only show in edit mode */}
            {(journeyMode === "build_edit" || view === "edit") && (
              <div className="p-2 border-b border-gray-200 bg-gray-50 flex justify-center">
                <DevicePreviewToolbar
                  value={deviceMode}
                  onChange={setDeviceMode}
                />
              </div>
            )}
            {/* Preview content */}
            <div className="flex-1 overflow-auto bg-gray-100 p-4">
              {journeyMode === 'propose' ? (
                <ProposalGallery
                  payload={proposals}
                  isLoading={isProposalLoading}
                  selectedIndex={selectedProposalIndex}
                  onSelect={(index) => {
                    setSelectedProposalIndex(index);
                    void sendAi(`__ACTION__:select_proposal:${index}`, {});
                  }}
                />
              ) : vibeContext?.previewUrl && view !== "edit" && journeyMode !== "build_edit" ? (
                <div className="h-full bg-white rounded-lg shadow-sm overflow-hidden">
                  <iframe
                    src={vibeContext.previewUrl}
                    className="w-full h-full border-0"
                    title="Dashboard Preview"
                    sandbox="allow-scripts allow-same-origin"
                  />
                </div>
              ) : journeyMode === "build_edit" && vibeContext?.previewUrl ? (
                <div className="h-full flex items-start justify-center py-4">
                  {(() => {
                    const dt = loadedDesignTokens || effectiveDesignTokens;
                    const hf = (dt?.fonts?.heading as string)?.split(",")[0]?.trim();
                    const bf = (dt?.fonts?.body as string)?.split(",")[0]?.trim();
                    const fonts = [...new Set([hf, bf].filter(Boolean))];
                    if (fonts.length === 0) return null;
                    return (
                      <link
                        rel="stylesheet"
                        href={`https://fonts.googleapis.com/css2?${fonts
                          .map((f) => `family=${encodeURIComponent(f)}:wght@400;500;600;700`)
                          .join("&")}&display=swap`}
                      />
                    );
                  })()}
                  <ResponsiveDashboardRenderer
                    spec={loadedSpec ?? {
                      title: "Dashboard Preview",
                      components: editWidgets.map((w) => ({
                        id: w.id,
                        type: w.kind === "chart" ? "LineChart" : w.kind === "metric" ? "MetricCard" : w.kind === "table" ? "DataTable" : "MetricCard",
                        props: { title: w.title, hidden: !w.enabled },
                        layout: { col: 0, row: 0, w: 4, h: 2 },
                      })),
                      layout: { columns: 12, gap: 16 },
                    }}
                    designTokens={effectiveDesignTokens}
                    deviceMode={deviceMode}
                    isEditing={true}
                    onWidgetClick={(widgetId) => {
                      // Could highlight widget in edit panel
                      console.log("Widget clicked:", widgetId);
                    }}
                  />
                </div>
              ) : journeyMode === "build_edit" ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Generating your preview...</p>
                  </div>
                </div>
              ) : (
                <EmptyPreviewState
                  journeyMode={journeyMode as any}
                  entityName={vibeContext?.displayName}
                />
              )}
            </div>
          </div>

          {/* Interactive Edit Panel */}
          <InteractiveEditPanel
            interfaceId={vibeContext?.interfaceId ?? ""}
            widgets={editWidgets}
            palettes={editPalettes}
            selectedPaletteId={selectedPaletteId}
            density={editDensity}
            isOpen={editPanelOpen}
            isMobile={isMobile}
            isLoading={editActions.isLoading}
            onClose={() => {
              setEditPanelOpen(false);
              setView("preview");
              if (journeyMode === "build_edit") {
                setJourneyMode("build_edit");
              }
            }}
            onToggleWidget={(widgetId) => {
              setEditWidgets((prev) =>
                prev.map((w) => (w.id === widgetId ? { ...w, enabled: !w.enabled } : w))
              );
              editActions.toggleWidget(widgetId);
            }}
            onRenameWidget={(widgetId, title) => {
              setEditWidgets((prev) =>
                prev.map((w) => (w.id === widgetId ? { ...w, title } : w))
              );
              editActions.renameWidget(widgetId, title);
            }}
            onChartTypeChange={(widgetId, chartType) => {
              setEditWidgets((prev) =>
                prev.map((w) => (w.id === widgetId ? { ...w, chartType } : w))
              );
              editActions.changeChartType(widgetId, chartType);
            }}
            onReorderWidgets={handleReorderWidgets}
            onDensityChange={(density) => {
              setEditDensity(density);
              editActions.setDensity(density);
            }}
            onPaletteChange={(paletteId) => {
              setSelectedPaletteId(paletteId);
              editActions.setPalette(paletteId);
            }}
          />
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
        <Wrench className="h-5 w-5" />
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
