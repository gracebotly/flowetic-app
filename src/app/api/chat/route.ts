
import { handleChatStream } from '@mastra/ai-sdk';
import { createUIMessageStreamResponse, createUIMessageStream, generateId } from 'ai';
import {
  RequestContext,
  MASTRA_RESOURCE_ID_KEY,
  MASTRA_THREAD_ID_KEY,
} from '@mastra/core/request-context';
import { createClient } from '@/lib/supabase/server';
import { getMastraSingleton } from '@/mastra/singleton';
import { ensureMastraThreadId } from '@/mastra/lib/ensureMastraThread';
import { safeUuid } from "@/mastra/lib/safeUuid";
import { PhaseToolGatingProcessor } from '@/mastra/processors/phase-tool-gating';

export const maxDuration = 300; // Fluid Compute + Hobby = 300s max

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let t: any;
  const timeout = new Promise<T>((_, reject) => {
    t = setTimeout(() => reject(new Error(`TIMEOUT_${label}_${ms}ms`)), ms);
  });
  return Promise.race([promise.finally(() => clearTimeout(t)), timeout]);
}

// ─── STRIP OPENAI PROVIDER METADATA FROM HISTORY ────────────────────────────
// OpenAI Responses API rejects requests containing itemIds it has already seen
// from its own previous responses. When chat history replays assistant messages
// that contain callProviderMetadata.openai.itemId (from tool calls like
// delegateToPlatformMapper) or providerMetadata.openai.itemId (from text parts),
// OpenAI treats them as duplicate items and returns a 400 error.
//
// The fix: strip ALL providerMetadata and callProviderMetadata from ALL
// historical assistant message parts. These are provider-internal tracking
// fields that must not be replayed. The content (text, tool results) is kept
// intact — only the metadata wrappers are removed.
//
// Root cause: delegateToPlatformMapper invokes platformMappingMaster.generate()
// which returns an OpenAI fc_ function call ID. This ID gets stored in the
// tool-result part's callProviderMetadata. On the next request, replaying it
// collides with OpenAI's internal state from the previous response.
//
// See: https://community.openai.com/t/1373703
// See: https://github.com/vercel/ai/issues/7883
function stripProviderMetadataFromHistory(messages: any[]): any[] {
  return messages.map((msg: any) => {
    if (msg.role !== 'assistant' || !Array.isArray(msg.parts)) {
      // Also strip from non-assistant messages if present (belt and suspenders)
      if (msg.providerMetadata) {
        const { providerMetadata, ...rest } = msg;
        return rest;
      }
      return msg;
    }

    const cleanedParts = msg.parts.map((part: any) => {
      // Create a shallow copy and remove metadata fields
      const cleaned = { ...part };
      if (cleaned.callProviderMetadata) {
        delete cleaned.callProviderMetadata;
      }
      if (cleaned.providerMetadata) {
        delete cleaned.providerMetadata;
      }
      return cleaned;
    });

    // Also strip message-level providerMetadata
    const { providerMetadata, ...msgRest } = msg;
    return { ...msgRest, parts: cleanedParts };
  });
}

// ─── DETERMINISTIC PHASE ADVANCEMENT ────────────────────────────────────────
// Phase 4A from refactor guide: code-driven phase transitions, NOT LLM-driven.
// Runs AFTER each agent stream completes. Reads DB state, advances if ready.
async function autoAdvancePhase(params: {
  supabase: any;
  tenantId: string;
  journeyThreadId: string;
  mastraThreadId: string;
}): Promise<{ advanced: boolean; from?: string; to?: string }> {
  const { supabase, tenantId, journeyThreadId, mastraThreadId } = params;

  // 1. Read current session state from DB
  let session = null;
  const { data: byThread } = await supabase
    .from('journey_sessions')
    .select('id, mode, selected_entities, selected_outcome, selected_layout, selected_style_bundle_id, schema_ready, preview_interface_id, preview_version_id, wireframe_confirmed, style_confirmed')
    .eq('thread_id', journeyThreadId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (byThread) {
    session = byThread;
  } else {
    const { data: byMastra } = await supabase
      .from('journey_sessions')
      .select('id, mode, selected_entities, selected_outcome, selected_layout, selected_style_bundle_id, schema_ready, preview_interface_id, preview_version_id, wireframe_confirmed, style_confirmed')
      .eq('mastra_thread_id', mastraThreadId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    session = byMastra;
  }

  if (!session) {
    console.log('[autoAdvancePhase] No session found, skipping');
    return { advanced: false };
  }

  const currentPhase = session.mode;
  let nextPhase: string | null = null;

  // 2. Deterministic transition rules - CODE-DRIVEN per Refactor Guide Phase 4
  // Rule: If selection exists → auto-advance. No LLM decisions, no confirmations.

  if (currentPhase === 'select_entity' && session.selected_entities) {
    // Validate selected_entities is not a bare UUID (sourceId accidentally stored)
    const entities = String(session.selected_entities).trim();
    const isBareUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entities);

    if (isBareUuid) {
      console.warn('[autoAdvancePhase] selected_entities is a bare UUID (sourceId), not advancing');
    } else {
      nextPhase = 'recommend';
    }

  } else if (currentPhase === 'recommend' && session.selected_outcome && session.wireframe_confirmed) {
    // Advance to style ONLY when both outcome is selected AND wireframe is confirmed.
    // The wireframe step in recommend phase is mandatory — the agent must present a
    // wireframe preview and the user must confirm it before moving to style.
    // wireframe_confirmed is set by: (1) eager detection in route.ts when user says
    // "looks good"/"yes" etc, or (2) client sends wireframeConfirmed=true via clientData.
    nextPhase = 'style';
    console.log('[autoAdvancePhase] Code-driven advance: outcome + wireframe confirmed → style');

  } else if (currentPhase === 'style' && session.selected_style_bundle_id && session.style_confirmed) {
    // Advance to build_preview ONLY when style bundle is selected AND user confirmed.
    // The style phase is where the agent presents the custom design system and the user
    // reviews/iterates. style_confirmed is set by: (1) eager detection in route.ts
    // when user says "looks good"/"yes" etc, or (2) client sends styleConfirmed=true.
    // Auto-set schema_ready flag when advancing.

    if (!session.schema_ready) {
      await supabase
        .from('journey_sessions')
        .update({ schema_ready: true, updated_at: new Date().toISOString() })
        .eq('id', session.id)
        .eq('tenant_id', tenantId);
      console.log('[autoAdvancePhase] Auto-set schema_ready=true for style bundle:', session.selected_style_bundle_id);
    }

    nextPhase = 'build_preview';
    console.log('[autoAdvancePhase] Code-driven advance: style confirmed → build_preview');

  } else if (currentPhase === 'build_preview' && session.preview_interface_id && session.preview_version_id) {
    // PHASE 4 FIX: Add missing transition to interactive_edit
    // Auto-advance when preview artifacts exist (CODE-DRIVEN)
    nextPhase = 'interactive_edit';
    console.log('[autoAdvancePhase] Code-driven advance: preview generated → interactive_edit');
  }

  if (!nextPhase) {
    console.log('[autoAdvancePhase] No transition needed:', {
      currentPhase,
      hasEntities: !!session.selected_entities,
      hasOutcome: !!session.selected_outcome,
      wireframeConfirmed: !!session.wireframe_confirmed,
      hasStyle: !!session.selected_style_bundle_id,
      styleConfirmed: !!session.style_confirmed,
      schemaReady: session.schema_ready,
      hasPreview: !!(session.preview_interface_id && session.preview_version_id),
    });
    return { advanced: false };
  }

  // 3. Write the new phase to DB
  const { error } = await supabase
    .from('journey_sessions')
    .update({ mode: nextPhase, updated_at: new Date().toISOString() })
    .eq('id', session.id)
    .eq('tenant_id', tenantId);

  if (error) {
    console.error('[autoAdvancePhase] Failed to advance:', error.message);
    return { advanced: false };
  }

  console.log('[autoAdvancePhase] ✅ Phase advanced:', {
    from: currentPhase,
    to: nextPhase,
    sessionId: session.id,
  });

  return { advanced: true, from: currentPhase, to: nextPhase };
}

// ─── DETERMINISTIC SELECT_ENTITY BYPASS ─────────────────────────────────────
// Phase 1 ALWAYS does the same thing: call getDataDrivenEntities RPC, format
// entities, present to user. No LLM reasoning needed. This eliminates the
// 197s timeout by skipping the agentic loop entirely for initial entity discovery.
//
// Returns a ReadableStream that mimics AI SDK's UIMessageStream format so the
// client's useChat hook processes it identically to an agent response.
async function handleDeterministicSelectEntity(params: {
  supabase: any;
  tenantId: string;
  sourceId: string;
  platformType: string;
  workflowName: string;
  journeyThreadId: string;
  mastraThreadId: string;
}): Promise<ReadableStream | null> {
  const { supabase, tenantId, sourceId, platformType, workflowName, journeyThreadId, mastraThreadId } = params;
  if (!sourceId) {
    console.log('[deterministic-select-entity] No sourceId, falling back to agent');
    return null;
  }
  const startTime = Date.now();
  try {
    // 1. Call the SAME RPC the agent's tool would call — but directly, no LLM
    const { data, error } = await supabase.rpc('get_data_driven_entities', {
      p_tenant_id: tenantId,
      p_source_id: sourceId,
      p_since_days: 30,
      p_workflow_name: workflowName || null,  // BUG 1 FIX: Filter by selected workflow
    });
    const elapsed = Date.now() - startTime;
    console.log(`[deterministic-select-entity] RPC completed in ${elapsed}ms`);
    if (error) {
      console.error('[deterministic-select-entity] RPC failed, falling back to agent:', error.message);
      return null;
    }
    const result = data?.[0] ?? data;
    // 2. Format the response exactly like the agent would
    const hasData = result?.has_data ?? false;
    // ✅ FIX (BUG 1): Filter out internal agent bookkeeping events before display.
    // The RPC now filters these at DB level too, but double-filter here for safety.
    // 'state' type with name 'thread_event' = agent thread management (48 events)
    // 'tool_event' type = internal tool execution traces (1 event)
    // 'error' type with name 'thread_event' = agent error traces (4 events)
    const allEntities = result?.entities ?? [];
    const entities = allEntities.filter((e: any) => {
      // Exclude internal thread events regardless of type
      if (e.name === 'thread_event') return false;
      // Exclude pure state/tool_event types (agent bookkeeping)
      if (e.type === 'state' || e.type === 'tool_event') return false;
      return true;
    });
    // Recompute total from filtered entities only
    const totalEvents = entities.reduce((sum: number, e: any) => sum + (e.count ?? 0), 0);
    let responseText: string;
    if (hasData && entities.length > 0) {
      const entityLines = entities
        .slice(0, 5)
        .map((e: any, i: number) => {
          const name = e.name || 'Unknown';
          const count = e.count ?? 0;
          const type = e.type || 'entity';
          return `**${i + 1}. ${name}** — ${count.toLocaleString()} events tracked (${type})`;
        })
        .join('\n');
      responseText = [
        `I've analyzed your ${platformType} workflow${workflowName ? ` "${workflowName}"` : ''} and found **${totalEvents.toLocaleString()} events** across **${entities.length} entities**.`,
        '',
        'Here are the entities I discovered from your real data:',
        '',
        entityLines,
        '',
        'Which entities would you like to track in your dashboard? You can select one or more, or tell me more about what metrics matter to you.',
      ].join('\n');
    } else {
      // No data — still respond quickly, agent can handle follow-up
      responseText = [
        `I've connected to your ${platformType} workflow${workflowName ? ` "${workflowName}"` : ''}, but I don't see any events stored yet.`,
        '',
        'This usually means:',
        '- The workflow hasn\'t run since you connected it',
        '- Events are still being backfilled',
        '',
        'You can either wait for events to come in, or tell me what entities you\'d like to track and I\'ll set things up based on your workflow structure.',
      ].join('\n');
    }
    // 2b. CRITICAL FIX (P0): Persist discovered entities to journey_sessions.
    // Root cause of 3-week stuck bug: handleDeterministicSelectEntity was display-only.
    // It called the RPC, formatted entities, streamed to UI — but never wrote to DB.
    // autoAdvancePhase reads journey_sessions.selected_entities to decide whether to
    // advance from select_entity → recommend. Without this write, it always found null.
    // Confirmed: 35/35 sessions stuck at select_entity with selected_entities = null.
    if (hasData && entities.length > 0) {
      const entityNames = entities
        .slice(0, 5)
        .map((e: any) => e.name || 'Unknown')
        .join(', ');
      try {
        const { error: writeError } = await supabase
          .from('journey_sessions')
          .update({
            selected_entities: entityNames,
            updated_at: new Date().toISOString(),
          })
          .eq('thread_id', journeyThreadId)
          .eq('tenant_id', tenantId);
        if (writeError) {
          console.error('[deterministic-select-entity] Failed to persist selected_entities:', writeError.message);
        } else {
          console.log('[deterministic-select-entity] ✅ Persisted selected_entities to DB:', entityNames);
        }
      } catch (persistEntitiesErr) {
        // Non-fatal — entities still stream to client, user can re-select
        console.warn('[deterministic-select-entity] Entity persistence error:', persistEntitiesErr);
      }
    }
    // 3. Persist the assistant message to journey_messages so it appears on reload
    try {
      await supabase.from('journey_messages').insert({
        tenant_id: tenantId,
        thread_id: journeyThreadId,
        role: 'assistant',
        content: responseText,
        created_at: new Date().toISOString(),
      });
    } catch (persistErr) {
      // Non-fatal — message still streams to client
      console.warn('[deterministic-select-entity] Failed to persist message:', persistErr);
    }
    // 4. FIX (Bug 1): Build proper AI SDK v5 UIMessageStream with SSE format
    // The previous implementation used legacy "0:", "e:", "d:" prefixes which
    // useChat doesn't recognize → no assistant message → "Starting session..." stuck.
    // AI SDK v5 requires text-start/text-delta/text-end SSE chunks per official docs.
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        // Start text block
        const textId = generateId();
        await writer.write({
          type: 'text-start',
          id: textId,
        });
        // Stream the response text word by word for progressive display
        const words = responseText.split(' ');
        for (let i = 0; i < words.length; i++) {
          await writer.write({
            type: 'text-delta',
            id: textId,
            delta: i === words.length - 1 ? words[i] : words[i] + ' ',
          });
        }
        // End text block
        await writer.write({
          type: 'text-end',
          id: textId,
        });
        // Stream selected entities as data part for client UI
        await writer.write({
          type: 'data-selected-entities',
          id: generateId(),
          data: entities,
        });
      },
    });
    console.log(`[deterministic-select-entity] ✅ Bypassed agent loop in ${Date.now() - startTime}ms`);
    return stream;
  } catch (err) {
    console.error('[deterministic-select-entity] Unexpected error, falling back to agent:', err);
    return null;
  }
}

