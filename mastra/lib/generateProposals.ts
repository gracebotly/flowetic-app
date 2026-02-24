// mastra/lib/generateProposals.ts
// ============================================================================
// Parallel proposal generator for the 2-phase journey.
//
// Orchestrates:
// 1. classifyArchetype() — pure logic, <1ms
// 2. 3× designSystemWorkflow — parallel execution with variety parameters
// 3. buildWireframeLayout() — deterministic layout generation per blend
// 4. Assembly into Proposal[] for persistence + streaming to frontend
//
// Called from: route.ts handleDeterministicPropose() (Wave 3)
// Persists to: journey_sessions.proposals (JSONB)
// ============================================================================

import type {
  Archetype,
  EmphasisBlend,
  Proposal,
  ProposalDesignSystem,
  ProposalsPayload,
  WireframeComponent,
  WireframeLayout,
} from '@/types/proposal';
import { classifyArchetype, ARCHETYPE_TITLE_TEMPLATES } from './classifyArchetype';

// ─── Data Availability Assessment ─────────────────────────────────────────
// Queries actual event data BEFORE generating proposals to ensure
// proposals only promise what the data can deliver.

interface DataAvailability {
  totalEvents: number;
  eventTypes: string[];
  availableFields: string[];
  fieldShapes: Record<string, 'status' | 'timestamp' | 'duration' | 'identifier' | 'text' | 'numeric'>;
  dataRichness: 'rich' | 'moderate' | 'sparse' | 'minimal';
  canSupportTimeseries: boolean;
  canSupportBreakdowns: boolean;
  usableFieldCount: number;
}

function inferFieldShape(fieldName: string, sampleValue: unknown): DataAvailability['fieldShapes'][string] {
  const name = fieldName.toLowerCase();
  if (name.includes('status') || name.includes('state') || name.includes('result') || name.includes('outcome')) return 'status';
  if (name.includes('_at') || name.includes('time') || name.includes('date') || name.includes('timestamp')) return 'timestamp';
  if (name.includes('duration') || name.includes('elapsed') || name.includes('_ms') || name.includes('_seconds')) return 'duration';
  if (name.includes('_id') || name === 'id') return 'identifier';
  if (typeof sampleValue === 'number') return 'numeric';
  return 'text';
}

function humanizeLabel(fieldName: string): string {
  return fieldName
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, c => c.toUpperCase());
}

