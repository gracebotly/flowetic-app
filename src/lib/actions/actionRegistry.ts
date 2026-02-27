// src/lib/actions/actionRegistry.ts
//
// Level 3: Action Registry — components declare their capabilities.
// UI renders affordances automatically. Command Palette indexes everything.

export type ActionId =
  | "export-csv"
  | "export-pdf"
  | "drill-down"
  | "share-link"
  | "copy-value"
  | "refresh-data"
  | "filter-by-value"
  | "trigger-workflow" // Level 4 bridge (no-op until L4)
  | "navigate" // Level 4 bridge
  | "select-plan"; // Level 4 bridge

export type ActionCategory = "data" | "navigation" | "share" | "workflow";

export interface ActionDefinition {
  id: ActionId;
  label: string;
  icon: string; // Lucide icon name
  shortcut?: string; // e.g. "⌘E"
  category: ActionCategory;
  confirmMessage?: string; // If set, show confirmation before executing
}

export interface ActionContext {
  componentId: string;
  componentType: string;
  componentTitle?: string;
  /** Component's props — needed for copy-value (valueField, aggregation)
   *  and drill-down (filterKey derivation) */
  componentProps?: Record<string, any>;
  events: any[];
  filteredEvents: any[];
  dashboardTitle?: string;
  /** DOM element ref for PDF capture */
  dashboardRootEl?: HTMLElement | null;
  /** For drill-down / filter-by-value: which field to filter by */
  filterKey?: string;
  filterValue?: string;
}

export interface ActionResult {
  success: boolean;
  message: string;
  /** For drill-down: filtered events to render in modal */
  filteredEvents?: any[];
  appliedFilter?: { key: string; value: string };
  /** For trigger-workflow: execution ID (Level 4) */
  executionId?: string;
}

const ACTION_DEFINITIONS: Record<ActionId, ActionDefinition> = {
  "export-csv": { id: "export-csv", label: "Export CSV", icon: "Download", shortcut: "⌘E", category: "data" },
  "export-pdf": { id: "export-pdf", label: "Export PDF", icon: "FileText", category: "data" },
  "drill-down": { id: "drill-down", label: "Drill Down", icon: "ZoomIn", category: "navigation" },
  "share-link": { id: "share-link", label: "Copy Link", icon: "Link", shortcut: "⌘L", category: "share" },
  "copy-value": { id: "copy-value", label: "Copy Value", icon: "Copy", category: "share" },
  "refresh-data": { id: "refresh-data", label: "Refresh", icon: "RefreshCw", category: "data" },
  "filter-by-value": { id: "filter-by-value", label: "Filter", icon: "Filter", category: "navigation" },
  "trigger-workflow": { id: "trigger-workflow", label: "Run Workflow", icon: "Play", category: "workflow" },
  navigate: { id: "navigate", label: "Navigate", icon: "ArrowRight", category: "navigation" },
  "select-plan": { id: "select-plan", label: "Select Plan", icon: "CreditCard", category: "workflow" },
};

const COMPONENT_ACTIONS: Record<string, ActionId[]> = {
  MetricCard: ["drill-down", "copy-value", "share-link"],
  LineChart: ["export-csv", "export-pdf", "drill-down"],
  TimeseriesChart: ["export-csv", "export-pdf", "drill-down"],
  AreaChart: ["export-csv", "export-pdf", "drill-down"],
  BarChart: ["export-csv", "export-pdf", "drill-down", "filter-by-value"],
  PieChart: ["export-csv", "drill-down", "filter-by-value"],
  DonutChart: ["export-csv", "drill-down", "filter-by-value"],
  DataTable: ["export-csv", "export-pdf", "filter-by-value"],
  InsightCard: ["drill-down", "share-link", "copy-value"],
  StatusFeed: ["filter-by-value", "export-csv", "refresh-data"],
  CTASection: ["navigate", "trigger-workflow"],
  PricingCards: ["select-plan", "navigate"],
};

const DRILLDOWN_FIELD_MAP: Record<string, (props: Record<string, any>) => { filterKey?: string; filterValue?: string }> = {
  MetricCard: (props) => {
    if (props.filterField && props.filterValue) {
      return { filterKey: props.filterField, filterValue: props.filterValue };
    }
    return { filterKey: props.valueField };
  },
  BarChart: (props) => ({ filterKey: props.categoryField || props.xField }),
  PieChart: (props) => ({ filterKey: props.categoryField || props.field || props.valueField || "status" }),
  DonutChart: (props) => ({ filterKey: props.categoryField || props.field || props.valueField || "status" }),
  LineChart: (props) => ({ filterKey: props.dateField || "created_at" }),
  TimeseriesChart: (props) => ({ filterKey: props.dateField || "created_at" }),
  AreaChart: (props) => ({ filterKey: props.dateField || "created_at" }),
  DataTable: (props) => {
    const cols = props.columns;
    if (Array.isArray(cols) && cols.length > 0) {
      const firstCol = typeof cols[0] === "string" ? cols[0] : cols[0]?.key;
      return { filterKey: firstCol };
    }
    return {};
  },
  InsightCard: (props) => ({ filterKey: props.valueField || "value" }),
  StatusFeed: (props) => ({ filterKey: props.statusField || "status" }),
};

export function getDrillDownContext(
  resolvedType: string,
  props: Record<string, any>
): { filterKey?: string; filterValue?: string } {
  const deriver = DRILLDOWN_FIELD_MAP[resolvedType];
  if (!deriver) return {};
  return deriver(props);
}

export function getActionsForComponent(resolvedType: string): ActionDefinition[] {
  const actionIds = COMPONENT_ACTIONS[resolvedType];
  if (!actionIds) return [];
  return actionIds.map((id) => ACTION_DEFINITIONS[id]).filter(Boolean);
}

export function getActionDefinition(actionId: ActionId): ActionDefinition | undefined {
  return ACTION_DEFINITIONS[actionId];
}

export function getAllActions(): ActionDefinition[] {
  return Object.values(ACTION_DEFINITIONS);
}

export function hasActions(resolvedType: string): boolean {
  return (COMPONENT_ACTIONS[resolvedType]?.length ?? 0) > 0;
}
