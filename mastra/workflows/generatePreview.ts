import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { analyzeSchema } from '../tools/analyzeSchema';
import { selectTemplate } from '../tools/selectTemplate';
import { generateMapping } from '../tools/generateMapping';
import { generateUISpec } from '../tools/generateUISpec';
import { validateSpec } from '../tools/validateSpec';
import { persistPreviewVersion } from '../tools/persistPreviewVersion';
import { callTool } from '../lib/callTool';
import { transformDataForComponents } from '@/lib/dashboard/transformDataForComponents';

// Platform type derived from selectTemplate tool schema
type SelectTemplatePlatformType = "vapi" | "retell" | "n8n" | "mastra" | "crewai" | "activepieces" | "make";

// Input/Output schemas
export const GeneratePreviewInput = z.object({
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  userRole: z.enum(['admin', 'client', 'viewer']),
  interfaceId: z.string().uuid(),
  instructions: z.string().optional(),
});

export const GeneratePreviewOutput = z.object({
  runId: z.string().uuid(),
  previewVersionId: z.string().uuid(),
  previewUrl: z.string(),
  interfaceId: z.string().uuid(),
});

export type GeneratePreviewInput = {
  tenantId: string;
  userId: string;
  userRole: 'admin' | 'client' | 'viewer';
  interfaceId: string;
  instructions?: string;
};

export type GeneratePreviewOutput = {
  runId: string;
  previewVersionId: string;
  previewUrl: string;
  interfaceId: string;
};

// ============================================================================
// Step Definitions
// ============================================================================
// Step 1: Analyze Schema
const analyzeSchemaStep = createStep({
  id: 'analyzeSchema',
  inputSchema: z.object({
    tenantId: z.string(),
    userId: z.string(),
    userRole: z.enum(['admin', 'client', 'viewer']),
    interfaceId: z.string(),
    instructions: z.string().optional(),
  }),
  outputSchema: z.object({
    fields: z.array(z.object({
      name: z.string(),
      type: z.string(),
      sample: z.any(),
      nullable: z.boolean(),
    })),
    eventTypes: z.array(z.string()),
    confidence: z.number(),
  }),
  async execute({ inputData, requestContext, getStepResult, getInitData, suspend, runId }) {
    // PHASE GATE: Verify journey prerequisites before running workflow
    // The agent DOES call this workflow before selections are complete (proven by logs).
    // This is the last line of defense.
    const phase = requestContext?.get('phase') as string;
    const selectedOutcome = requestContext?.get('selectedOutcome') as string;
    const selectedStyleBundleId = requestContext?.get('selectedStyleBundleId') as string;

    const allowedPhases = ['build_edit', 'build_preview', 'interactive_edit'];
    if (phase && !allowedPhases.includes(phase)) {
      console.error(`[analyzeSchemaStep] PHASE GUARD: phase="${phase}", blocking workflow execution`);
      throw new Error(
        `PHASE_GUARD: generatePreviewWorkflow cannot run in phase "${phase}". ` +
        `Required: "build_edit" phase.`
      );
    }

    // Get sourceId from context (set when connection was established)
    const sourceId = requestContext.get('sourceId');
    
    // Extract specific properties from inputData (NOT the whole object)
    const { tenantId, userId, interfaceId, userRole, instructions } = inputData;
    
    const sampleSize = 100;
    
    if (!tenantId || !sourceId) {
      throw new Error('CONNECTION_NOT_CONFIGURED');
    }

    // ── Bug 3 Fix: Cache analyzeSchema result in requestContext ──────
    // The platformMappingMaster agent may have already called analyzeSchema
    // before invoking this workflow. Reuse the cached result if available.
    const cacheKey = `analyzeSchema_${tenantId}_${sourceId}`;
    const cachedResult = requestContext.get(cacheKey) as string | undefined;
    let result: any;

    if (cachedResult) {
      try {
        result = JSON.parse(cachedResult);
        console.log('[generatePreview] analyzeSchema CACHE HIT — skipping redundant call:', {
          fieldsCount: result.fields?.length || 0,
          eventTypesCount: result.eventTypes?.length || 0,
        });
      } catch {
        console.warn('[generatePreview] analyzeSchema cache parse failed, re-executing');
        result = null;
      }
    }

    if (!result) {
      result = await callTool(
        analyzeSchema,
        {
          tenantId,
          sourceId,
          sampleSize,
          platformType: requestContext.get('platformType') || 'make',
        },
        { requestContext }
      );

      // Cache for downstream steps and future calls in same request
      try {
        requestContext.set(cacheKey, JSON.stringify(result));
      } catch {
        // Non-fatal
      }
    }

    console.log('[generatePreview] analyzeSchema result:', {
      fieldsCount: result.fields?.length || 0,
      eventTypesCount: result.eventTypes?.length || 0,
      confidence: result.confidence,
      sampleFields: result.fields?.slice(0, 8).map((f: { name: string; type: string }) => ({ name: f.name, type: f.type })) || [],
      eventTypes: result.eventTypes || [],
    });

    return result;
  },
});

