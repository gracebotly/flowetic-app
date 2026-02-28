// mastra/lib/layout/skeletons.ts
//
// 11 deterministic layout skeletons for premium UI generation.
//
// Philosophy: "Premium UI is 80% structure, 20% styling. We lock the 80%."
//
// The LLM decides: Which metrics matter, which charts to use, widget titles,
// data emphasis, narrative flow.
//
// The LLM CANNOT: Invent grid structure, rearrange sections, create arbitrary
// nesting, override skeleton architecture.
//
// Result: 11 deterministic skeletons × 7 platforms × 4 density ranges ×
// 48 style bundles × 3 spacing presets × 6 outcome modes =
// ~120,000+ unique dashboard combinations before data content variation.

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * All 11 skeleton identifiers.
 * Dashboard (A-E), Product (F-H), Admin (I-K)
 */
export type SkeletonId =
  | 'executive-overview'        // A: KPI-dominant, Stripe Analytics
  | 'operational-monitoring'    // B: Real-time, Vercel/DevOps
  | 'analytical-breakdown'     // C: Deep-dive, Mixpanel/Amplitude
  | 'table-first'              // D: Data-heavy, internal ops
  | 'storyboard-insight'       // E: Client portal, Linear Insights
  | 'record-browser'           // L: Hybrid records + metrics
  | 'saas-landing-page'        // F: Product marketing
  | 'workflow-input-form'      // G: Multi-step wizard
  | 'results-display'          // H: Workflow output display
  | 'admin-crud-panel'         // I: CRUD management
  | 'settings-dashboard'       // J: Settings/preferences
  | 'authentication-flow';     // K: Login/signup/reset

export type SkeletonCategory = 'dashboard' | 'product' | 'admin';

export type SpacingPreset = 'compact' | 'comfortable' | 'narrative';

export type GridSystem =
  | '12-column'         // Standard symmetric
  | 'asymmetric-40-60'  // Operational monitoring (status | trend)
  | 'table-optimized'   // Table-first (minimal chrome)
  | 'flexible'          // Storyboard (varies per section)
  | 'sidebar-content'   // Settings (sidebar | content area)
  | 'split-40-60';      // Auth (form | brand visual)

/**
 * Section types — the building blocks skeletons are made of.
 * Each section type maps to a specific component builder in generateUISpec.ts (Phase 2).
 */
export type SectionType =
  // Dashboard sections
  | 'kpi-grid'
  | 'chart'
  | 'chart-grid'
  | 'table'
  | 'feed'
  | 'insight-card'
  | 'filters'
  | 'record-list'
  | 'content-panel'
  // Product page sections
  | 'hero'
  | 'proof-bar'
  | 'feature-grid'
  | 'pricing'
  | 'cta'
  | 'progress-bar'
  | 'form-step'
  | 'form-nav'
  | 'success-banner'
  | 'results-hero'
  | 'results-cards'
  | 'actions-bar'
  // Admin sections
  | 'page-header'
  | 'filter-bar'
  | 'crud-table'
  | 'pagination'
  | 'settings-sidebar'
  | 'settings-forms'
  | 'danger-zone'
  | 'auth-form'
  | 'brand-visual';

/**
 * A single section slot within a skeleton.
 * Defines what goes in this area and its spatial constraints.
 */
export interface SkeletonSection {
  /** Unique ID within the skeleton (e.g., 'hero-kpis', 'primary-chart') */
  id: string;
  /** What type of content this section holds */
  type: SectionType;
  /** Grid column span (out of 12). Default: 12 (full width) */
  columns: number;
  /** Whether this is the visually dominant section */
  dominant: boolean;
  /** Max items allowed in this section (e.g., maxKPIs for kpi-grid) */
  maxItems?: number;
  /** Whether this section is compact (tighter spacing) */
  compact?: boolean;
  /** Minimum height in grid rows */
  minHeight?: number;
  /** Optional description for observability logs */
  description?: string;
}