// ─── DETERMINISTIC RECOMMEND OUTCOME DETECTION ──────────────────────────────
// The recommend phase has TWO selections that must be persisted:
//   1. selected_outcome (dashboard | product) — from user's choice or __ACTION__ token
//   2. wireframe_confirmed (boolean) — from user confirming the wireframe preview
//
// The agent PRESENTS the choice and generates the wireframe (text output).
// CODE detects the selection and persists it. Same pattern as select_entity bypass.
//
// Detection sources (priority order):
//   1. __ACTION__:select_outcome:dashboard / __ACTION__:select_outcome:product (from UI buttons)
//   2. Natural language: "dashboard", "monitoring", "product", "client-facing", etc.
//   3. Implicit confirmation: "yes", "go", "let's do it" → defaults to "dashboard"
//
// This runs BEFORE the agent on every recommend-phase request.
// If it detects an outcome, it writes to DB immediately.
// The agent still runs (to present wireframe / continue conversation).
// autoAdvancePhase in onFinish handles recommend → style when BOTH are set.
async function handleDeterministicRecommendOutcome(params: {
  supabase: any;
  tenantId: string;
  journeyThreadId: string;
  userMessage: string;
}): Promise<{ outcome: string; confidence: number } | null> {
  const { supabase, tenantId, journeyThreadId, userMessage } = params;
  const msg = userMessage.toLowerCase().trim();
  let outcome: string | null = null;
  let confidence = 0.9;
  // Priority 1: __ACTION__ tokens from UI button clicks (highest confidence)
  const actionMatch = userMessage.match(/__ACTION__:select_outcome:(dashboard|product)/);
  if (actionMatch) {
    outcome = actionMatch[1];
    confidence = 1.0;
    console.log(`[deterministic-recommend] __ACTION__ token detected: outcome="${outcome}"`);
  }
  // Priority 2: Explicit keyword matching (natural language)
  if (!outcome) {
    if (msg.match(/\b(dashboard|monitoring|analytics|metrics|tracking|overview|internal)\b/)) {
      outcome = 'dashboard';
      confidence = 0.9;
    } else if (msg.match(/\b(product|client.?facing|customer|portal|app|application|external)\b/)) {
      outcome = 'product';
      confidence = 0.9;
    }
  }
  // Priority 3: Implicit confirmation (user says "yes" after agent presents choice)
  // Only default to dashboard if message is clearly a confirmation, not a question
  if (!outcome) {
    if (msg.match(/^(yes|yeah|yep|yup|sure|ok|okay|go|let'?s?\s*(go|do)|sounds?\s*good|first\s*(one|option)|option\s*(1|a|one))\b/i)) {
      outcome = 'dashboard';
      confidence = 0.7;
    } else if (msg.match(/\b(second\s*(one|option)|option\s*(2|b|two))\b/i)) {
      outcome = 'product';
      confidence = 0.7;
    }
  }
  if (!outcome) return null;
  console.log(`[deterministic-recommend] Detected outcome="${outcome}" confidence=${confidence} from: "${userMessage.substring(0, 80)}"`);
  const { error } = await supabase
    .from('journey_sessions')
    .update({
      selected_outcome: outcome,
      updated_at: new Date().toISOString(),
    })
    .eq('thread_id', journeyThreadId)
    .eq('tenant_id', tenantId);
  if (error) {
    console.error('[deterministic-recommend] DB write failed:', error.message);
    return null;
  }
  console.log(`[deterministic-recommend] ✅ Persisted selected_outcome="${outcome}" to DB`);
  return { outcome, confidence };
}

// ─── DETERMINISTIC STYLE GENERATION BYPASS ───────────────────────────────────
// Fixes Failure 1 (agent doesn't auto-generate on style entry) and
// Failure 5 (agent writes prose instead of calling tools).
//
// Pattern: identical to handleDeterministicSelectEntity.
// On the FIRST style-phase message when no design_tokens exist in DB,
// bypass the agent entirely and call designSystemWorkflow directly.
// Stream a formatted design system presentation to the user.
//
// Subsequent style messages (refinement, rejection) go through the normal
// agent loop, which can call runDesignSystemWorkflow or delegateToDesignAdvisor
// with variety parameters.
async function handleDeterministicStyleGeneration(params: {
  mastra: any;
  supabase: any;
  tenantId: string;
  userId: string;
  journeyThreadId: string;
  mastraThreadId: string;
  workflowName: string;
  platformType: string;
  selectedOutcome: string;
  selectedEntities: string;
  requestContext: RequestContext;
}): Promise<ReadableStream | null> {
  const {
    mastra, supabase, tenantId, userId, journeyThreadId,
    workflowName, platformType, selectedOutcome, selectedEntities,
    requestContext,
  } = params;

  const startTime = Date.now();
  try {
    const workflow = mastra.getWorkflow("designSystemWorkflow");
    if (!workflow) {
      console.log('[deterministic-style] Workflow not found, falling back to agent');
      return null;
    }

    const run = await workflow.createRun();
    const result = await run.start({
      inputData: {
        workflowName: workflowName || 'Dashboard',
        platformType: platformType || 'other',
        selectedOutcome: selectedOutcome || 'dashboard',
        selectedEntities: selectedEntities || '',
        tenantId,
        userId,
      },
      requestContext,
    });

    const elapsed = Date.now() - startTime;
    console.log(`[deterministic-style] Workflow completed in ${elapsed}ms, status: ${result.status}`);

    if (result.status !== "success" || !result.result) {
      console.log('[deterministic-style] Workflow failed, falling back to agent');
      return null;
    }

    const data = result.result as any;
    const designSystem = data.designSystem;
    if (!designSystem) {
      console.log('[deterministic-style] No design system returned, falling back to agent');
      return null;
    }

    // Normalize tokens (same logic as runDesignSystemWorkflow.ts)
    const normalizedTokens = {
      ...designSystem,
      fonts: {
        heading: designSystem.fonts?.heading
          || (designSystem.typography?.headingFont
            ? designSystem.typography.headingFont + (designSystem.typography.headingFont.includes(',') ? '' : ', sans-serif')
            : 'Inter, sans-serif'),
        body: designSystem.fonts?.body
          || (designSystem.typography?.bodyFont
            ? designSystem.typography.bodyFont + (designSystem.typography.bodyFont.includes(',') ? '' : ', sans-serif')
            : 'Inter, sans-serif'),
        googleFontsUrl: designSystem.fonts?.googleFontsUrl || undefined,
        cssImport: designSystem.fonts?.cssImport || undefined,
      },
      colors: {
        ...designSystem.colors,
        success: designSystem.colors?.success || '#10B981',
        warning: designSystem.colors?.warning || '#F59E0B',
        error: designSystem.colors?.error || '#EF4444',
        text: designSystem.colors?.text || '#0F172A',
      },
      spacing: designSystem.spacing || { unit: 8 },
      radius: designSystem.radius ?? 8,
      shadow: designSystem.shadow || 'soft',
    };

    // Persist to DB
    const { error: persistErr } = await supabase
      .from('journey_sessions')
      .update({
        design_tokens: normalizedTokens,
        selected_style_bundle_id: 'custom',
        updated_at: new Date().toISOString(),
      })
      .eq('thread_id', journeyThreadId)
      .eq('tenant_id', tenantId);

    if (persistErr) {
      console.error('[deterministic-style] Failed to persist design_tokens:', persistErr.message);
    } else {
      console.log('[deterministic-style] ✅ Persisted design_tokens:', {
        styleName: normalizedTokens.style?.name,
        primary: normalizedTokens.colors?.primary,
        heading: normalizedTokens.fonts?.heading,
      });
    }

    // Update RequestContext for this request cycle
    requestContext.set('designTokens', JSON.stringify(normalizedTokens));
    requestContext.set('designSystemGenerated', 'true');

    // Format the design system as a user-friendly presentation
    const styleName = normalizedTokens.style?.name || 'Custom Design';
    const heading = normalizedTokens.fonts?.heading?.split(',')[0]?.trim() || 'Inter';
    const body = normalizedTokens.fonts?.body?.split(',')[0]?.trim() || 'Inter';
    const responseText = `Here's your custom design system — **${styleName}**. Take a look and let me know if this fits your brand, or I can generate something different.`;

    // Persist the assistant message for reload
    try {
      await supabase.from('journey_messages').insert({
        tenant_id: tenantId,
        thread_id: journeyThreadId,
        role: 'assistant',
        content: responseText,
        created_at: new Date().toISOString(),
      });
    } catch (msgErr) {
      console.warn('[deterministic-style] Failed to persist message:', msgErr);
    }

    // Build a DesignSystemCard-compatible data structure
    const dsCardData = {
      style: normalizedTokens.style,
      colors: normalizedTokens.colors,
      typography: {
        headingFont: heading,
        bodyFont: body,
      },
      charts: (normalizedTokens.charts || []).map((c: any) => ({
        type: String(c?.type || 'Chart'),
        bestFor: String(c?.bestFor || 'Visualization'),
      })),
      reasoning: data.reasoning || '',
    };

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        const textId = generateId();
        await writer.write({ type: 'text-start', id: textId });
        const words = responseText.split(' ');
        for (let i = 0; i < words.length; i++) {
          await writer.write({
            type: 'text-delta',
            id: textId,
            delta: i === words.length - 1 ? words[i] : words[i] + ' ',
          });
        }
        await writer.write({ type: 'text-end', id: textId });

        // Emit as data-design-system-card — matched by chat-workspace renderer
        await writer.write({
          type: 'data-design-system-card',
          id: generateId(),
          data: dsCardData,
        } as any);
      },
    });

    console.log(`[deterministic-style] ✅ Bypassed agent loop in ${Date.now() - startTime}ms`);
    return stream;
  } catch (err) {
    console.error('[deterministic-style] Unexpected error, falling back to agent:', err);
    return null;
  }
}