// Step 2: selectTemplate
const selectTemplateStep = createStep({
  id: 'selectTemplate',
  inputSchema: z.object({
    fields: z.array(z.object({
      name: z.string(),
      type: z.string(),
      nullable: z.boolean(),
      sample: z.any().optional(),
    })),
    eventTypes: z.array(z.string()),
    confidence: z.number(),
  }),
  outputSchema: z.object({
    templateId: z.string(),
    confidence: z.number(),
    reason: z.string(),
  }),
  async execute({ inputData, requestContext, getStepResult, getInitData, suspend, runId }) {
    const platformType = (requestContext.get("platformType") || 'make') as SelectTemplatePlatformType;
    
    const result = await callTool(selectTemplate, 
      {
        platformType,
        eventTypes: inputData.eventTypes,
        fields: inputData.fields,
      },
      { requestContext }
    );
    return result;
  },
});

// Step 3: generateMapping
const generateMappingStep = createStep({
  id: 'generateMapping',
  inputSchema: z.object({
    templateId: z.string(),
    confidence: z.number(),
    reason: z.string(),
  }),
  outputSchema: z.object({
    mappings: z.record(z.string()),
    missingFields: z.array(z.string()),
    confidence: z.number(),
  }),
  async execute({ inputData, requestContext, getStepResult, getInitData, suspend, runId }) {
    const analyzeResult = getStepResult(analyzeSchemaStep);
    const templateId = inputData.templateId;
    const platformType = (requestContext.get("platformType") || 'make') as SelectTemplatePlatformType;
    
    if (!analyzeResult) {
      throw new Error('MAPPING_INCOMPLETE_REQUIRED_FIELDS');
    }
    
    const initData = getInitData();
    const tenantId = initData?.tenantId || (requestContext.get('tenantId') as string | undefined) || 'unknown';
    const mappingCacheKey = `generateMapping_${tenantId}_${templateId}`;
    const cachedMapping = requestContext.get(mappingCacheKey) as string | undefined;

    let result: any;
    if (cachedMapping) {
      try {
        result = JSON.parse(cachedMapping);
        console.log('[generatePreview] generateMapping CACHE HIT — skipping redundant call:', {
          mappingsCount: Object.keys(result.mappings || {}).length,
          missingFieldsCount: result.missingFields?.length || 0,
        });
      } catch {
        console.warn('[generatePreview] generateMapping cache parse failed, re-executing');
        result = null;
      }
    }

    if (!result) {
      result = await callTool(generateMapping, 
        {
          templateId,
          fields: analyzeResult.fields,
          platformType,
        },
        { requestContext }
      );

      try {
        requestContext.set(mappingCacheKey, JSON.stringify(result));
      } catch {
        // Non-fatal
      }
    }
    console.log('[generatePreview] generateMapping result:', {
      mappingsCount: Object.keys(result.mappings || {}).length,
      missingFieldsCount: result.missingFields?.length || 0,
      confidence: result.confidence,
      mappings: result.mappings,
      missingFields: result.missingFields,
    });
    return result;
  },
});