/**
 * Responsive breakpoint behavior per skeleton.
 */
export interface BreakpointBehavior {
  /** Mobile: 320-767px */
  mobile: {
    /** Stack all sections vertically */
    stackSections: boolean;
    /** Hide these section IDs on mobile */
    hideSections?: string[];
    /** Override columns for specific sections */
    columnOverrides?: Record<string, number>;
  };
  /** Tablet: 768-1023px */
  tablet: {
    /** Stack sections or keep side-by-side */
    stackSections: boolean;
    /** Override columns for specific sections */
    columnOverrides?: Record<string, number>;
  };
  /** Desktop: 1024px+ — uses skeleton defaults */
  desktop: Record<string, never>;
}

/**
 * Complete layout skeleton definition.
 * This is the blueprint that generateUISpec.ts (Phase 2) uses to build components.
 */
export interface LayoutSkeleton {
  /** Unique skeleton identifier */
  id: SkeletonId;
  /** Human-readable name */
  name: string;
  /** Short description for logs and metadata */
  description: string;
  /** Category determines which builder function handles it */
  category: SkeletonCategory;
  /** Personality reference (what premium product this evokes) */
  personality: string;
  /** Ordered array of section slots — this IS the layout */
  sections: SkeletonSection[];
  /** Spacing between sections */
  spacing: SpacingPreset;
  /** Which section ID is the visual focal point */
  visualHierarchy: string;
  /** Max KPI cards allowed (enforced by autoFixer in Phase 4) */
  maxKPIs: number;
  /** Grid system type */
  gridSystem: GridSystem;
  /** Responsive behavior rules */
  breakpoints: BreakpointBehavior;
  /** Spacing value in pixels (used by generateUISpec for gap calculation) */
  spacingPx: number;
  /**
   * Maximum number of secondary (non-dominant) chart components allowed.
   * The builder will stop emitting chart sections after this count.
   * Prevents chart spam on data-rich inputs.
   * Set to 0 for non-dashboard skeletons that don't have chart sections.
   */
  maxSecondaryCharts: number;
}

// ============================================================================
// Dashboard Skeletons (A-E)
// ============================================================================

const executiveOverview: LayoutSkeleton = {
  id: 'executive-overview',
  name: 'Executive Overview',
  description: 'KPI-dominant layout for C-suite monitoring. Clean, investor-ready.',
  category: 'dashboard',
  personality: 'Stripe Analytics',
  sections: [
    {
      id: 'hero-kpis',
      type: 'kpi-grid',
      columns: 12,
      dominant: false,
      maxItems: 5,
      compact: false,
      minHeight: 2,
      description: '3-5 hero metrics, balanced, prominent',
    },
    {
      id: 'primary-chart',
      type: 'chart',
      columns: 12,
      dominant: true,
      minHeight: 4,
      description: 'Full-width primary chart, annotated',
    },
    {
      id: 'breakdown-left',
      type: 'chart',
      columns: 6,
      dominant: false,
      minHeight: 4,
      description: 'Breakdown chart (pie/donut)',
    },
    {
      id: 'breakdown-right',
      type: 'chart',
      columns: 6,
      dominant: false,
      minHeight: 4,
      description: 'Status distribution chart',
    },
    {
      id: 'activity-table',
      type: 'table',
      columns: 12,
      dominant: false,
      minHeight: 4,
      description: 'Bottom activity table, detail view',
    },
  ],
  spacing: 'comfortable',
  visualHierarchy: 'primary-chart',
  maxKPIs: 5,
  gridSystem: '12-column',
  spacingPx: 24,
  maxSecondaryCharts: 2,  // 1 primary + 2 breakdowns (left/right) — 5-section skeleton
  breakpoints: {
    mobile: {
      stackSections: true,
      columnOverrides: {
        'breakdown-left': 12,
        'breakdown-right': 12,
      },
    },
    tablet: {
      stackSections: false,
      columnOverrides: {
        'breakdown-left': 6,
        'breakdown-right': 6,
      },
    },
    desktop: {},
  },
};