// ─── DETERMINISTIC BUILD_PREVIEW BYPASS ──────────────────────────────────────
// When phase transitions to build_preview (from style confirmation or eager
// advance), immediately run the generatePreview workflow instead of waiting
// for the agent to decide to call delegateToPlatformMapper.
//
// Per Refactor Guide: "If a decision has a correct answer that can be computed
// from data, CODE makes that decision."
//
// The preview workflow is deterministic: analyzeSchema → selectTemplate →
// generateMapping → generateUISpec → validateSpec → persist.
// The agent adds no value here — it just delays and sometimes calls the wrong tool.
async function handleDeterministicBuildPreview(params: {
  mastra: any;
  supabase: any;
  tenantId: string;
  userId: string;
  journeyThreadId: string;
  mastraThreadId: string;
  requestContext: any;
}): Promise<ReadableStream | null> {
  const {
    mastra, supabase, tenantId, userId, journeyThreadId, requestContext,
  } = params;

  const startTime = Date.now();
  try {
    // Read session data for workflow context
    const { data: session } = await supabase
      .from('journey_sessions')
      .select('source_id, selected_entities, selected_outcome, design_tokens')
      .eq('thread_id', journeyThreadId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (!session?.source_id) {
      console.log('[deterministic-build-preview] No source_id found, falling back to agent');
      return null;
    }

    // Get the source info for platform type
    const { data: source } = await supabase
      .from('source_entities')
      .select('id, platform_type, name')
      .eq('id', session.source_id)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (!source) {
      console.log('[deterministic-build-preview] Source not found, falling back to agent');
      return null;
    }

    const sourceId = source.id;
    const platformType = source.platform_type || 'other';
    const workflowName = source.name || 'Dashboard';

    // Set up RequestContext for the workflow
    requestContext.set('sourceId', sourceId);
    requestContext.set('platformType', platformType);
    requestContext.set('workflowName', workflowName);

    console.log('[deterministic-build-preview] Starting preview workflow:', {
      sourceId,
      platformType,
      workflowName: workflowName.substring(0, 50),
    });

    // Call the platform API endpoint directly (same as delegateToPlatformMapper)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

    const platformResponse = await fetch(`${baseUrl}/api/agent/platform`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId,
        userId,
        sourceId,
        platformType,
        task: 'Generate dashboard preview',
        interfaceId: sourceId, // Use sourceId as interfaceId for new dashboards
      }),
    });

    const platformResult = await platformResponse.json();
    const elapsed = Date.now() - startTime;

    if (!platformResponse.ok || platformResult.type === 'error') {
      console.error(`[deterministic-build-preview] Workflow failed in ${elapsed}ms:`, platformResult);
      return null;
    }

    console.log(`[deterministic-build-preview] ✅ Preview generated in ${elapsed}ms:`, {
      previewUrl: platformResult.result?.previewUrl,
      interfaceId: platformResult.result?.interfaceId,
    });

    // Update session with preview artifacts so autoAdvancePhase can advance to interactive_edit
    if (platformResult.result?.interfaceId && platformResult.result?.versionId) {
      await supabase
        .from('journey_sessions')
        .update({
          preview_interface_id: platformResult.result.interfaceId,
          preview_version_id: platformResult.result.versionId,
          updated_at: new Date().toISOString(),
        })
        .eq('thread_id', journeyThreadId)
        .eq('tenant_id', tenantId);
    }

    // Build stream response
    const previewUrl = platformResult.result?.previewUrl || '';
    const styleName = session.design_tokens?.style?.name || 'your design system';

    const responseText = [
      `Your **${styleName}** dashboard is ready! 🎉`,
      '',
      previewUrl ? `[View your dashboard preview](${previewUrl})` : '',
      '',
      'You can now edit any part of your dashboard — layout, colors, chart types, labels. Just tell me what you\'d like to change.',
    ].filter(Boolean).join('\n');

    // Persist the message
    try {
      await supabase.from('journey_messages').insert({
        tenant_id: tenantId,
        thread_id: journeyThreadId,
        role: 'assistant',
        content: responseText,
        created_at: new Date().toISOString(),
      });
    } catch (msgErr) {
      console.warn('[deterministic-build-preview] Failed to persist message:', msgErr);
    }

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        const textId = generateId();
        await writer.write({ type: 'text-start', id: textId });
        const words = responseText.split(' ');
        for (let i = 0; i < words.length; i++) {
          await writer.write({
            type: 'text-delta',
            id: textId,
            delta: i === words.length - 1 ? words[i] : words[i] + ' ',
          });
        }
        await writer.write({ type: 'text-end', id: textId });
      },
    });

    console.log(`[deterministic-build-preview] ✅ Bypassed agent loop in ${elapsed}ms`);
    return stream;
  } catch (err: any) {
    console.error('[deterministic-build-preview] Unexpected error:', err?.message || err);
    return null;
  }
}