// Step 4: Check Mapping Completeness (HITL)
const checkMappingCompletenessStep = createStep({
  id: 'checkMappingCompleteness',
  inputSchema: z.object({
    mappings: z.record(z.string()),
    missingFields: z.array(z.string()),
    confidence: z.number(),
  }),
  outputSchema: z.object({
    shouldSuspend: z.boolean(),
    missingFields: z.array(z.string()).optional(),
    message: z.string().optional(),
    decision: z.string(),
  }),
  suspendSchema: z.object({
    reason: z.string(),
    missingFields: z.array(z.string()),
    message: z.string().optional(),
  }),
  resumeSchema: z.object({
    selectedFieldKey: z.string().optional(),
    confirmed: z.boolean().optional(),
  }),
  async execute({ inputData, requestContext, getStepResult, getInitData, suspend, runId }) {
    const missingFields = inputData.missingFields || [];
    const confidence = inputData.confidence || 0;

    // Only suspend if ZERO fields could be mapped (total failure).
    // Partial mappings (confidence > 0) can proceed with best-effort rendering.
    if (confidence === 0 && missingFields.length > 0) {
      await suspend({
        reason: 'No fields could be mapped automatically',
        missingFields,
        message: 'None of the required fields could be matched to your data. Please provide field mappings manually.',
      });
    }

    // Log partial mappings but don't block
    if (missingFields.length > 0) {
      console.warn(
        `[checkMappingCompleteness] Proceeding with partial mapping. Missing: ${missingFields.join(', ')}. Confidence: ${confidence}`
      );
    }

    return {
      shouldSuspend: false,
      missingFields: missingFields.length > 0 ? missingFields : undefined,
      message: missingFields.length > 0
        ? `Proceeding with partial mapping (${missingFields.length} field(s) unmapped)`
        : undefined,
      decision: 'complete',
    };
  },
});