const operationalMonitoring: LayoutSkeleton = {
  id: 'operational-monitoring',
  name: 'Operational Monitoring',
  description: 'Real-time monitoring with status indicators and event feeds.',
  category: 'dashboard',
  personality: 'Vercel/DevOps Monitoring',
  sections: [
    {
      id: 'compact-kpis',
      type: 'kpi-grid',
      columns: 12,
      dominant: false,
      maxItems: 4,
      compact: true,
      minHeight: 2,
      description: 'Compact 2x2 KPI grid with status indicators',
    },
    {
      id: 'status-distribution',
      type: 'chart',
      columns: 5,
      dominant: false,
      minHeight: 4,
      description: 'Status distribution pie/donut (40% width)',
    },
    {
      id: 'trend-throughput',
      type: 'chart',
      columns: 7,
      dominant: true,
      minHeight: 4,
      description: 'Trend/throughput chart (60% width)',
    },
    {
      id: 'breakdown-left',
      type: 'chart',
      columns: 6,
      dominant: false,
      minHeight: 3,
      description: 'Categorical breakdown chart (e.g., by workflow_name)',
    },
    {
      id: 'breakdown-right',
      type: 'chart',
      columns: 6,
      dominant: false,
      minHeight: 3,
      description: 'Secondary breakdown chart (e.g., by workflow_id)',
    },
    {
      id: 'event-stream',
      type: 'feed',
      columns: 12,
      dominant: false,
      minHeight: 5,
      description: 'Real-time event stream / log feed, scrollable',
    },
  ],
  spacing: 'compact',
  visualHierarchy: 'trend-throughput',
  maxKPIs: 4,
  gridSystem: 'asymmetric-40-60',
  spacingPx: 16,
  maxSecondaryCharts: 3,  // trend + 2 breakdowns + status distribution — 6-section skeleton
  breakpoints: {
    mobile: {
      stackSections: true,
      columnOverrides: {
        'status-distribution': 12,
        'trend-throughput': 12,
        'breakdown-left': 12,
        'breakdown-right': 12,
      },
    },
    tablet: {
      stackSections: false,
      columnOverrides: {
        'status-distribution': 5,
        'trend-throughput': 7,
        'breakdown-left': 6,
        'breakdown-right': 6,
      },
    },
    desktop: {},
  },
};

const analyticalBreakdown: LayoutSkeleton = {
  id: 'analytical-breakdown',
  name: 'Analytical Breakdown',
  description: 'Deep-dive analytics with multi-dimensional comparisons.',
  category: 'dashboard',
  personality: 'Mixpanel/Amplitude Analytics',
  sections: [
    {
      id: 'context-kpis',
      type: 'kpi-grid',
      columns: 12,
      dominant: false,
      maxItems: 4,
      compact: true,
      minHeight: 2,
      description: '4 context-rich KPI metrics',
    },
    {
      id: 'distribution-chart',
      type: 'chart',
      columns: 6,
      dominant: false,
      minHeight: 4,
      description: 'Pie/donut distribution (symmetrical 6/6)',
    },
    {
      id: 'comparison-chart',
      type: 'chart',
      columns: 6,
      dominant: false,
      minHeight: 4,
      description: 'Bar chart comparison (symmetrical 6/6)',
    },
    {
      id: 'multi-series-chart',
      type: 'chart',
      columns: 12,
      dominant: true,
      minHeight: 4,
      description: 'Full-width comparative chart, multi-series',
    },
    {
      id: 'detail-table',
      type: 'table',
      columns: 12,
      dominant: false,
      minHeight: 4,
      description: 'Sortable, filterable, paginated data table',
    },
  ],
  spacing: 'comfortable',
  visualHierarchy: 'multi-series-chart',
  maxKPIs: 4,
  gridSystem: '12-column',
  spacingPx: 20,
  maxSecondaryCharts: 3,  // filter-dimension + breakdown charts — deep-dive has more chart budget
  breakpoints: {
    mobile: {
      stackSections: true,
      columnOverrides: {
        'distribution-chart': 12,
        'comparison-chart': 12,
      },
    },
    tablet: {
      stackSections: false,
      columnOverrides: {
        'distribution-chart': 6,
        'comparison-chart': 6,
      },
    },
    desktop: {},
  },
};

