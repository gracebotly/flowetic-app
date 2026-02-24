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
): WireframeLayout {
  const components: WireframeComponent[] = [];
  const entityLabels = entities.length > 0
    ? entities
    : ['Metric 1', 'Metric 2', 'Metric 3'];

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

  // Step 3: Run 3 design system workflows in parallel with variety params
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

  const workflowPromises = classification.blendPresets.map(async (blend, index) => {
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

      if (result.status === 'success' && result.result) {
        const data = result.result as any;
        return {
          success: true,
          designSystem: data.designSystem,
          reasoning: data.reasoning || '',
        } as DesignSystemResult & { success: true };
      }

      console.warn(`[generateProposals] Workflow ${index} failed:`, result.status);
      return { success: false as const, index };
    } catch (err: any) {
      console.error(`[generateProposals] Workflow ${index} error:`, err?.message);
      return { success: false as const, index };
    }
  });

  const results = await Promise.allSettled(workflowPromises);
  const dsMs = Date.now() - dsStart;

  console.log(`[generateProposals] Design workflows completed in ${dsMs}ms`);

  // Step 4: Assemble proposals from results
  const proposals: Proposal[] = [];
  const titles = classification.titleTemplates;

  for (let i = 0; i < classification.blendPresets.length; i++) {
    const result = results[i];
    const blend = classification.blendPresets[i];
    const title = titles[i] || `Proposal ${i + 1}`;

    if (result.status === 'fulfilled' && (result.value as any).success) {
      const ds = (result.value as any) as DesignSystemResult;

      proposals.push({
        index: i,
        title,
        pitch: generatePitch(blend, classification.archetype),
        archetype: classification.archetype,
        emphasisBlend: blend,
        designSystem: normalizeDesignSystem(ds.designSystem),
        wireframeLayout: buildWireframeLayout(blend, entities, i),
        reasoning: ds.reasoning,
      });
    } else {
      // Fallback: still create a proposal with default design tokens
      // This ensures the user always sees 3 cards even if one workflow fails
      console.warn(`[generateProposals] Using fallback for proposal ${i}`);
      proposals.push({
        index: i,
        title,
        pitch: generatePitch(blend, classification.archetype),
        archetype: classification.archetype,
        emphasisBlend: blend,
        designSystem: normalizeDesignSystem({}),
        wireframeLayout: buildWireframeLayout(blend, entities, i),
        reasoning: 'Generated with default design tokens (workflow fallback).',
      });
    }
  }

  const payload: ProposalsPayload = {
    proposals,
    generatedAt: new Date().toISOString(),
    context: {
      workflowName: input.workflowName,
      platformType: input.platformType,
      selectedEntities: input.selectedEntities,
      archetype: classification.archetype,
    },
  };

  const totalMs = Date.now() - totalStart;
  console.log(`[generateProposals] ✅ Generated ${proposals.length} proposals in ${totalMs}ms`);

  return {
    success: true,
    proposals,
    payload,
    archetype: classification.archetype,
    timing: { classifyMs, designSystemMs: dsMs, totalMs },
  };
}