async function assessDataAvailability(
  supabase: any,
  tenantId: string,
  sourceId?: string,
): Promise<DataAvailability> {
  try {
    let query = supabase
      .from('events')
      .select('type, labels, state, timestamp', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('timestamp', { ascending: false })
      .limit(50);

    if (sourceId) {
      query = query.eq('source_id', sourceId);
    }

    const { data: events, count } = await query;
    const totalEvents = typeof count === 'number' ? count : (events?.length ?? 0);

    if (!events || events.length === 0) {
      return {
        totalEvents: 0,
        eventTypes: [],
        availableFields: [],
        fieldShapes: {},
        dataRichness: 'minimal',
        canSupportTimeseries: false,
        canSupportBreakdowns: false,
        usableFieldCount: 0,
      };
    }

    const eventTypes = [...new Set(events.map((e: any) => e.type).filter(Boolean))] as string[];
    const fieldSet = new Set<string>();
    const fieldSamples: Record<string, unknown> = {};

    for (const event of events) {
      if (event.labels && typeof event.labels === 'object') {
        for (const [key, value] of Object.entries(event.labels)) {
          fieldSet.add(key);
          if (!fieldSamples[key]) fieldSamples[key] = value;
        }
      }
      if (event.state && typeof event.state === 'object') {
        for (const [key, value] of Object.entries(event.state)) {
          fieldSet.add(key);
          if (!fieldSamples[key]) fieldSamples[key] = value;
        }
      }
    }

    const availableFields = [...fieldSet];
    const fieldShapes: Record<string, DataAvailability['fieldShapes'][string]> = {};
    for (const field of availableFields) {
      fieldShapes[field] = inferFieldShape(field, fieldSamples[field]);
    }

    const timestampFields = availableFields.filter(f => fieldShapes[f] === 'timestamp');
    const statusFields = availableFields.filter(f => fieldShapes[f] === 'status');
    const usableFieldCount = availableFields.filter(f => fieldShapes[f] !== 'identifier').length;

    const canSupportTimeseries = timestampFields.length > 0 || totalEvents >= 5;
    const canSupportBreakdowns = statusFields.length > 0 || eventTypes.length > 1;

    let dataRichness: DataAvailability['dataRichness'];
    if (usableFieldCount >= 10 && eventTypes.length >= 3) {
      dataRichness = 'rich';
    } else if (usableFieldCount >= 6 && eventTypes.length >= 2) {
      dataRichness = 'moderate';
    } else if (usableFieldCount >= 3 || totalEvents >= 5) {
      dataRichness = 'sparse';
    } else {
      dataRichness = 'minimal';
    }

    return {
      totalEvents,
      eventTypes,
      availableFields,
      fieldShapes,
      dataRichness,
      canSupportTimeseries,
      canSupportBreakdowns,
      usableFieldCount,
    };
  } catch (err) {
    console.error('[assessDataAvailability] Error querying events:', err);
    return {
      totalEvents: 0,
      eventTypes: [],
      availableFields: [],
      fieldShapes: {},
      dataRichness: 'minimal',
      canSupportTimeseries: false,
      canSupportBreakdowns: false,
      usableFieldCount: 0,
    };
  }
}

// ─── Types for workflow integration ───────────────────────────────────────

interface DesignSystemWorkflowInput {
  workflowName: string;
  platformType: string;
  selectedOutcome: string;
  selectedEntities: string;
  tenantId: string;
  userId: string;
  userFeedback?: string;
  excludeStyleNames?: string[];
  excludeColorHexValues?: string[];
}

interface DesignSystemResult {
  designSystem: ProposalDesignSystem;
  reasoning: string;
}

interface GenerateProposalsInput {
  workflowName: string;
  platformType: string;
  selectedEntities: string;
  tenantId: string;
  userId: string;
  /** Mastra instance — used to get the designSystemWorkflow */
  mastra: any;
  /** Optional RequestContext to pass through to workflow runs */
  requestContext?: any;
  /** Supabase client for data availability queries */
  supabase?: any;
  /** Source ID to scope event queries */
  sourceId?: string;
}

interface GenerateProposalsResult {
  success: boolean;
  proposals: Proposal[];
  payload: ProposalsPayload;
  archetype: Archetype;
  error?: string;
  /** Timing info for observability */
  timing: {
    classifyMs: number;
    designSystemMs: number;
    totalMs: number;
  };
}

// ─── Wireframe layout generation ──────────────────────────────────────────
// Deterministic: given an emphasis blend and entity names, produce a
// component layout. No LLM calls — pure layout logic.

function buildWireframeLayout(
  blend: EmphasisBlend,
  entities: string[],
  proposalIndex: number,
  dataAvailability?: DataAvailability | null,
): WireframeLayout {
  const components: WireframeComponent[] = [];
  let entityLabels: string[];
  if (dataAvailability && dataAvailability.usableFieldCount > 0) {
    const shapes = dataAvailability.fieldShapes;
    const labels: string[] = [];
    const statusField = dataAvailability.availableFields.find(f => shapes[f] === 'status');
    const durationField = dataAvailability.availableFields.find(f => shapes[f] === 'duration');
    const timestampField = dataAvailability.availableFields.find(f => shapes[f] === 'timestamp');
    const numericField = dataAvailability.availableFields.find(f => shapes[f] === 'numeric');

    if (statusField) labels.push('Success Rate');
    if (durationField) labels.push('Avg Duration');
    if (timestampField) labels.push('Runs Over Time');
    if (numericField) labels.push(humanizeLabel(numericField));
    if (labels.length === 0) labels.push('Total Events');

    while (labels.length < 3) labels.push(`Metric ${labels.length + 1}`);
    entityLabels = labels;
  } else {
    entityLabels = entities.length > 0
      ? entities
      : ['Metric 1', 'Metric 2', 'Metric 3'];
  }

  // Dominant emphasis determines the layout pattern
  const dominant = blend.dashboard >= blend.product && blend.dashboard >= blend.analytics
    ? 'dashboard'
    : blend.product >= blend.analytics
      ? 'product'
      : 'analytics';

  if (dominant === 'dashboard') {
    // Dashboard-dominant: KPI row → line chart → bar chart → table
    const kpiCount = Math.min(entityLabels.length, 4);
    const kpiWidth = Math.floor(12 / kpiCount);

    for (let i = 0; i < kpiCount; i++) {
      components.push({
        id: `kpi-${i}`,
        type: 'kpi',
        label: entityLabels[i] || `KPI ${i + 1}`,
        layout: { col: i * kpiWidth, row: 0, w: kpiWidth, h: 1 },
      });
    }

    components.push({
      id: 'trend-chart',
      type: 'line_chart',
      label: `${entityLabels[0] || 'Primary'} Over Time`,
      layout: { col: 0, row: 1, w: 8, h: 2 },
    });

    components.push({
      id: 'breakdown',
      type: 'bar_chart',
      label: 'Breakdown by Type',
      layout: { col: 8, row: 1, w: 4, h: 2 },
    });

    components.push({
      id: 'data-table',
      type: 'table',
      label: 'Recent Activity',
      layout: { col: 0, row: 3, w: 12, h: 2 },
    });

    return { name: 'Dashboard Grid', components };
  }

  if (dominant === 'product') {
    // Product-dominant: hero metric → action cards → status list
    components.push({
      id: 'hero-metric',
      type: 'kpi',
      label: entityLabels[0] || 'Primary Metric',
      layout: { col: 0, row: 0, w: 6, h: 2 },
    });

    components.push({
      id: 'secondary-metric',
      type: 'kpi',
      label: entityLabels[1] || 'Secondary Metric',
      layout: { col: 6, row: 0, w: 6, h: 2 },
    });

    components.push({
      id: 'main-chart',
      type: proposalIndex === 1 ? 'bar_chart' : 'line_chart',
      label: `${entityLabels[0] || 'Performance'} Trend`,
      layout: { col: 0, row: 2, w: 7, h: 2 },
    });

    components.push({
      id: 'status-list',
      type: 'status_grid',
      label: 'Status Overview',
      layout: { col: 7, row: 2, w: 5, h: 2 },
    });

    return { name: 'Client Portal', components };
  }

  // Analytics-dominant: dense data layout
  components.push({
    id: 'summary-kpi-1',
    type: 'kpi',
    label: entityLabels[0] || 'Total Volume',
    layout: { col: 0, row: 0, w: 3, h: 1 },
  });

  components.push({
    id: 'summary-kpi-2',
    type: 'kpi',
    label: entityLabels[1] || 'Success Rate',
    layout: { col: 3, row: 0, w: 3, h: 1 },
  });

  components.push({
    id: 'summary-kpi-3',
    type: 'kpi',
    label: entityLabels[2] || 'Avg Duration',
    layout: { col: 6, row: 0, w: 3, h: 1 },
  });

  components.push({
    id: 'summary-kpi-4',
    type: 'kpi',
    label: 'Anomalies',
    layout: { col: 9, row: 0, w: 3, h: 1 },
  });

  components.push({
    id: 'main-trend',
    type: 'line_chart',
    label: 'Trend Analysis',
    layout: { col: 0, row: 1, w: 6, h: 2 },
  });

  components.push({
    id: 'distribution',
    type: 'pie_chart',
    label: 'Distribution',
    layout: { col: 6, row: 1, w: 6, h: 2 },
  });

  components.push({
    id: 'detail-table',
    type: 'table',
    label: 'Detailed Records',
    layout: { col: 0, row: 3, w: 12, h: 2 },
  });

  return { name: 'Analytics Deep-Dive', components };
}

// ─── Pitch text generation ────────────────────────────────────────────────

function generatePitch(blend: EmphasisBlend, archetype: Archetype): string {
  const dominant = blend.dashboard >= blend.product && blend.dashboard >= blend.analytics
    ? 'dashboard'
    : blend.product >= blend.analytics
      ? 'product'
      : 'analytics';

  const pitches: Record<string, string> = {
    dashboard: 'Real-time monitoring with live KPIs, trend charts, and status overviews. Built for internal ops teams who need instant visibility.',
    product: 'Clean, client-facing interface with branded styling and clear actions. Built to showcase your service value to clients.',
    analytics: 'Data-dense analytics with drill-down capability, detailed tables, and multi-metric views. Built for teams that need deep insights.',
  };

  return pitches[dominant] || pitches.dashboard;
}

// ─── Outcome hint per blend ───────────────────────────────────────────────

function blendToOutcomeHint(blend: EmphasisBlend): string {
  if (blend.product >= 0.5) return 'product';
  if (blend.analytics >= 0.5) return 'analytics dashboard deep data';
  return 'dashboard monitoring ops';
}

// ─── Normalize design system from workflow output ─────────────────────────

function normalizeDesignSystem(raw: any): ProposalDesignSystem {
  return {
    style: {
      name: raw.style?.name || 'Professional',
      type: raw.style?.type || 'Modern',
      keywords: raw.style?.keywords,
      effects: raw.style?.effects,
    },
    colors: {
      primary: raw.colors?.primary || '#3B82F6',
      secondary: raw.colors?.secondary || '#6366F1',
      accent: raw.colors?.accent || '#8B5CF6',
      success: raw.colors?.success || '#10B981',
      warning: raw.colors?.warning || '#F59E0B',
      error: raw.colors?.error || '#EF4444',
      background: raw.colors?.background || '#FFFFFF',
      text: raw.colors?.text || '#0F172A',
    },
    fonts: {
      heading: raw.fonts?.heading || raw.typography?.headingFont || 'Inter, sans-serif',
      body: raw.fonts?.body || raw.typography?.bodyFont || 'Inter, sans-serif',
      googleFontsUrl: raw.fonts?.googleFontsUrl,
    },
    charts: Array.isArray(raw.charts) ? raw.charts : [],
    spacing: raw.spacing || { unit: 8 },
    radius: raw.radius ?? 8,
    shadow: raw.shadow || '0 1px 3px rgba(0,0,0,0.1)',
  };
}

// ─── Main: Generate 3 proposals in parallel ───────────────────────────────

export async function generateProposals(
  input: GenerateProposalsInput,
): Promise<GenerateProposalsResult> {
  const totalStart = Date.now();

  // Step 1: Classify archetype (pure logic, <1ms)
  const classifyStart = Date.now();
  const classification = classifyArchetype(
    input.workflowName,
    input.platformType,
    input.selectedEntities,
  );
  const classifyMs = Date.now() - classifyStart;

  console.log('[generateProposals] Archetype:', {
    archetype: classification.archetype,
    confidence: classification.confidence,
    signals: classification.matchedSignals,
  });

  let dataAvailability: DataAvailability | null = null;
  let proposalCount = 3;

  if (input.supabase) {
    dataAvailability = await assessDataAvailability(
      input.supabase,
      input.tenantId,
      input.sourceId,
    );

    console.log(`[generateProposals] Data availability: ${dataAvailability.dataRichness} — ${dataAvailability.totalEvents} events, ${dataAvailability.usableFieldCount} usable fields, types: [${dataAvailability.eventTypes.join(', ')}]`);

    switch (dataAvailability.dataRichness) {
      case 'minimal':
        proposalCount = 1;
        break;
      case 'sparse':
        proposalCount = 2;
        break;
      case 'moderate':
        proposalCount = Math.min(3, dataAvailability.eventTypes.length >= 2 ? 3 : 2);
        break;
      case 'rich':
        proposalCount = 3;
        break;
    }

    console.log(`[generateProposals] Will generate ${proposalCount} proposals (data richness: ${dataAvailability.dataRichness})`);
  }

  // Step 2: Get the design system workflow
  const workflow = input.mastra?.getWorkflow?.('designSystemWorkflow');
  if (!workflow) {
    return {
      success: false,
      proposals: [],
      payload: {
        proposals: [],
        generatedAt: new Date().toISOString(),
        context: {
          workflowName: input.workflowName,
          platformType: input.platformType,
          selectedEntities: input.selectedEntities,
          archetype: classification.archetype,
        },
      },
      archetype: classification.archetype,
      error: 'designSystemWorkflow not found in Mastra registry',
      timing: { classifyMs, designSystemMs: 0, totalMs: Date.now() - totalStart },
    };
  }

  // Step 3: Run 3 design system workflows sequentially with variety params
  const dsStart = Date.now();
  const entities = input.selectedEntities
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);

  // Each run gets different feedback hint to shift BM25 ranking
  const feedbackHints = [
    `${classification.archetype} monitoring operations professional`,
    `${classification.archetype} client-facing branded premium`,
    `${classification.archetype} analytics data-dense detailed`,
  ];

  // ── Run 3 design system workflows SEQUENTIALLY ──────────────────────
  //
  // WHY SEQUENTIAL (not parallel):
  // Each workflow's synthesize step calls designAdvisorAgent.generate(),
  // which hits the Gemini API. Running 3 parallel LLM calls to the same
  // API key caused the 3rd call to hang indefinitely — Gemini's rate
  // limit doesn't return 429, the connection just stalls. This was the
  // root cause of the 504 timeout: Promise.allSettled waited forever
  // for a promise that would never resolve.
  //
  // Sequential execution adds ~20-30s but guarantees every call gets a
  // clean API window. 45s that completes > 15s that times out at 300s.
  //
  // FUTURE OPTIMIZATION: Split gather (BM25, no LLM) from synthesis
  // (LLM). Run 3 gathers in parallel, then 3 syntheses sequentially.

  const proposals: Proposal[] = [];
  const titles = classification.titleTemplates;

  for (let index = 0; index < Math.min(classification.blendPresets.length, proposalCount); index++) {
    const blend = classification.blendPresets[index];
    const title = titles[index] || `Proposal ${index + 1}`;
    const workflowStart = Date.now();

    try {
      const run = await workflow.createRun();
      const result = await run.start({
        inputData: {
          workflowName: input.workflowName,
          platformType: input.platformType,
          selectedOutcome: blendToOutcomeHint(blend),
          selectedEntities: input.selectedEntities,
          tenantId: input.tenantId,
          userId: input.userId,
          userFeedback: feedbackHints[index],
          // Exclude previous results to ensure variety
          excludeStyleNames: index > 0
            ? feedbackHints.slice(0, index)
            : undefined,
        },
        requestContext: input.requestContext,
      } as any);

      const elapsed = Date.now() - workflowStart;

      if (result.status === 'success' && result.result) {
        const data = result.result as any;
        console.log(`[generateProposals] Workflow ${index} ✅ completed in ${elapsed}ms — "${data.designSystem?.style?.name || 'unnamed'}"`);
        proposals.push({
          index,
          title,
          pitch: generatePitch(blend, classification.archetype),
          archetype: classification.archetype,
          emphasisBlend: blend,
          designSystem: normalizeDesignSystem(data.designSystem),
          wireframeLayout: buildWireframeLayout(blend, entities, index, dataAvailability),
          reasoning: data.reasoning || '',
        });
      } else {
        console.error(`[generateProposals] Workflow ${index} ❌ failed (status: ${result.status}) in ${elapsed}ms — this should not happen with sequential execution. Check Gemini API key and model availability.`);
        proposals.push({
          index,
          title,
          pitch: generatePitch(blend, classification.archetype),
          archetype: classification.archetype,
          emphasisBlend: blend,
          designSystem: normalizeDesignSystem({}),
          wireframeLayout: buildWireframeLayout(blend, entities, index, dataAvailability),
          reasoning: 'Design system generation encountered an error. Please try regenerating.',
        });
      }
    } catch (err: any) {
      const elapsed = Date.now() - workflowStart;
      console.error(`[generateProposals] Workflow ${index} ❌ error after ${elapsed}ms:`, err?.message);
      proposals.push({
        index,
        title,
        pitch: generatePitch(blend, classification.archetype),
        archetype: classification.archetype,
        emphasisBlend: blend,
        designSystem: normalizeDesignSystem({}),
        wireframeLayout: buildWireframeLayout(blend, entities, index, dataAvailability),
        reasoning: 'Design system generation encountered an error. Please try regenerating.',
      });
    }
  }

  const dsMs = Date.now() - dsStart;
  const successCount = proposals.filter(p => p.reasoning && !p.reasoning.includes('error')).length;
  console.log(`[generateProposals] All 3 design workflows completed in ${dsMs}ms (${successCount}/3 succeeded)`);

  const payload: ProposalsPayload = {
    proposals,
    generatedAt: new Date().toISOString(),
    context: {
      workflowName: input.workflowName,
      platformType: input.platformType,
      selectedEntities: input.selectedEntities,
      archetype: classification.archetype,
      dataAvailability: dataAvailability || undefined,
    },
  };

  const totalMs = Date.now() - totalStart;
  console.log(`[generateProposals] ✅ Generated ${proposals.length}/${proposalCount} proposals in ${totalMs}ms (data: ${dataAvailability?.dataRichness ?? 'unknown'})`);

  return {
    success: true,
    proposals,
    payload,
    archetype: classification.archetype,
    timing: { classifyMs, designSystemMs: dsMs, totalMs },
  };
}