const tableFirst: LayoutSkeleton = {
  id: 'table-first',
  name: 'Table-First Data Explorer',
  description: 'Data-heavy layout where the table is king. Minimal chrome.',
  category: 'dashboard',
  personality: 'Internal Ops Dashboard',
  sections: [
    {
      id: 'kpi-strip',
      type: 'kpi-grid',
      columns: 12,
      dominant: false,
      maxItems: 3,
      compact: true,
      minHeight: 2,
      description: '3 compact horizontal KPI strip (h:2 min for readable labels)',
    },
    {
      id: 'primary-table',
      type: 'table',
      columns: 12,
      dominant: true,
      minHeight: 6,
      description: 'Dominant data table (60% of viewport), sortable/filterable/paginated',
    },
    {
      id: 'supporting-chart',
      type: 'chart',
      columns: 12,
      dominant: false,
      minHeight: 3,
      description: 'Secondary trend context chart',
    },
    {
      id: 'metadata-filters',
      type: 'filters',
      columns: 12,
      dominant: false,
      minHeight: 1,
      description: 'Filter bar / metadata panel',
    },
  ],
  spacing: 'compact',
  visualHierarchy: 'primary-table',
  maxKPIs: 3,
  gridSystem: 'table-optimized',
  spacingPx: 12,
  maxSecondaryCharts: 1,  // 1 supporting chart only — table is dominant, charts are secondary context
  breakpoints: {
    mobile: {
      stackSections: true,
      hideSections: ['metadata-filters'],
    },
    tablet: {
      stackSections: true,
    },
    desktop: {},
  },
};

const storyboardInsight: LayoutSkeleton = {
  id: 'storyboard-insight',
  name: 'Storyboard / Insight Flow',
  description: 'Narrative-driven client portal. Premium, annotated, story-first.',
  category: 'dashboard',
  personality: 'Linear Insights',
  sections: [
    {
      id: 'hero-insight',
      type: 'insight-card',
      columns: 12,
      dominant: true,
      minHeight: 3,
      description: 'Hero insight block with narrative card + CTA',
    },
    {
      id: 'context-kpis',
      type: 'kpi-grid',
      columns: 12,
      dominant: false,
      maxItems: 4,
      compact: false,
      minHeight: 2,
      description: '4 contextual KPI metrics',
    },
    {
      id: 'narrative-chart',
      type: 'chart',
      columns: 12,
      dominant: false,
      minHeight: 4,
      description: 'Annotated narrative chart with key moments',
    },
    {
      id: 'platform-comparison',
      type: 'chart',
      columns: 6,
      dominant: false,
      minHeight: 4,
      description: 'Platform/category comparison',
    },
    {
      id: 'cost-analysis',
      type: 'chart',
      columns: 6,
      dominant: false,
      minHeight: 4,
      description: 'Cost/efficiency analysis',
    },
    {
      id: 'detail-table',
      type: 'table',
      columns: 12,
      dominant: false,
      minHeight: 3,
      description: 'Supporting detail drill-down table',
    },
  ],
  spacing: 'narrative',
  visualHierarchy: 'hero-insight',
  maxKPIs: 4,
  gridSystem: 'flexible',
  spacingPx: 28,
  maxSecondaryCharts: 2,  // narrative chart + 1 comparison pair — story-first, not chart-first
  breakpoints: {
    mobile: {
      stackSections: true,
      columnOverrides: {
        'platform-comparison': 12,
        'cost-analysis': 12,
      },
    },
    tablet: {
      stackSections: false,
      columnOverrides: {
        'platform-comparison': 6,
        'cost-analysis': 6,
      },
    },
    desktop: {},
  },
};