export async function POST(req: Request) {
  const requestStartMs = Date.now();
  try {
    const params = await req.json();
    
    // 1. SERVER-SIDE AUTH (CRITICAL: Never trust client data)
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    
    // 2. VALIDATE TENANT MEMBERSHIP (CRITICAL: Prevent cross-tenant access)
    // AI SDK v5: params are now at top level, not nested in 'data'
    const clientData = params as any;
    const clientProvidedTenantId =
      clientData?.tenantId ??
      null;
    // Check for forceBuildPreview flag from suggestAction button click
    const forceBuildPreview = clientData?.forceBuildPreview === true;

    if (!clientProvidedTenantId || typeof clientProvidedTenantId !== 'string') {
      // AI SDK v5 transport sends internal tool-call resubmissions that don't include
      // custom body fields (tenantId, userId, etc.). These are finalization pings —
      // the tool results were already processed during the original streaming response.
      // Detect this pattern: has 'toolCall' key but no messages and no trigger.
      const bodyKeys = Object.keys(clientData || {});
      const isToolCallResubmission = bodyKeys.includes('toolCall') &&
        !Array.isArray(clientData?.messages) &&
        !clientData?.trigger;

      if (isToolCallResubmission) {
        // Acknowledge gracefully — this is a known AI SDK v5 transport behavior.
        // Returning 200 prevents noisy 400 errors in logs and stops client retries.
        console.debug('[api/chat] Tool-call resubmission acknowledged (no-op)', {
          keys: bodyKeys,
        });
        return new Response(
          JSON.stringify({ ok: true }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Genuine missing tenantId — this is an actual problem (broken client, direct API call, etc.)
      console.warn('[api/chat] Missing tenantId — rejecting request', {
        hasMessages: Array.isArray(clientData?.messages) && clientData.messages.length > 0,
        trigger: clientData?.trigger,
        keys: bodyKeys,
      });
      return new Response(
        JSON.stringify({ error: 'Missing tenantId in request' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('tenant_id, role')
      .eq('user_id', userId)
      .eq('tenant_id', clientProvidedTenantId)
      .single();
    
    if (membershipError || !membership) {
      console.error('[api/chat] Tenant access denied:', {
        userId,
        requestedTenantId: clientProvidedTenantId,
        error: membershipError?.message,
      });
      return new Response(
        JSON.stringify({ error: 'TENANT_ACCESS_DENIED: User is not authorized for this tenant' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const tenantId = membership.tenant_id; // Use VALIDATED tenant ID, not client's
    const userRole = membership.role;
    const authDoneMs = Date.now();
    console.log(`[TIMING] auth+setup: ${authDoneMs - requestStartMs}ms`);

    // 3. GET/CREATE STABLE MASTRA THREAD
    // Validate journeyThreadId is a UUID. Reject route slugs like "vibe" or other garbage.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const rawJourneyThreadId = (params as any)?.journeyThreadId;
    const clientJourneyThreadId = (typeof rawJourneyThreadId === 'string' && UUID_RE.test(rawJourneyThreadId))
      ? rawJourneyThreadId
      : 'default-thread';
    if (rawJourneyThreadId && rawJourneyThreadId !== clientJourneyThreadId) {
      console.warn(`[api/chat] Rejected invalid journeyThreadId: "${rawJourneyThreadId}", using default-thread`);
    }
    
    let mastraThreadId: string;
    try {
      // Extract platform context from request for auto-session creation
      const platformType = (params as any)?.platformType ||
                           (params as any)?.vibeContext?.platformType ||
                           'other';
      const rawSourceId = (params as any)?.sourceId ||
                          (params as any)?.vibeContext?.sourceId ||
                          null;
      const sourceId = safeUuid(rawSourceId, 'sourceId') ?? rawSourceId;
      const entityId = (params as any)?.entityId ||
                       (params as any)?.vibeContext?.entityId ||
                       null;

      mastraThreadId = await ensureMastraThreadId({
        tenantId,
        journeyThreadId: clientJourneyThreadId,
        resourceId: userId,
        title: (params as any)?.displayName || 'Dashboard Journey',
        // NEW: Pass platform context for auto-session creation
        platformType,
        sourceId,
        entityId,
      });
    } catch (threadError: any) {
      console.error('[api/chat] Failed to ensure Mastra thread:', threadError);
      return new Response(
        JSON.stringify({ error: 'Failed to initialize conversation thread' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // 4. BUILD AUTHORITATIVE REQUEST CONTEXT (validated by agent/tools)
    const requestContext = new RequestContext();
    
    // CRITICAL: These are AUTHORITATIVE values from server, not client
    requestContext.set('tenantId', tenantId);
    requestContext.set('userId', userId);
    requestContext.set('userRole', userRole);
    requestContext.set('threadId', mastraThreadId);
    requestContext.set('resourceId', userId);
    requestContext.set('journeyThreadId', clientJourneyThreadId);
    
    // ✅ ADD THESE 3 LINES FOR AUTHENTICATED SUPABASE CLIENT IN TOOLS
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return new Response(
        JSON.stringify({ error: 'Missing session token' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
    requestContext.set('supabaseAccessToken', session.access_token);
    requestContext.set('userEmail', user.email || 'unknown');
    
    // Force Mastra memory/tool operations to use validated IDs (reserved keys)
    requestContext.set(MASTRA_RESOURCE_ID_KEY, userId);
    requestContext.set(MASTRA_THREAD_ID_KEY, mastraThreadId);
    
    // SAFE: These are non-security-critical context values we can trust from client
    const safeClientKeys = [
      'platformType',
      'sourceId',
      'entityId',
      'externalId',
      'displayName',
      'phase',
      'mode',
      'selectedOutcome',
      // 'selectedStoryboard' removed — storyboard/align phase eliminated
      'selectedStyleBundleId',
      'densityPreset',
      'paletteOverrideId',
      'selectedModel',
    ];

    // Map displayName to workflowName for agent instructions
    const workflowName = clientData.displayName || clientData.externalId;
    if (workflowName) {
      requestContext.set('workflowName', String(workflowName));
    }

    // Also preserve skillMD for platform-specific knowledge
    if (clientData.skillMD) {
      requestContext.set('skillMD', clientData.skillMD);
    }

    for (const key of safeClientKeys) {
      if (clientData[key] !== undefined) {
        requestContext.set(key, clientData[key]);
      }
    }

    // FIX: Override client-provided phase with authoritative DB value.
    // Client React state can become stale if advancePhase streams back
    // but the client doesn't update journeyMode before the next request.
    // BUG FIX: Query BOTH thread_id AND mastra_thread_id columns since advancePhase
    // may write to either depending on which ID was available.
    // Extract clean UUIDs from potentially compound IDs (e.g., "sourceId:externalId")
    const cleanJourneyThreadId = safeUuid(clientJourneyThreadId, 'journeyThreadId') ?? clientJourneyThreadId;
    const cleanMastraThreadId = safeUuid(mastraThreadId, 'mastraThreadId') ?? mastraThreadId;
    if (cleanJourneyThreadId && cleanJourneyThreadId !== 'default-thread') {
      const phaseLookupStartMs = Date.now();
      try {
        // Query by thread_id first (primary), then fallback to mastra_thread_id
        let sessionRow = null;

        const { data: byThreadId } = await supabase
          .from('journey_sessions')
          .select('id, mode, source_id, preview_interface_id, selected_style_bundle_id, selected_entities, selected_outcome, selected_layout, schema_ready, wireframe_confirmed, design_tokens, style_confirmed')
          .eq('thread_id', cleanJourneyThreadId)
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (byThreadId) {
          sessionRow = byThreadId;
        } else {
          // Fallback: query by mastra_thread_id (in case thread was created that way)
          const { data: byMastraId } = await supabase
            .from('journey_sessions')
            .select('id, mode, source_id, preview_interface_id, selected_style_bundle_id, selected_entities, selected_outcome, selected_layout, schema_ready, wireframe_confirmed, design_tokens, style_confirmed')
            .eq('mastra_thread_id', cleanMastraThreadId)
            .eq('tenant_id', tenantId)
            .maybeSingle();
          sessionRow = byMastraId;
        }
        // ─── AUTO-DETECT SCHEMA READY ─────────────────────────────────────────
        // schema_ready is normally set by connectionBackfillWorkflow.updateJourneyStateStep,
        // but data ingested via webhook/API (not backfill) bypasses that workflow.
        // Auto-detect: if interface_schemas exists for this source, flip the flag.
        if (sessionRow && !sessionRow.schema_ready && sessionRow.source_id) {
          const { data: existingSchema } = await supabase
            .from('interface_schemas')
            .select('id')
            .eq('source_id', sessionRow.source_id)
            .eq('tenant_id', tenantId)
            .maybeSingle();
          if (existingSchema) {
            await supabase
              .from('journey_sessions')
              .update({ schema_ready: true, updated_at: new Date().toISOString() })
              .eq('id', sessionRow.id)
              .eq('tenant_id', tenantId);
            sessionRow.schema_ready = true;
            console.log('[api/chat] Auto-detected schema_ready=true for source:', sessionRow.source_id);
          }
        }

        const VALID_PHASES = ['select_entity', 'recommend', 'style', 'build_preview', 'interactive_edit', 'deploy'] as const;

        if (sessionRow?.mode) {
          if (VALID_PHASES.includes(sessionRow.mode as any)) {
            requestContext.set('phase', sessionRow.mode);
            console.log('[api/chat] Phase from DB:', {
              clientPhase: clientData.phase,
              dbPhase: sessionRow.mode,
              overridden: clientData.phase !== sessionRow.mode,
              sessionId: sessionRow.id,
              threadId: clientJourneyThreadId,
            });
          } else {
            // Bad data in DB — don't let it crash the agent
            console.warn('[api/chat] Invalid phase in DB, falling back to select_entity:', {
              invalidPhase: sessionRow.mode,
              sessionId: sessionRow.id,
              threadId: clientJourneyThreadId,
            });
            requestContext.set('phase', 'select_entity');
          }
        } else {
          // Log when no session found - helps debug why phase might be wrong
          console.log('[api/chat] No session found for phase lookup:', {
            clientPhase: clientData.phase,
            threadId: clientJourneyThreadId,
            mastraThreadId,
          });
        }

        // ─── PERSIST CLIENT SELECTIONS TO DB ─────────────────────────────
        // Client sends selections (entityId, selectedOutcome, selectedStyleBundleId)
        // in req body. These MUST be written to journey_sessions so that
        // autoAdvancePhase (which reads DB in onFinish) can trigger transitions.
        //
        // Without this, autoAdvancePhase always finds null columns and never advances.
        // Confirmed: 35/35 sessions stuck at select_entity with all selections null.
        //
        // Write rules:
        //   - Only write if client sent a value AND DB doesn't already have it
        //   - This prevents overwriting a value with a stale re-send
        //   - Entity comes from vibeContext (set before chat launch)
        //   - Outcome comes from InlineChoice onSelect → sendAi body
        //   - Style comes from DesignSystemPair onSelect → sendAi extraData
        // ──────────────────────────────────────────────────────────────────
        if (sessionRow) {
          const selectionUpdates: Record<string, any> = {};

          // Entity: client sends selectedEntities (comma-separated names) from vibeContext
          // IMPORTANT: Do NOT persist entityId here — that's the source_entity UUID,
          // not the user's entity selection (which should be names like "Leads, ROI Metrics").
          // Persisting entityId caused autoAdvancePhase to think entities were already selected,
          // skipping the entire select_entity phase.
          const clientSelectedEntities = clientData.selectedEntities;
          if (clientSelectedEntities && !sessionRow.selected_entities) {
            // Only persist if it's NOT a bare UUID (which would be an entityId, not a selection)
            const isBareUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(clientSelectedEntities).trim());
            if (!isBareUuid) {
              selectionUpdates.selected_entities = String(clientSelectedEntities);
            } else {
              console.warn('[api/chat] Blocked persisting bare UUID as selected_entities:', clientSelectedEntities);
            }
          }

          // BUG 3 FIX: Also persist sourceId so getEventStats can resolve UUIDs.
          // The agent receives entity display names from the client but getEventStats
          // needs the source UUID. By storing source_id in the session, route.ts
          // loads it into RequestContext on every request, and getEventStats already
          // falls back to context.requestContext.get('sourceId').
          if (clientData.sourceId && !sessionRow?.source_id) {
            selectionUpdates.source_id = clientData.sourceId;
          }

          // Outcome: client sends selectedOutcome after clicking outcome card
          const clientOutcome = clientData.selectedOutcome;
          if (clientOutcome && !sessionRow.selected_outcome) {
            selectionUpdates.selected_outcome = String(clientOutcome);
          }

          // Layout: client sends selectedLayout after picking a wireframe layout
          const clientLayout = clientData.selectedLayout;
          if (clientLayout && !sessionRow.selected_layout) {
            selectionUpdates.selected_layout = String(clientLayout);
          }

          // Wireframe confirmation: client sends wireframeConfirmed after user approves preview
          const clientWireframeConfirmed = clientData.wireframeConfirmed;
          if (clientWireframeConfirmed === true && !sessionRow.wireframe_confirmed) {
            selectionUpdates.wireframe_confirmed = true;
          }

          // Style: client sends selectedStyleBundleId after clicking design system card
          // BUG FIX: Resolve display name → valid slug BEFORE writing to DB.
          // CHECK constraint "valid_style_bundle_id" only accepts slugs like
          // "professional-clean", NOT display names like "Minimalism & Swiss Style".
          const clientStyle = clientData.selectedStyleBundleId;
          if (clientStyle && !sessionRow.selected_style_bundle_id) {
            // Custom design system names are stored as-is. No slug resolution needed.
            // The DB constraint (20260222000002) allows any non-empty string.
            const resolvedSlug = String(clientStyle).trim();
            if (resolvedSlug.length > 0) {
              selectionUpdates.selected_style_bundle_id = resolvedSlug;
              console.log('[api/chat] Style bundle selected:', resolvedSlug);
            } else {
              console.warn('[api/chat] Empty style bundle ID, skipping');
            }
          }


          if (Object.keys(selectionUpdates).length > 0) {
            selectionUpdates.updated_at = new Date().toISOString();

            // BUG FIX: If we're persisting a style bundle AND the session
            // already has entities + outcome, set schema_ready = true in the SAME write.
            // Previously NOTHING ever set schema_ready=true after style selection,
            // so autoAdvancePhase always found schema_ready=false and never advanced.
            if (
              (selectionUpdates.selected_style_bundle_id || sessionRow.selected_style_bundle_id || sessionRow.design_tokens) &&
              (selectionUpdates.selected_entities || sessionRow.selected_entities) &&
              (selectionUpdates.selected_outcome || sessionRow.selected_outcome)
            ) {
              selectionUpdates.schema_ready = true;
              console.log('[api/chat] Setting schema_ready=true (all selections present)');
            }

            const { error: persistErr } = await supabase
              .from('journey_sessions')
              .update(selectionUpdates)
              .eq('thread_id', cleanJourneyThreadId)
              .eq('tenant_id', tenantId);

            if (persistErr) {
              console.error('[api/chat] Failed to persist client selections:', persistErr.message);
            } else {
              console.log('[api/chat] ✅ Persisted client selections to DB:', Object.keys(selectionUpdates));
              if (selectionUpdates.selected_entities) sessionRow.selected_entities = selectionUpdates.selected_entities;
              if (selectionUpdates.selected_outcome) sessionRow.selected_outcome = selectionUpdates.selected_outcome;
              if (selectionUpdates.selected_style_bundle_id) sessionRow.selected_style_bundle_id = selectionUpdates.selected_style_bundle_id;
              if (selectionUpdates.schema_ready) sessionRow.schema_ready = selectionUpdates.schema_ready;
            }
          }
        }

        // Load entity selections from DB into RequestContext
        // GUARD: If selected_entities is a bare UUID (from stale entityId persistence bug),
        // clear it from DB so the entity selection flow can restart properly.
        // A real entity selection is a display name or comma-separated list, not a UUID.
        const UUID_ONLY_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (sessionRow?.selected_entities && UUID_ONLY_RE.test(sessionRow.selected_entities.trim())) {
          console.warn('[api/chat] Clearing stale UUID from selected_entities:', sessionRow.selected_entities);
          // Clear in DB so autoAdvancePhase doesn't see stale data
          await supabase
            .from('journey_sessions')
            .update({ selected_entities: null, updated_at: new Date().toISOString() })
            .eq('id', sessionRow.id)
            .eq('tenant_id', tenantId);
          sessionRow.selected_entities = null;
        }
        if (sessionRow?.selected_entities) {
          requestContext.set('selectedEntities', sessionRow.selected_entities);
          console.log('[api/chat] Loaded selectedEntities from DB:', sessionRow.selected_entities);
        }
        if (sessionRow?.source_id) {
          requestContext.set('sourceId', sessionRow.source_id);
          console.log('[api/chat] Loaded sourceId from DB:', sessionRow.source_id);
        }
        // Load selected outcome from DB into RequestContext
        if (sessionRow?.selected_outcome) {
          requestContext.set('selectedOutcome', sessionRow.selected_outcome);
          console.log('[api/chat] Loaded selectedOutcome from DB:', sessionRow.selected_outcome);
        }
        if (sessionRow?.selected_layout) {
          requestContext.set('selectedLayout', sessionRow.selected_layout);
          console.log('[api/chat] Loaded selectedLayout from DB:', sessionRow.selected_layout);
        }
        // Load wireframe_confirmed from DB into RequestContext
        if (sessionRow?.wireframe_confirmed) {
          requestContext.set('wireframeConfirmed', 'true');
          console.log('[api/chat] Loaded wireframeConfirmed from DB: true');
        }
        // Load schema_ready from DB into RequestContext
        if (sessionRow?.schema_ready) {
          requestContext.set('schemaReady', String(sessionRow.schema_ready));
        }
        // Load design_tokens (custom design system) into RequestContext
        if (sessionRow?.design_tokens) {
          requestContext.set('designTokens', JSON.stringify(sessionRow.design_tokens));
          requestContext.set('designSystemGenerated', 'true');
          console.log('[api/chat] Loaded design_tokens from DB:', {
            styleName: (sessionRow.design_tokens as any)?.style?.name,
            primary: (sessionRow.design_tokens as any)?.colors?.primary,
          });
        }
        if (sessionRow?.style_confirmed) {
          requestContext.set('styleConfirmed', 'true');
        }

        // BUG FIX: Override client-provided selectedStyleBundleId with DB value.
        // Client React state can become stale due to batched setState + closure capture.
        // The DB value (written by advancePhase tool) is authoritative.
        if (sessionRow?.selected_style_bundle_id) {
          const clientStyle = requestContext.get('selectedStyleBundleId') as string | undefined;
          requestContext.set('selectedStyleBundleId', sessionRow.selected_style_bundle_id);
          if (clientStyle !== sessionRow.selected_style_bundle_id) {
            console.log('[api/chat] Style override from DB:', {
              clientStyle,
              dbStyle: sessionRow.selected_style_bundle_id,
              sessionId: sessionRow.id,
            });
          }
        }

        // Design tokens come exclusively from designSystemWorkflow.
        // User style change requests are handled conversationally by the agent,
        // which calls runDesignSystemWorkflow or delegateToDesignAdvisor to
        // generate a NEW custom design system. No hardcoded overrides.


        // BUG FIX: Ensure interface exists for this journey session
        // This prevents "MISSING" interfaceId in downstream tools
        if (sessionRow && !sessionRow.preview_interface_id) {
          const { data: newInterface, error: ifaceErr } = await supabase
            .from('interfaces')
            .insert({
              tenant_id: tenantId,
              name: clientData.displayName || 'Untitled Dashboard',
              status: 'draft',
              component_pack: 'default',
            })
            .select('id')
            .single();
          if (!ifaceErr && newInterface?.id) {
            await supabase
              .from('journey_sessions')
              .update({
                preview_interface_id: newInterface.id,
                updated_at: new Date().toISOString(),
              })
              .eq('id', sessionRow.id);
            requestContext.set('interfaceId', newInterface.id);
            console.log('[api/chat] Created interface for session:', {
              sessionId: sessionRow.id,
              interfaceId: newInterface.id,
            });
          }
        } else if (sessionRow?.preview_interface_id) {
          requestContext.set('interfaceId', sessionRow.preview_interface_id);
        }
        console.log(`[TIMING] phase-lookup: ${Date.now() - phaseLookupStartMs}ms`);
      } catch (phaseErr) {
        // Non-fatal: if DB read fails, client-provided phase is used as fallback
        console.warn('[api/chat] Failed to read phase from DB, using client value:', phaseErr);
      }
    }

    const mastra = getMastraSingleton();

    if (process.env.DEBUG_CHAT_ROUTE === 'true') {
      console.log('[api/chat] Authorized request:', {
        tenantId,
        userId,
        userRole,
        mastraThreadId,
        clientJourneyThreadId,
        messagesCount: Array.isArray((params as any)?.messages) ? (params as any).messages.length : 0,
      });
    }

    // Extract raw messages early — used by wireframe confirmation and deterministic checks below
    const rawMessages = (params as any)?.messages;

    // ─── EAGER PHASE ADVANCE (BUG 1 FIX) ────────────────────────────────────────
    // Without this, style selection requests run the agent in phase="style"
    // because autoAdvancePhase only ran in onFinish (after stream completed).
    // The agent's style allowlist doesn't include delegateToPlatformMapper,
    // so it calls suggestAction("Generate Dashboard Preview") instead.
    // By advancing BEFORE agent invocation, the agent enters build_preview
    // on the SAME request as style selection → auto-generates preview.
    try {
      const eagerAdvance = await autoAdvancePhase({
        supabase,
        tenantId,
        journeyThreadId: cleanJourneyThreadId,
        mastraThreadId: cleanMastraThreadId,
      });
      if (eagerAdvance?.advanced && eagerAdvance?.to) {
        requestContext.set('phase', eagerAdvance.to);
        console.log('[api/chat] ✅ Eager phase advance before agent:', {
          from: eagerAdvance.from,
          to: eagerAdvance.to,
        });
      }
    } catch (eagerErr: any) {
      // Non-fatal: if eager advance fails, onFinish autoAdvance is the fallback
      console.warn('[api/chat] Eager autoAdvancePhase failed (non-fatal):', eagerErr?.message || eagerErr);
    }
    // ─── END EAGER PHASE ADVANCE ─────────────────────────────────────────────

    // PHASE VERIFICATION: Log final phase value before agent execution
    const finalPhase = requestContext.get('phase') as string;
    console.log('[api/chat] Final RequestContext phase before agent:', {
      phase: finalPhase,
      tenantId: tenantId.substring(0, 8) + '...',
      threadId: mastraThreadId.substring(0, 8) + '...',
    });

    // ─── DETERMINISTIC SELECT_ENTITY BYPASS ───────────────────────────────
    // If phase is select_entity AND this is the initial system message (no
    // prior conversation), bypass the agentic loop entirely. Call the RPC
    // directly and stream a pre-formatted response. Saves ~190s.
    const userMessages = Array.isArray((params as any)?.messages)
      ? (params as any).messages.filter((m: any) => m.role === 'user')
      : [];
    const isInitMessage = userMessages.length <= 1;
    const lastUserText = userMessages.length > 0
      ? String(userMessages[userMessages.length - 1]?.content ?? userMessages[userMessages.length - 1]?.parts?.[0]?.text ?? '')
      : '';
    const isSystemInit = lastUserText.toLowerCase().includes('system: initialize') ||
                         lastUserText.toLowerCase().includes('system:initialize');

    if (
      finalPhase === 'select_entity' &&
      (isInitMessage || isSystemInit)
    ) {
      const sourceId = requestContext.get('sourceId') as string;
      const platformType = requestContext.get('platformType') as string || 'other';
      const workflowName = requestContext.get('workflowName') as string || '';

      const deterministicStream = await handleDeterministicSelectEntity({
        supabase,
        tenantId,
        sourceId,
        platformType,
        workflowName,
        journeyThreadId: cleanJourneyThreadId,
        mastraThreadId: cleanMastraThreadId,
      });
      if (deterministicStream) {
        console.log('[api/chat] 🚀 Using deterministic select_entity bypass');

        // Still run autoAdvancePhase — if entities were pre-selected (from wizard),
        // this will advance to recommend
        try {
          if (cleanJourneyThreadId && cleanJourneyThreadId !== 'default-thread') {
            const advResult = await autoAdvancePhase({
              supabase,
              tenantId,
              journeyThreadId: cleanJourneyThreadId,
              mastraThreadId: cleanMastraThreadId,
            });
            if (advResult.advanced) {
              console.log('[api/chat] Deterministic bypass + auto-advance:', advResult);
            }
          }
        } catch (advErr) {
          console.warn('[api/chat] autoAdvancePhase after deterministic bypass:', advErr);
        }
        // FIX (Bug 1): Use createUIMessageStreamResponse for proper headers.
        // The manual Response construction with 'X-Vercel-AI-Data-Stream' header was incorrect.
        // AI SDK v5 requires specific header: 'x-vercel-ai-ui-message-stream: v1'
        return createUIMessageStreamResponse({
          stream: deterministicStream,
        });
      }
      // If handleDeterministicSelectEntity returned null, fall through to normal agent
      console.log('[api/chat] Deterministic bypass returned null, falling through to agent');
    }

    // ─── DETERMINISTIC RECOMMEND OUTCOME DETECTION ───────────────────────
    // If phase is recommend AND selected_outcome is not yet set, check the
    // user's message for outcome selection (natural language or __ACTION__ token).
    // Write to DB if detected. The agent still runs after this.
    if (finalPhase === 'recommend') {
      const { data: recommendSession } = await supabase
        .from('journey_sessions')
        .select('selected_outcome, wireframe_confirmed')
        .eq('thread_id', cleanJourneyThreadId)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (recommendSession && !recommendSession.selected_outcome) {
        const userMsgs = Array.isArray(rawMessages)
          ? rawMessages.filter((m: any) => m.role === 'user')
          : [];
        const lastMsg = userMsgs[userMsgs.length - 1];
        let messageText = '';
        if (lastMsg?.parts && Array.isArray(lastMsg.parts)) {
          messageText = lastMsg.parts
            .filter((p: any) => p.type === 'text')
            .map((p: any) => p.text || '')
            .join(' ');
        } else if (typeof lastMsg?.content === 'string') {
          messageText = lastMsg.content;
        }
        if (messageText) {
          const result = await handleDeterministicRecommendOutcome({
            supabase,
            tenantId,
            journeyThreadId: cleanJourneyThreadId,
            userMessage: messageText,
          });
          if (result) {
            requestContext.set('selectedOutcome', result.outcome);
            console.log('[api/chat] 🚀 Deterministic recommend outcome set:', result.outcome);
          }
        }
      }
    }
    // ─── DETERMINISTIC WIREFRAME CONFIRMATION (EAGER) ────────────────────
    // Check for wireframe confirmation BEFORE agent runs.
    if (finalPhase === 'recommend') {
      const { data: wfSession } = await supabase
        .from('journey_sessions')
        .select('id, selected_outcome, wireframe_confirmed')
        .eq('thread_id', cleanJourneyThreadId)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (wfSession?.selected_outcome && !wfSession.wireframe_confirmed) {
        const userMsgs = Array.isArray(rawMessages)
          ? rawMessages.filter((m: any) => m.role === 'user')
          : [];
        const lastMsg = userMsgs[userMsgs.length - 1];
        let userText = '';
        if (lastMsg?.parts && Array.isArray(lastMsg.parts)) {
          userText = lastMsg.parts
            .filter((p: any) => p.type === 'text')
            .map((p: any) => p.text || '')
            .join(' ')
            .toLowerCase()
            .trim();
        } else if (typeof lastMsg?.content === 'string') {
          userText = lastMsg.content.toLowerCase().trim();
        }
        const confirmationPatterns = [
          // Single-word confirmations (anchored — these ARE the full message)
          /^(yes|yeah|yep|yup|sure|ok|okay|correct|confirmed?|approve[d]?|perfect|great|fine|lgtm|proceed)\s*[.!]?$/i,
          // "looks" + optional filler words + positive adjective (no anchor — can appear anywhere)
          /\blooks?\s+.*?(good|right|great|fine|perfect|correct|accurate|nice|awesome|amazing)\b/i,
          // "that/this" + "is/looks" + optional filler + positive adjective
          /\b(that|this)\s+(is|looks)\s+.*?(good|right|great|fine|perfect|correct|accurate|nice)\b/i,
          // Action phrases (no anchor — can appear mid-sentence)
          /\b(let'?s?\s*(go|do\s*it|proceed|move\s*on)|go\s*ahead|do\s*it|build\s*it|generate|ship\s*it)\b/i,
          // "works for me", "i like it", "that'll do", "sounds good"
          /\b(works?\s*(for\s*me)?|i\s*like\s*it|that'?ll?\s*do|sounds?\s*good|i'?m\s*(good|happy|satisfied))\b/i,
        ];
        const isConfirmation = confirmationPatterns.some(p => p.test(userText));
        if (isConfirmation) {
          console.log('[api/chat] Eager wireframe confirmation detected:', userText);
          await supabase
            .from('journey_sessions')
            .update({ wireframe_confirmed: true, updated_at: new Date().toISOString() })
            .eq('id', wfSession.id)
            .eq('tenant_id', tenantId);
        }
      }
    }

    // ─── INTENT-BASED STYLE ROUTING ──────────────────────────────────────
    // Replaces regex-based confirmation/adjustment detection with LLM classification.
    // LLM classifies intent → CODE routes deterministically.
    // LLM handles: natural language understanding (what it's good at)
    // CODE handles: decisions and state transitions (what it's good at)
    if (finalPhase === 'style') {
      const { data: styleSession } = await supabase
        .from('journey_sessions')
        .select('id, design_tokens, style_confirmed, selected_entities, selected_outcome, selected_style_bundle_id')
        .eq('thread_id', cleanJourneyThreadId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (styleSession?.design_tokens && !styleSession.style_confirmed) {
        // Extract user message text
        const userMsgs = Array.isArray(rawMessages) ? rawMessages.filter((m: any) => m.role === 'user') : [];
        const lastMsg = userMsgs[userMsgs.length - 1];
        let messageText = '';
        if (lastMsg?.parts && Array.isArray(lastMsg.parts)) {
          messageText = lastMsg.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text || '').join(' ').trim();
        } else if (typeof lastMsg?.content === 'string') {
          messageText = lastMsg.content.trim();
        }

        if (messageText) {
          const { classifyStyleIntent } = await import('@/lib/intent-classifier');

          // Extract style name from design_tokens for context
          const styleName = styleSession.design_tokens?.name
            || styleSession.design_tokens?.styleName
            || styleSession.selected_style_bundle_id
            || null;

          const classification = await classifyStyleIntent(messageText, styleName, mastra);

          // ── CODE DECIDES based on classification ──────────────────────

          if (
            (classification.intent === 'confirm' || classification.intent === 'advance')
            && classification.confidence >= 0.6
          ) {
            // ── CONFIRM / ADVANCE: Set style_confirmed, advance phase, auto-build ──
            console.log(`[api/chat] 🎨 Intent classifier: ${classification.intent} (${classification.confidence}) → confirming style`);

            await supabase
              .from('journey_sessions')
              .update({ style_confirmed: true, schema_ready: true, updated_at: new Date().toISOString() })
              .eq('id', styleSession.id)
              .eq('tenant_id', tenantId);
            requestContext.set('styleConfirmed', 'true');

            let advancedToBuildPreview = false;
            try {
              const advResult = await autoAdvancePhase({
                supabase,
                tenantId,
                journeyThreadId: cleanJourneyThreadId,
                mastraThreadId: cleanMastraThreadId,
              });
              if (advResult?.advanced) {
                requestContext.set('phase', advResult.to!);
                console.log('[api/chat] ✅ Intent→style confirmed→build_preview advance:', advResult);
                if (advResult.to === 'build_preview') {
                  advancedToBuildPreview = true;
                }
              }
            } catch (advErr: any) {
              console.warn('[api/chat] autoAdvancePhase after intent confirm failed:', advErr?.message);
            }

            // Auto-generate dashboard if we advanced to build_preview
            if (advancedToBuildPreview) {
              console.log('[api/chat] 🚀 Auto-generating dashboard after intent-based style confirmation');
              try {
                const buildPreviewStream = await handleDeterministicBuildPreview({
                  mastra,
                  supabase,
                  tenantId,
                  userId,
                  journeyThreadId: cleanJourneyThreadId,
                  mastraThreadId: cleanMastraThreadId,
                  requestContext,
                });
                if (buildPreviewStream) {
                  return createUIMessageStreamResponse({
                    stream: buildPreviewStream,
                  });
                }
              } catch (buildErr: any) {
                console.warn('[api/chat] Auto build_preview after intent confirm failed:', buildErr?.message);
              }
            }

          } else if (classification.intent === 'refine' && classification.confidence >= 0.6) {
            // ── REFINE: Reset style_confirmed, set adjustment context ──
            console.log(`[api/chat] 🎨 Intent classifier: refine (${classification.confidence}) → adjustment mode`);

            await supabase
              .from('journey_sessions')
              .update({ style_confirmed: false, updated_at: new Date().toISOString() })
              .eq('id', styleSession.id)
              .eq('tenant_id', tenantId);
            requestContext.set('styleConfirmed', 'false');
            requestContext.set('styleAdjustmentRequested', messageText);
            console.log('[api/chat] 🔄 Reset style_confirmed=false after intent-based refinement detection');

            // Fall through to agent loop — agent will call delegateToDesignAdvisor
            // with the user's feedback. This is the creative part — LLM handles it.
          }

          // 'question', 'other', or low-confidence: fall through to agent loop
          // The agent handles conversational responses (what it's good at)
        }
      }
    }
    // ─── END INTENT-BASED STYLE ROUTING ──────────────────────────────────

    // ─── FORCE BUILD_PREVIEW BYPASS ───────────────────────────────────
    // If the client sent forceBuildPreview=true (from clicking Generate Preview button),
    // immediately trigger preview generation regardless of phase state.
    if (forceBuildPreview && (finalPhase === 'build_preview' || finalPhase === 'style')) {
      // First ensure style_confirmed=true if we're still in style
      if (finalPhase === 'style') {
        await supabase
          .from('journey_sessions')
          .update({
            style_confirmed: true,
            schema_ready: true,
            mode: 'build_preview',
            updated_at: new Date().toISOString()
          })
          .eq('thread_id', cleanJourneyThreadId)
          .eq('tenant_id', tenantId);
        requestContext.set('phase', 'build_preview');
        requestContext.set('styleConfirmed', 'true');
      }

      const forcePreviewStream = await handleDeterministicBuildPreview({
        mastra,
        supabase,
        tenantId,
        userId,
        journeyThreadId: cleanJourneyThreadId,
        mastraThreadId: cleanMastraThreadId,
        requestContext,
      });
      if (forcePreviewStream) {
        console.log('[api/chat] 🚀 Force build_preview bypass from button click');
        return createUIMessageStreamResponse({
          stream: forcePreviewStream,
        });
      }
    }

    // ─── DETERMINISTIC STYLE GENERATION BYPASS ─────────────────────────
    // If phase is style AND no design_tokens exist in DB, auto-generate
    // the design system via workflow, bypassing the agent loop entirely.
    // This fixes Failure 1 (agent writes prose instead of calling tools)
    // by making the FIRST style-phase response deterministic.
    // Subsequent style messages (refinement) go through the normal agent.
    if (finalPhase === 'style') {
      const { data: styleCheckSession } = await supabase
        .from('journey_sessions')
        .select('design_tokens')
        .eq('thread_id', cleanJourneyThreadId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (!styleCheckSession?.design_tokens) {
        const deterministicStyleStream = await handleDeterministicStyleGeneration({
          mastra,
          supabase,
          tenantId,
          userId,
          journeyThreadId: cleanJourneyThreadId,
          mastraThreadId: cleanMastraThreadId,
          workflowName: requestContext.get('workflowName') as string || '',
          platformType: requestContext.get('platformType') as string || 'other',
          selectedOutcome: requestContext.get('selectedOutcome') as string || 'dashboard',
          selectedEntities: requestContext.get('selectedEntities') as string || '',
          requestContext,
        });

        if (deterministicStyleStream) {
          console.log('[api/chat] 🎨 Using deterministic style generation bypass');

          // Run autoAdvancePhase — won't advance yet (style_confirmed is false)
          // but ensures DB state is consistent
          try {
            if (cleanJourneyThreadId && cleanJourneyThreadId !== 'default-thread') {
              const advResult = await autoAdvancePhase({
                supabase,
                tenantId,
                journeyThreadId: cleanJourneyThreadId,
                mastraThreadId: cleanMastraThreadId,
              });
              if (advResult.advanced) {
                console.log('[api/chat] Deterministic style bypass + auto-advance:', advResult);
              }
            }
          } catch (advErr) {
            console.warn('[api/chat] autoAdvancePhase after deterministic style bypass:', advErr);
          }

          return createUIMessageStreamResponse({
            stream: deterministicStyleStream,
          });
        }
        // If handleDeterministicStyleGeneration returned null, fall through to agent
        console.log('[api/chat] Deterministic style bypass returned null, falling through to agent');
      }
    }

    // ─── DETERMINISTIC BUILD_PREVIEW BYPASS ─────────────────────────
    // If phase is build_preview AND no preview exists in DB, auto-generate
    // the dashboard via platform workflow, bypassing the agent loop entirely.
    // This ensures the user NEVER has to ask "where is my dashboard?"
    if (finalPhase === 'build_preview') {
      const { data: previewCheckSession } = await supabase
        .from('journey_sessions')
        .select('preview_interface_id, preview_version_id, source_id, design_tokens')
        .eq('thread_id', cleanJourneyThreadId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (previewCheckSession && !previewCheckSession.preview_interface_id) {
        console.log('[api/chat] 🚀 build_preview phase with no preview — auto-generating');
        try {
          const buildPreviewStream = await handleDeterministicBuildPreview({
            mastra,
            supabase,
            tenantId,
            userId,
            journeyThreadId: cleanJourneyThreadId,
            mastraThreadId: cleanMastraThreadId,
            requestContext,
          });
          if (buildPreviewStream) {
            console.log('[api/chat] 🚀 Using deterministic build_preview bypass');
            return createUIMessageStreamResponse({
              stream: buildPreviewStream,
            });
          }
        } catch (buildErr: any) {
          console.warn('[api/chat] Deterministic build_preview failed, falling through to agent:', buildErr?.message);
        }
      }
    }

    // 5. CALL MASTRA WITH VALIDATED CONTEXT
    // Deduplicate OpenAI itemIds in message history before sending to agent.
    // This prevents "Duplicate item found with id fc_..." crash from OpenAI Responses API.
    const dedupedMessages = Array.isArray(rawMessages)
      ? stripProviderMetadataFromHistory(rawMessages)
      : rawMessages;
    const enhancedParams = {
      ...params,
      ...(dedupedMessages ? { messages: dedupedMessages } : {}),
      requestContext,
      mode: "generate",
      // DISABLED: Mastra working memory creates dual-state bugs.
      // journey_sessions DB is the single source of truth for phase/outcome/entities.
      // Keeping working memory disabled to prevent confusion — agent gets all context
      // from journey_sessions + skill knowledge search instead.
      // memory: {
      //   thread: cleanMastraThreadId,
      //   resource: userId,
      // },
    };

    if (process.env.DEBUG_CHAT_ROUTE === 'true') {
      console.log('[api/chat] Authorized request:', {
        tenantId, userId, userRole, mastraThreadId,
        clientJourneyThreadId,
        messagesCount: Array.isArray(dedupedMessages) ? dedupedMessages.length : 0,
      });
    }

    // Phase tool gating is handled by PhaseToolGatingProcessor (inputProcessor on defaultOptions).
    // It receives Mastra-wrapped tools and filters per phase — preserving RequestContext
    // while enforcing hard execution-layer gating (fixes AI SDK bug #8653).
    const streamStartMs = Date.now();
    let stepCount = 0;
    const calledTools: string[] = []; // Fix 4: track all tool calls for onFinish checks
    const stream = await withTimeout(
      handleChatStream({
        mastra,
        agentId: 'masterRouterAgent',
        params: enhancedParams,
        sendStart: false,
        sendFinish: true,
        sendReasoning: true,
        sendSources: false,
        defaultOptions: {
          toolCallConcurrency: 1,
          maxSteps: (() => {
            const phase = requestContext.get('phase') as string || 'select_entity';
            const phaseMaxSteps: Record<string, number> = {
              select_entity: 3,
              recommend: 6,  // Increased from 3: agent needs steps for getOutcomes + present wireframe + handle user confirmation. Old value caused safety valve to kill agent before wireframe confirmation could be processed.
              style: 5,
              build_preview: 8,
              interactive_edit: 10,
              deploy: 3,
            };
            return phaseMaxSteps[phase] || 5;
          })(),
          // toolChoice managed per-phase per-step by PhaseToolGatingProcessor
          inputProcessors: [
            new PhaseToolGatingProcessor(),
          ],
          // FIX (Bug 3): Improve tool name extraction to prevent [unknown] in logs
          onStepFinish: ({ toolCalls, finishReason }: { toolCalls?: any[]; finishReason?: string }) => {
            stepCount++;
            const toolNames = (toolCalls ?? []).map((tc: any) => {
              // Try multiple paths where tool name might be stored
              return tc.toolName || tc.tool?.name || tc.name || tc.args?.toolName || 'unknown';
            });
            // Fix 4: accumulate for onFinish to detect which tools ran this stream
            calledTools.push(...toolNames);
            console.log(`[TIMING] step-${stepCount}: ${Date.now() - streamStartMs}ms elapsed | tools: [${toolNames.join(', ')}] | finish: ${finishReason}`);
          },
          onFinish: async () => {
            // PHASE 4A: Deterministic phase advancement after stream completes.
            // autoAdvancePhase reads journey_sessions (populated by tools during the stream)
            // and advances the phase if selections are complete.
            //
            // Fix 4: Log explicitly when recommendOutcome ran this stream.
            // recommendOutcome writes selected_outcome to DB — autoAdvancePhase below
            // will detect it and advance recommend → style if wireframe_confirmed is set.
            if (calledTools.includes('recommendOutcome')) {
              console.log('[api/chat] recommendOutcome called this stream — checking for auto-advance to style phase');
            }
            try {
              if (cleanJourneyThreadId && cleanJourneyThreadId !== 'default-thread') {
                const result = await autoAdvancePhase({
                  supabase,
                  tenantId,
                  journeyThreadId: cleanJourneyThreadId,
                  mastraThreadId: cleanMastraThreadId,
                });
                if (result.advanced) {
                  console.log('[api/chat] onFinish auto-advanced phase:', result);
                }
              }
            } catch (err) {
              // Non-fatal: log but don't crash the stream response
              console.warn('[api/chat] onFinish autoAdvancePhase error:', err);
            }
          },
        },
      }),
      290000,
      "api_chat_stream"
    );

    return createUIMessageStreamResponse({ stream });
    
  } catch (error: any) {
    console.error('[api/chat] Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to process chat request',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
