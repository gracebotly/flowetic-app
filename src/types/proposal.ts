// src/types/proposal.ts
// ============================================================================
// Shared types for the 2-phase journey proposal system.
// Used by: classifyArchetype, generateProposals, ProposalCard, ProposalGallery,
//          chat-workspace, route.ts, and the journey_sessions.proposals column.
// ============================================================================

/**
 * Emphasis blend — replaces rigid 'dashboard' | 'product' | 'analytics' categories.
 * Every proposal is a weighted MIX, not a discrete type.
 *
 * Example: An n8n lead-tracking workflow might produce:
 *   Proposal A: { dashboard: 0.8, product: 0.2, analytics: 0.0 }  → "Ops-focused"
 *   Proposal B: { dashboard: 0.3, product: 0.7, analytics: 0.0 }  → "Client-facing"
 *   Proposal C: { dashboard: 0.4, product: 0.0, analytics: 0.6 }  → "Deep analytics"
 */
export interface EmphasisBlend {
  /** Monitoring, status, internal ops — percentage 0-1 */
  dashboard: number;
  /** Client-facing, branded, action-oriented — percentage 0-1 */
  product: number;
  /** Data-dense, drill-down, BI-style — percentage 0-1 */
  analytics: number;
}

/**
 * Archetype — high-level classification of what the workflow "is."
 * Determined from workflow name signals, event patterns, and platform type.
 * Used to decide HOW to blend proposals, not WHICH category to force.
 */
export type Archetype =
  | 'ops_monitoring'     // Error rates, uptime, execution status
  | 'lead_pipeline'      // CRM, lead tracking, conversion funnels
  | 'voice_analytics'    // Call metrics, sentiment, agent performance
  | 'content_automation' // Social media, email campaigns, publishing
  | 'data_integration'   // ETL, sync, data warehouse
  | 'client_reporting'   // White-label, client-facing dashboards
  | 'general';           // Fallback when signals are ambiguous

/**
 * Wireframe layout description — what goes where in the dashboard.
 * This is the "spatial story" of the proposal.
 */
export interface WireframeLayout {
  /** Human-readable layout name, e.g. "Funnel Pipeline" or "Grid Ops" */
  name: string;
  /** 12-column grid component positions */
  components: WireframeComponent[];
}

export interface WireframeComponent {
  id: string;
  /** Display type for the wireframe thumbnail */
  type: 'kpi' | 'line_chart' | 'bar_chart' | 'pie_chart' | 'table' | 'funnel' | 'timeline' | 'status_grid';
  /** Human label shown in the wireframe, e.g. "Lead Conversion Rate" */
  label: string;
  /** Grid position */
  layout: { col: number; row: number; w: number; h: number };
}

/**
 * Design system snapshot — the colors, fonts, and style metadata for one proposal.
 * This is the same shape as what designSystemWorkflow produces, normalized.
 */
export interface ProposalDesignSystem {
  style: {
    name: string;
    type: string;
    keywords?: string;
    effects?: string;
  };
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    success?: string;
    warning?: string;
    error?: string;
    background: string;
    text?: string;
  };
  fonts: {
    heading: string;
    body: string;
    googleFontsUrl?: string;
  };
  charts?: Array<{ type: string; bestFor: string }>;
  spacing?: { unit: number };
  radius?: number;
  shadow?: string;
}

/**
 * A single proposal — one of 2-3 options presented to the user.
 * Stored in journey_sessions.proposals as a JSONB array.
 */
export interface Proposal {
  /** Index in the proposals array (0, 1, 2) */
  index: number;
  /** Human-readable title, e.g. "Ops Command Center" */
  title: string;
  /** 1-2 sentence pitch for this proposal */
  pitch: string;
  /** The archetype that drove this proposal's generation */
  archetype: Archetype;
  /** Emphasis blend — weighted mix of dashboard/product/analytics DNA */
  emphasisBlend: EmphasisBlend;
  /** Full design system tokens */
  designSystem: ProposalDesignSystem;
  /** Wireframe layout for thumbnail rendering */
  wireframeLayout: WireframeLayout;
  /** Why the AI chose this combination (shown on hover/expand) */
  reasoning: string;
}

/**
 * The full proposals payload stored in journey_sessions.proposals JSONB column.
 */
export interface ProposalsPayload {
  /** The 2-3 generated proposals */
  proposals: Proposal[];
  /** Timestamp of generation */
  generatedAt: string;
  /** Context used to generate (for debugging / regeneration) */
  context: {
    workflowName: string;
    platformType: string;
    selectedEntities: string;
    archetype: Archetype;
  };
}