// ============================================================================
// Product Page Skeletons (F-H)
// ============================================================================

const saasLandingPage: LayoutSkeleton = {
  id: 'saas-landing-page',
  name: 'SaaS Landing Page',
  description: 'Product marketing page for selling a workflow as a SaaS product.',
  category: 'product',
  personality: 'Modern SaaS Landing Page',
  sections: [
    {
      id: 'hero',
      type: 'hero',
      columns: 12,
      dominant: true,
      minHeight: 3,
      description: 'Hero section with headline, CTA, and visual',
    },
    {
      id: 'social-proof',
      type: 'proof-bar',
      columns: 12,
      dominant: false,
      minHeight: 1,
      description: 'Social proof bar (logos, testimonials)',
    },
    {
      id: 'features',
      type: 'feature-grid',
      columns: 12,
      dominant: false,
      maxItems: 6,
      minHeight: 3,
      description: '3-column feature grid with icons and descriptions',
    },
    {
      id: 'pricing',
      type: 'pricing',
      columns: 12,
      dominant: false,
      maxItems: 3,
      minHeight: 3,
      description: '1-3 pricing tier cards',
    },
    {
      id: 'final-cta',
      type: 'cta',
      columns: 12,
      dominant: false,
      minHeight: 2,
      description: 'Bottom call-to-action section',
    },
  ],
  spacing: 'comfortable',
  visualHierarchy: 'hero',
  maxKPIs: 0,
  gridSystem: '12-column',
  spacingPx: 24,
  maxSecondaryCharts: 0,  // No charts — product page, not dashboard
  breakpoints: {
    mobile: { stackSections: true },
    tablet: { stackSections: true },
    desktop: {},
  },
};

const workflowInputForm: LayoutSkeleton = {
  id: 'workflow-input-form',
  name: 'Workflow Input Form',
  description: 'Multi-step wizard for customer workflow input.',
  category: 'product',
  personality: 'Typeform-style Wizard',
  sections: [
    {
      id: 'progress',
      type: 'progress-bar',
      columns: 12,
      dominant: false,
      minHeight: 1,
      description: 'Step progress indicator',
    },
    {
      id: 'form-content',
      type: 'form-step',
      columns: 12,
      dominant: true,
      maxItems: 5,
      minHeight: 4,
      description: 'Form step with 2-5 fields per step',
    },
    {
      id: 'navigation',
      type: 'form-nav',
      columns: 12,
      dominant: false,
      minHeight: 1,
      description: 'Back / Next / Submit navigation',
    },
  ],
  spacing: 'comfortable',
  visualHierarchy: 'form-content',
  maxKPIs: 0,
  gridSystem: '12-column',
  spacingPx: 24,
  maxSecondaryCharts: 0,  // No charts — form wizard
  breakpoints: {
    mobile: { stackSections: true },
    tablet: { stackSections: true },
    desktop: {},
  },
};

const resultsDisplay: LayoutSkeleton = {
  id: 'results-display',
  name: 'Results Display',
  description: 'Workflow output display for customers after form submission.',
  category: 'product',
  personality: 'Clean Results Page',
  sections: [
    {
      id: 'success',
      type: 'success-banner',
      columns: 12,
      dominant: false,
      minHeight: 1,
      description: 'Success confirmation banner',
    },
    {
      id: 'main-result',
      type: 'results-hero',
      columns: 12,
      dominant: true,
      minHeight: 3,
      description: 'Primary workflow output, large display',
    },
    {
      id: 'result-cards',
      type: 'results-cards',
      columns: 12,
      dominant: false,
      maxItems: 3,
      minHeight: 2,
      description: '3-column result breakdown cards',
    },
    {
      id: 'actions',
      type: 'actions-bar',
      columns: 12,
      dominant: false,
      minHeight: 1,
      description: 'Re-run / Download / Share action bar',
    },
  ],
  spacing: 'comfortable',
  visualHierarchy: 'main-result',
  maxKPIs: 0,
  gridSystem: '12-column',
  spacingPx: 24,
  maxSecondaryCharts: 0,  // No charts — results are cards/hero, not charts
  breakpoints: {
    mobile: { stackSections: true },
    tablet: { stackSections: true },
    desktop: {},
  },
};