// Step 4.5: Retrieve Design Patterns (Phase 3 — BM25 Intelligence)
// Searches the 247-pattern BM25 index for industry-specific layout hints,
// UX guidelines, and product patterns. These flow into generateUISpec
// where extractLayoutHints() parses them for layout decisions.
const retrieveDesignPatternsStep = createStep({
  id: 'retrieveDesignPatterns',
  inputSchema: z.object({
    shouldSuspend: z.boolean(),
    missingFields: z.array(z.string()).optional(),
    message: z.string().optional(),
    decision: z.string(),
  }),
  outputSchema: z.object({
    shouldSuspend: z.boolean(),
    missingFields: z.array(z.string()).optional(),
    message: z.string().optional(),
    decision: z.string(),
    designPatterns: z.array(z.object({
      content: z.string(),
      source: z.string(),
      score: z.number(),
    })).optional(),
    uxGuidelines: z.array(z.string()).optional(),
  }),
  async execute({ inputData, requestContext, getStepResult }) {
    const { shouldSuspend, missingFields, message, decision } = inputData;

    try {
      const dtRaw = requestContext.get('designTokens') as string;
      const designPatterns: Array<{ content: string; source: string; score: number }> = [];
      let uxGuidelines: string[] = [];

      if (dtRaw) {
        const parsed = JSON.parse(dtRaw);

        if (parsed.rawPatterns) {
          if (parsed.rawPatterns.product) {
            for (const p of parsed.rawPatterns.product) {
              designPatterns.push({
                content: p.content || '',
                source: 'product-patterns',
                score: p.score || 0.5,
              });
            }
          }
          if (parsed.rawPatterns.ux) {
            for (const u of parsed.rawPatterns.ux) {
              designPatterns.push({
                content: u.content || '',
                source: 'ux-guidelines',
                score: u.score || 0.5,
              });
            }
          }
          if (parsed.rawPatterns.styles) {
            for (const s of parsed.rawPatterns.styles) {
              designPatterns.push({
                content: s.content || '',
                source: 'style-patterns',
                score: s.score || 0.5,
              });
            }
          }
        }

        uxGuidelines = parsed.uxGuidelines || [];
      }

      console.log(`[retrieveDesignPatterns] Loaded ${designPatterns.length} patterns from designSystemWorkflow`);

      // ── Phase 2: Direct BM25 search using layoutQuery from dataSignals ──
      // ── SECURITY NOTE (Wolf V2 Phase 3) ──────────────────────────────────
      // Design patterns are from shared skill CSVs (workspace/skills/),
      // NOT from tenant-specific data. BM25 search over workspace index is
      // safe for multi-tenant use because the index contains only product
      // knowledge, not user data. The uiux_data Supabase table queried by
      // loadUIUXCSV is also tenant-agnostic (no tenant_id column).
      // If pattern sources ever include tenant data, add tenant_id filtering.
      // ─────────────────────────────────────────────────────────────────────
      try {
        const mappingResult = getStepResult(generateMappingStep);
        const dataSignals = (mappingResult as any)?.dataSignals;

        if (dataSignals?.layoutQuery) {
          const { workspace } = await import('../workspace');
          const { ensureUIUXSearchInitialized } = await import('../tools/uiux/initUIUXSearch');
          await ensureUIUXSearchInitialized();

          const { getCachedPatterns, setCachedPatterns, buildPatternCacheKey } = await import('../lib/patternCache');
          const cacheKey = buildPatternCacheKey(
            (requestContext.get('skeletonId') as string) || 'unknown',
            (requestContext.get('platformType') as string) || 'unknown'
          );
          const cached = getCachedPatterns(cacheKey);

          if (cached) {
            console.log(`[retrieveDesignPatterns] Using cached BM25 patterns (${cached.length} entries)`);
            for (const p of cached) {
              if (!designPatterns.some(existing => existing.content === p.content)) {
                designPatterns.push(p);
              }
            }
          } else {
            const bm25Results = await workspace.search(dataSignals.layoutQuery, {
              topK: 8,
              mode: 'bm25',
            });

            const newPatterns: Array<{ content: string; source: string; score: number }> = [];

            for (const result of bm25Results) {
              const content = result.content || '';
              const domain = result.metadata?.domain || 'layout';
              const score = result.score ?? 0;

              // BUG 2A FIX: Lowered threshold from 4.0 to 1.5.
              // BM25 scores vary by query length and corpus size. 4.0 filtered
              // out nearly all results, causing 0 patterns despite 247 indexed entries.
              if (score > 1.5 && !designPatterns.some(p => p.content === content)) {
                const pattern = {
                  content,
                  source: `bm25-direct-${domain}`,
                  score,
                };
                designPatterns.push(pattern);
                newPatterns.push(pattern);
              }
            }

            if (newPatterns.length > 0) {
              setCachedPatterns(cacheKey, newPatterns);
            }

            console.log(
              `[retrieveDesignPatterns] Direct BM25 search added ${newPatterns.length} patterns from layoutQuery: "${dataSignals.layoutQuery.substring(0, 60)}..."`
            );
          }
        }
      } catch (bm25Err) {
        console.warn('[retrieveDesignPatterns] Direct BM25 search failed (non-fatal):', bm25Err);
      }

      return {
        shouldSuspend,
        missingFields,
        message,
        decision,
        designPatterns: designPatterns.length > 0 ? designPatterns : undefined,
        uxGuidelines: uxGuidelines.length > 0 ? [...new Set(uxGuidelines)] : undefined,
      };
    } catch (err) {
      console.error('[retrieveDesignPatterns] Failed to load patterns (non-fatal):', err);
      return {
        shouldSuspend,
        missingFields,
        message,
        decision,
        designPatterns: undefined,
        uxGuidelines: undefined,
      };
    }
  },
});

