
// Platform-specific outcome card catalog
// Validates metrics against Supabase events schema

export interface OutcomeCard {
  id: string;
  name: string;
  description: string;
  platformTypes: string[];
  category: "dashboard" | "product" | "operations";
  audience: "client" | "internal" | "both";
  metrics: {
    primary: string[];
    secondary: string[];
  };
  previewImageUrl: string;
  tags: string[];
  supportedEventTypes: string[];
  requiredEntityKinds?: string[];
}

// Valid event types from Supabase events schema
export const VALID_EVENT_TYPES = [
  "call.started",
  "call.ended",
  "call.missed",
  "execution.started",
  "execution.success",
  "execution.failed",
  "ticket.created",
  "ticket.resolved",
  "ticket.escalated",
  "trigger.fired",
  "action.completed",
];

export const OUTCOME_CATALOG: OutcomeCard[] = [
  // Voice Platform Outcomes
  {
    id: "call_analytics",
    name: "Call Analytics Dashboard",
    description: "Track call volume, duration, and agent performance metrics in real-time.",
    platformTypes: ["vapi", "retell"],
    category: "dashboard",
    audience: "client",
    metrics: {
      primary: ["call_volume", "success_rate", "avg_duration"],
      secondary: ["agent_performance", "sentiment_trend"],
    },
    previewImageUrl: "/outcome-previews/call-analytics.png",
    tags: ["Voice", "Analytics", "Client-facing"],
    supportedEventTypes: ["call.started", "call.ended", "call.missed"],
    requiredEntityKinds: ["agent"],
  },
  {
    id: "voice_product",
    name: "Voice Automation Product",
    description: "Sell access to your voice agents as a product with custom form/button UI.",
    platformTypes: ["vapi", "retell"],
    category: "product",
    audience: "client",
    metrics: {
      primary: ["executions_count", "cost_per_call"],
      secondary: ["success_rate", "user_satisfaction"],
    },
    previewImageUrl: "/outcome-previews/voice-product.png",
    tags: ["Voice", "SaaS", "Monetization"],
    supportedEventTypes: ["call.started", "call.ended"],
    requiredEntityKinds: ["agent"],
  },

  // Workflow Platform Outcomes
  {
    id: "workflow_ops",
    name: "Workflow Operations Dashboard",
    description: "Monitor workflow executions, errors, and performance metrics.",
    platformTypes: ["n8n", "make", "zapier", "activepieces"],
    category: "dashboard",
    audience: "internal",
    metrics: {
      primary: ["execution_count", "success_rate", "error_count"],
      secondary: ["avg_runtime", "slowest_executions"],
    },
    previewImageUrl: "/outcome-previews/workflow-ops.png",
    tags: ["Automation", "Operations", "Internal"],
    supportedEventTypes: [
      "execution.started",
      "execution.success",
      "execution.failed",
    ],
    requiredEntityKinds: ["workflow"],
  },
  {
    id: "workflow_product",
    name: "Workflow Automation Product",
    description: "Package your workflow as a SaaS product with form/button UI for clients.",
    platformTypes: ["n8n", "make", "zapier"],
    category: "product",
    audience: "client",
    metrics: {
      primary: ["executions_count", "active_users"],
      secondary: ["cost_per_execution", "success_rate"],
    },
    previewImageUrl: "/outcome-previews/workflow-product.png",
    tags: ["Automation", "SaaS", "Monetization"],
    supportedEventTypes: ["execution.started", "execution.success"],
    requiredEntityKinds: ["workflow"],
  },

  // Universal Outcomes (all platforms)
  {
    id: "client_roi",
    name: "Client ROI Dashboard",
    description: "Prove automation value and time saved to clients - drives renewals and retention.",
    platformTypes: [
      "vapi",
      "retell",
      "n8n",
      "make",
      "zapier",
      "activepieces",
    ],
    category: "dashboard",
    audience: "client",
    metrics: {
      primary: ["tasks_automated", "time_saved", "success_rate"],
      secondary: ["executions_over_time", "cost_savings"],
    },
    previewImageUrl: "/outcome-previews/client-roi.png",
    tags: ["ROI", "Retention", "Client-facing"],
    supportedEventTypes: [
      "call.ended",
      "execution.success",
      "ticket.resolved",
    ],
    requiredEntityKinds: ["agent", "workflow", "ticket"],
  },
  {
    id: "automation_product",
    name: "Workflow Product (SaaS Wrapper)",
    description: "Sell monthly access, hide underlying workflow, provide form/button UI to run it.",
    platformTypes: [
      "vapi",
      "retell",
      "n8n",
      "make",
      "zapier",
      "activepieces",
    ],
    category: "product",
    audience: "client",
    metrics: {
      primary: ["executions_count", "active_users", "monthly_revenue"],
      secondary: ["success_rate", "user_satisfaction"],
    },
    previewImageUrl: "/outcome-previews/automation-product.png",
    tags: ["SaaS", "Monetization", "Product"],
    supportedEventTypes: [
      "call.started",
      "execution.started",
      "ticket.created",
    ],
    requiredEntityKinds: ["agent", "workflow"],
  },
];

// Helper: filter by platform
export function filterOutcomesByPlatform(
  platformType: string
): OutcomeCard[] {
  return OUTCOME_CATALOG.filter((o) =>
    o.platformTypes.includes(platformType)
  );
}

// Helper: get outcome by ID
export function getOutcomeById(id: string): OutcomeCard | undefined {
  return OUTCOME_CATALOG.find((o) => o.id === id);
}

// Canonical outcomes list for server/runtime validation.
// This is intentionally a simple array export so API routes can validate IDs
// without depending on Mastra Tool wrappers.
export const OUTCOMES = [
  ...filterOutcomesByPlatform("make"),
  ...filterOutcomesByPlatform("n8n"),
  ...filterOutcomesByPlatform("activepieces"),
  ...filterOutcomesByPlatform("zapier"),
  ...filterOutcomesByPlatform("retell"),
  ...filterOutcomesByPlatform("vapi"),
  ...filterOutcomesByPlatform("other"),
].filter((o, idx, arr) => arr.findIndex((x) => x.id === o.id) === idx);