// ============================================================================
// Admin Skeletons (I-K)
// ============================================================================

const adminCrudPanel: LayoutSkeleton = {
  id: 'admin-crud-panel',
  name: 'CRUD Panel',
  description: 'Agency management panel for products, customers, subscriptions.',
  category: 'admin',
  personality: 'Refine/AdminJS Panel',
  sections: [
    {
      id: 'page-header',
      type: 'page-header',
      columns: 12,
      dominant: false,
      minHeight: 1,
      description: 'Title + Create button',
    },
    {
      id: 'filter-bar',
      type: 'filter-bar',
      columns: 12,
      dominant: false,
      minHeight: 1,
      description: 'Search + filters',
    },
    {
      id: 'data-table',
      type: 'crud-table',
      columns: 12,
      dominant: true,
      minHeight: 5,
      description: 'Sortable, paginated table with row actions',
    },
    {
      id: 'pagination',
      type: 'pagination',
      columns: 12,
      dominant: false,
      minHeight: 1,
      description: 'Page controls',
    },
  ],
  spacing: 'compact',
  visualHierarchy: 'data-table',
  maxKPIs: 0,
  gridSystem: 'table-optimized',
  spacingPx: 12,
  maxSecondaryCharts: 0,  // No charts — CRUD panel, table-dominant
  breakpoints: {
    mobile: { stackSections: true },
    tablet: { stackSections: true },
    desktop: {},
  },
};

const settingsDashboard: LayoutSkeleton = {
  id: 'settings-dashboard',
  name: 'Settings Dashboard',
  description: 'Sidebar navigation with tabbed settings forms.',
  category: 'admin',
  personality: 'GitHub/Vercel Settings',
  sections: [
    {
      id: 'sidebar-nav',
      type: 'settings-sidebar',
      columns: 3,
      dominant: false,
      minHeight: 8,
      description: 'Left sidebar with setting category tabs',
    },
    {
      id: 'settings-content',
      type: 'settings-forms',
      columns: 9,
      dominant: true,
      minHeight: 6,
      description: 'Form sections for active tab',
    },
    {
      id: 'danger-zone',
      type: 'danger-zone',
      columns: 9,
      dominant: false,
      minHeight: 2,
      description: 'Destructive actions (delete account, etc.)',
    },
  ],
  spacing: 'comfortable',
  visualHierarchy: 'settings-content',
  maxKPIs: 0,
  gridSystem: 'sidebar-content',
  spacingPx: 24,
  maxSecondaryCharts: 0,  // No charts — settings forms
  breakpoints: {
    mobile: {
      stackSections: true,
      columnOverrides: {
        'sidebar-nav': 12,
        'settings-content': 12,
        'danger-zone': 12,
      },
    },
    tablet: {
      stackSections: false,
      columnOverrides: {
        'sidebar-nav': 4,
        'settings-content': 8,
        'danger-zone': 8,
      },
    },
    desktop: {},
  },
};

const authenticationFlow: LayoutSkeleton = {
  id: 'authentication-flow',
  name: 'Authentication Flow',
  description: 'Login/signup/reset with 40/60 split layout.',
  category: 'admin',
  personality: 'Modern Auth Page',
  sections: [
    {
      id: 'auth-form',
      type: 'auth-form',
      columns: 5,
      dominant: true,
      minHeight: 8,
      description: 'Auth form (40% width) — email, password, social logins',
    },
    {
      id: 'brand-visual',
      type: 'brand-visual',
      columns: 7,
      dominant: false,
      minHeight: 8,
      description: 'Brand visual (60% width) — screenshot, value prop',
    },
  ],
  spacing: 'comfortable',
  visualHierarchy: 'auth-form',
  maxKPIs: 0,
  gridSystem: 'split-40-60',
  spacingPx: 0, // No gap — full bleed split
  maxSecondaryCharts: 0,  // No charts — auth page
  breakpoints: {
    mobile: {
      stackSections: true,
      hideSections: ['brand-visual'],
      columnOverrides: { 'auth-form': 12 },
    },
    tablet: {
      stackSections: false,
      columnOverrides: {
        'auth-form': 5,
        'brand-visual': 7,
      },
    },
    desktop: {},
  },
};