// Step 5: generateUISpec
const generateUISpecStep = createStep({
  id: 'generateUISpec',
  inputSchema: z.object({
    shouldSuspend: z.boolean(),
    missingFields: z.array(z.string()).optional(),
    message: z.string().optional(),
    decision: z.string(),
    designPatterns: z.array(z.object({
      content: z.string(),
      source: z.string(),
      score: z.number(),
    })).optional(),
    uxGuidelines: z.array(z.string()).optional(),
  }),
  outputSchema: z.object({
    spec_json: z.record(z.any()),
    design_tokens: z.record(z.any()),
  }),
  async execute({ inputData, requestContext, getStepResult, getInitData, suspend, runId }) {
    const { shouldSuspend, missingFields, message, decision } = inputData;
    
    if (shouldSuspend && missingFields && missingFields.length > 0) {
      throw new Error(`INCOMPLETE_MAPPING: ${message || 'Missing required fields'}`);
    }
    
    const templateResult = getStepResult(selectTemplateStep);
    const mappingResult = getStepResult(generateMappingStep);
    
    if (!templateResult || !mappingResult) {
      throw new Error('SPEC_GENERATION_FAILED');
    }
    
    const initData = getInitData() as GeneratePreviewInput;
    const templateId = templateResult.templateId;
    const mappings = mappingResult.mappings;
    const platformType = (requestContext.get("platformType") || 'make') as SelectTemplatePlatformType;
    const selectedStyleBundleId = (requestContext.get("selectedStyleBundleId") || 'professional-clean') as string;

    // Get field analysis and chart recommendations from the new skill-driven mapping
    const fieldAnalysis = (mappingResult as { fieldAnalysis?: unknown }).fieldAnalysis;
    const mappingChartRecs = (mappingResult as { chartRecommendations?: unknown }).chartRecommendations;
    // Phase 2: Extract dataSignals from mapping result
    const mappingDataSignals = (mappingResult as { dataSignals?: unknown }).dataSignals;

    // ── FIX: Load design tokens from DB if missing from RequestContext ────────
    // Mastra workflow execution can lose RequestContext keys during step
    // serialization. The DB is the source of truth for design tokens.
    if (!requestContext.get('designTokens')) {
      console.warn('[generateUISpecStep] designTokens missing from RequestContext — loading from DB');
      const journeyThreadId = requestContext.get('journeyThreadId') as string;
      const supabaseToken = requestContext.get('supabaseAccessToken') as string;
      const stepTenantId = initData.tenantId || requestContext.get('tenantId') as string;

      if (journeyThreadId && supabaseToken && stepTenantId) {
        try {
          const { createAuthenticatedClient } = await import('../lib/supabase');
          const supabase = createAuthenticatedClient(supabaseToken);
          const { data: session } = await supabase
            .from('journey_sessions')
            .select('design_tokens')
            .eq('thread_id', journeyThreadId)
            .eq('tenant_id', stepTenantId)
            .maybeSingle();

          if (session?.design_tokens) {
            requestContext.set('designTokens', JSON.stringify(session.design_tokens));
            requestContext.set('designSystemGenerated', 'true');
            const dbTokens = session.design_tokens as {
              style?: { name?: string };
              colors?: { primary?: string };
            };
            console.log('[generateUISpecStep] ✅ Loaded design tokens from DB:', {
              styleName: dbTokens?.style?.name,
              primary: dbTokens?.colors?.primary,
            });
          } else {
            console.error('[generateUISpecStep] ❌ No design tokens in DB either');
          }
        } catch (dbErr) {
          console.error('[generateUISpecStep] Failed to load design tokens from DB:', dbErr);
        }
      }
    }

    // Wireframe system removed — skeletons provide all layout intelligence
    console.log('[generateUISpecStep] Using skeleton-native layouts (wireframe system deprecated)');

    // Extract intent from journey session's selected proposal for skeleton selection
    const intentTenantId = initData.tenantId || requestContext.get('tenantId') as string;
    const intentSupabaseToken = requestContext.get('supabaseAccessToken') as string;
    let intent = (inputData as { intent?: string }).intent || (requestContext.get('intent') as string) || '';
    if (!intent && intentTenantId && intentSupabaseToken) {
      try {
        const { createAuthenticatedClient } = await import('../lib/supabase');
        const supabase = createAuthenticatedClient(intentSupabaseToken);
        const { data: session } = await supabase
          .from('journey_sessions')
          .select('proposals')
          .eq('tenant_id', intentTenantId)
          .not('proposals', 'is', null)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (session?.proposals && Array.isArray(session.proposals)) {
          // Use the first proposal's description as intent signal
          const selectedProposal = session.proposals[0] as { description?: string };
          if (selectedProposal?.description) {
            intent = selectedProposal.description;
            console.log(`[generateUISpecStep] Extracted intent from proposal: "${intent.slice(0, 80)}..."`);
          }
        }
      } catch (err) {
        // Non-fatal: intent enrichment is optional
        console.warn('[generateUISpecStep] Could not extract intent from proposals:', err);
      }
    }

    const result = await callTool(generateUISpec,
      {
        templateId,
        mappings: mappings,
        platformType,
        selectedStyleBundleId,
        fieldAnalysis,
        chartRecommendations: mappingChartRecs || (() => {
          const dtJson = requestContext.get('designTokens') as string;
          if (dtJson) {
            try { return JSON.parse(dtJson).charts; } catch { return undefined; }
          }
          return undefined;
        })(),
        entityName: (() => {
          const entitiesRaw = requestContext.get('selectedEntities') as string;
          if (!entitiesRaw) return undefined;

          // selectedEntities can be:
          // 1. A JSON array: [{"name":"n8n:Template 2:...","display_name":"..."}]
          // 2. A plain string: "n8n:Template 2: Website Chatbot Analytics Aggregator:execution"
          // 3. Comma-separated: "entity1,entity2"
          // The DB stores it as a plain string (text column, not jsonb).
          try {
            const parsed = JSON.parse(entitiesRaw);
            if (Array.isArray(parsed)) {
              return parsed[0]?.display_name || parsed[0]?.name;
            }
            if (typeof parsed === 'object' && parsed !== null) {
              return parsed.display_name || parsed.name;
            }
          } catch {
            // Not JSON — treat as raw entity string (most common case)
          }

          // Plain string: use first comma-separated value, pass through cleanEntityName later
          const firstEntity = entitiesRaw.split(',')[0].trim();
          return firstEntity || undefined;
        })(),
        // proposalWireframe input removed — no longer used
        // ── Phase 2: Skeleton-aware inputs ──────────────────────────
        dataSignals: mappingDataSignals as any,
        // Phase 3: BM25 design patterns from retrieveDesignPatternsStep
        designPatterns: inputData.designPatterns,
        mode: (requestContext.get('mode') || 'internal') as 'internal' | 'client-facing',
        intent,
      },
      { requestContext }
    );

    // Pre-compute aggregated values from events and bake them into spec_json
    let enrichedSpec = result?.spec_json ?? {};
    try {
      const tenantId = initData.tenantId || requestContext.get('tenantId') as string;
      const interfaceId = initData.interfaceId;
      const supabaseToken = requestContext.get('supabaseAccessToken') as string;

      if (tenantId && interfaceId && supabaseToken) {
        const { createAuthenticatedClient } = await import('../lib/supabase');
        const supabase = createAuthenticatedClient(supabaseToken);
        let events: any[] | null = null;

        // Primary: query by interface_id
        const { data: primaryEvents } = await supabase
          .from('events')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('interface_id', interfaceId)
          .not('type', 'in', '("state","tool_event")')
          .order('created_at', { ascending: false })
          .limit(500);

        events = primaryEvents;

        // Fallback: if interface_id yields 0 events, try source_id
        // This handles the common case where events were ingested before
        // the interface was created (they still have old/null interface_id)
        if ((!events || events.length === 0)) {
          const sourceId = requestContext.get('sourceId') as string | undefined;
          if (sourceId) {
            console.log(`[generateUISpecStep] No events for interface_id=${interfaceId}, falling back to source_id=${sourceId}`);
            const { data: sourceEvents } = await supabase
              .from('events')
              .select('*')
              .eq('tenant_id', tenantId)
              .eq('source_id', sourceId)
              .not('type', 'in', '("state","tool_event")')
              .order('created_at', { ascending: false })
              .limit(500);
            events = sourceEvents;
          }
        }

        if (events && events.length > 0) {
          const flatEvents = events.map((evt: any) => {
            const flat: Record<string, any> = { ...evt };
            if (evt.state && typeof evt.state === 'object') {
              for (const [key, value] of Object.entries(evt.state)) {
                if (flat[key] == null || flat[key] === '') flat[key] = value;
              }
              if (flat.duration_ms != null) flat.duration_ms = Number(flat.duration_ms);
            }
            if (evt.labels && typeof evt.labels === 'object') {
              for (const [key, value] of Object.entries(evt.labels)) {
                if (flat[key] == null || flat[key] === '') flat[key] = value;
              }
            }
            return flat;
          });

          enrichedSpec = transformDataForComponents(enrichedSpec, flatEvents);
          console.log(`[generateUISpecStep] Pre-computed values from ${flatEvents.length} events for ${enrichedSpec.components?.length ?? 0} components`);
        } else {
          console.log('[generateUISpecStep] No events found — spec will have placeholder values');
        }
      }
    } catch (err) {
      console.error('[generateUISpecStep] Event enrichment failed (non-fatal):', err);
    }

    return {
      ...result,
      spec_json: enrichedSpec,
    };
  },
});