const recordBrowser: LayoutSkeleton = {
  id: 'record-browser',
  name: 'Record Browser',
  description: 'Hybrid layout for workflows that produce rich records with both metrics and browsable content. Ideal for AI agents, research tools, and content pipelines.',
  category: 'dashboard',
  personality: 'Notion Database View',
  sections: [
    {
      id: 'summary-kpis',
      type: 'kpi-grid',
      columns: 12,
      dominant: false,
      maxItems: 4,
      compact: true,
      minHeight: 2,
      description: 'Quick summary stats: total records, success rate, avg processing time',
    },
    {
      id: 'record-list',
      type: 'record-list',
      columns: 12,
      dominant: true,
      minHeight: 5,
      description: 'Scrollable list of individual records with expandable details',
    },
    {
      id: 'content-detail',
      type: 'content-panel',
      columns: 12,
      dominant: false,
      minHeight: 4,
      description: 'Rich text content display for AI-generated summaries and reports',
    },
    {
      id: 'filtered-charts',
      type: 'chart-grid',
      columns: 12,
      dominant: false,
      maxItems: 2,
      minHeight: 3,
      description: 'Filtered charts showing non-null data subsets only',
    },
  ],
  spacing: 'comfortable',
  visualHierarchy: 'record-list',
  maxKPIs: 4,
  gridSystem: '12-column',
  spacingPx: 20,
  maxSecondaryCharts: 2,
  breakpoints: {
    mobile: {
      stackSections: true,
      hideSections: ['filtered-charts'],
    },
    tablet: {
      stackSections: true,
    },
    desktop: {},
  },
};

// ============================================================================
// Skeleton Registry
// ============================================================================

/** All 11 skeletons indexed by ID for O(1) lookup */
const SKELETON_MAP: Record<SkeletonId, LayoutSkeleton> = {
  'executive-overview': executiveOverview,
  'operational-monitoring': operationalMonitoring,
  'analytical-breakdown': analyticalBreakdown,
  'table-first': tableFirst,
  'storyboard-insight': storyboardInsight,
  'record-browser': recordBrowser,
  'saas-landing-page': saasLandingPage,
  'workflow-input-form': workflowInputForm,
  'results-display': resultsDisplay,
  'admin-crud-panel': adminCrudPanel,
  'settings-dashboard': settingsDashboard,
  'authentication-flow': authenticationFlow,
};

/** All skeleton IDs for iteration/testing */
export const ALL_SKELETON_IDS: SkeletonId[] = Object.keys(SKELETON_MAP) as SkeletonId[];

/** Get a skeleton by ID. Throws if not found (defensive — should never happen). */
export function getSkeleton(id: SkeletonId): LayoutSkeleton {
  const skeleton = SKELETON_MAP[id];
  if (!skeleton) {
    throw new Error(`[getSkeleton] Unknown skeleton ID: "${id}". Valid IDs: ${ALL_SKELETON_IDS.join(', ')}`);
  }
  return skeleton;
}

/** Get all skeletons in a category */
export function getSkeletonsByCategory(category: SkeletonCategory): LayoutSkeleton[] {
  return ALL_SKELETON_IDS
    .map(id => SKELETON_MAP[id])
    .filter(s => s.category === category);
}

/** Version string for spec metadata (increment on skeleton structure changes) */
export const SKELETON_VERSION = '1.0.0';