// Step 6: Validate Spec
const validateSpecStep = createStep({
  id: 'validateSpec',
  inputSchema: z.object({
    spec_json: z.record(z.any()),
    design_tokens: z.record(z.any()),
  }),
  outputSchema: z.object({
    valid: z.boolean(),
    errors: z.array(z.string()),
    score: z.number(),
  }),
  async execute({ inputData, requestContext, getStepResult, getInitData, suspend, runId }) {
    const spec_json = inputData.spec_json;
    
    const result = await callTool(validateSpec, 
      { spec_json },
      { requestContext }
    );
    if (!result.valid || result.score < 0.8) {
      throw new Error('SCORING_HARD_GATE_FAILED');
    }
    return result;
  },
});

// Step 7: persistPreviewVersion
const persistPreviewVersionStep = createStep({
  id: 'persistPreviewVersion',
  inputSchema: z.object({
    valid: z.boolean(),
    errors: z.array(z.string()),
    score: z.number(),
  }),
  outputSchema: z.object({
    interfaceId: z.string().uuid(),
    versionId: z.string().uuid(),
    previewUrl: z.string(),
  }),
  async execute({ inputData, requestContext, getStepResult, getInitData, suspend, runId }) {
    const initData = getInitData() as GeneratePreviewInput;
    const specResult = getStepResult(generateUISpecStep);
    const spec_json = specResult?.spec_json || {};
    const design_tokens = specResult?.design_tokens || {};
    
    const tenantId = initData.tenantId;
    const userId = initData.userId;
    const interfaceId = initData.interfaceId;
    const platformType = (requestContext.get("platformType") || 'make') as SelectTemplatePlatformType;

    // Ensure requestContext has tenantId/userId for extractTenantContext()
    // The workflow may not propagate these automatically
    if (!requestContext.get('tenantId')) {
      requestContext.set('tenantId', tenantId);
    }
    if (!requestContext.get('userId')) {
      requestContext.set('userId', userId);
    }

    // Only pass fields matching persistPreviewVersion.inputSchema
    // tenantId/userId are read from requestContext by extractTenantContext()
    const result = await callTool(persistPreviewVersion,
      {
        interfaceId,
        spec_json,
        design_tokens,
        platformType,
      },
      { requestContext }
    );
    return result;
  },
});

// Step 8: finalize
const finalizeStep = createStep({
  id: 'finalize',
  inputSchema: z.object({
    interfaceId: z.string().uuid(),
    versionId: z.string().uuid(),
    previewUrl: z.string(),
  }),
  outputSchema: GeneratePreviewOutput,
  async execute({ inputData, requestContext, getStepResult, getInitData, suspend, runId }) {
    const persistResult = inputData;
    return {
      runId,
      previewVersionId: persistResult.versionId,
      previewUrl: persistResult.previewUrl,
      interfaceId: persistResult.interfaceId,
    };
  },
});

// Workflow definition
export const generatePreviewWorkflow = createWorkflow({
  id: 'generatePreview',
  inputSchema: GeneratePreviewInput,
  outputSchema: GeneratePreviewOutput,
})
  .then(analyzeSchemaStep)
  .then(selectTemplateStep)
  .then(generateMappingStep)
  .then(checkMappingCompletenessStep)
  .then(retrieveDesignPatternsStep)   // Phase 3: BM25 intelligence
  .then(generateUISpecStep)
  .then(validateSpecStep)
  .then(persistPreviewVersionStep)
  .then(finalizeStep)
  .commit();
