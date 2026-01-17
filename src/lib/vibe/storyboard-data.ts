
// Phase 2: Visual Story Selection Data
// Replaces old "KPI Storyboard" with visual-first, plain-language cards

export type VisualStoryOption = {
  id: string;
  title: string;
  description: string;
  audience: string;
  visualPreview: string;
  exampleMetrics: string[];
  tags: string[];
};

export const DASHBOARD_VISUAL_STORIES: VisualStoryOption[] = [
  {
    id: "performance_snapshot",
    title: "Performance Snapshot",
    description: "Real-time overview of what's working and what needs attention",
    audience: "Clients who want quick status checks",
    visualPreview: "/previews/performance-snapshot.svg",
    exampleMetrics: ["Call volume", "Success rate", "Response time"],
    tags: ["Client-facing", "Quick glance", "Status board"],
  },
  {
    id: "deep_analytics",
    title: "Deep Analytics",
    description: "Detailed breakdowns to spot trends and dig into the data",
    audience: "Teams who manage the workflow daily",
    visualPreview: "/previews/deep-analytics.svg",
    exampleMetrics: ["Hourly trends", "Error patterns", "Conversion funnels"],
    tags: ["Internal ops", "Detailed", "Trends"],
  },
  {
    id: "impact_report",
    title: "Impact Report",
    description: "Proof of results your client can share with their boss",
    audience: "Monthly check-ins and proving ROI",
    visualPreview: "/previews/impact-report.svg",
    exampleMetrics: ["Total outcomes", "Cost saved", "Before/after comparison"],
    tags: ["Client reports", "Executive summary", "ROI proof"],
  },
];

export const PRODUCT_VISUAL_STORIES: VisualStoryOption[] = [
  {
    id: "user_control_panel",
    title: "User Control Panel",
    description: "Let users trigger actions and adjust settings themselves",
    audience: "End users who need self-service",
    visualPreview: "/previews/control-panel.svg",
    exampleMetrics: ["Action buttons", "Toggle settings", "Input forms"],
    tags: ["Self-service", "Interactive", "User-facing"],
  },
  {
    id: "workflow_monitor",
    title: "Workflow Monitor",
    description: "Track what's happening in real-time with detailed logs",
    audience: "Operations teams managing workflows",
    visualPreview: "/previews/workflow-monitor.svg",
    exampleMetrics: ["Live status", "Step progress", "Error logs"],
    tags: ["Internal", "Real-time", "Monitoring"],
  },
  {
    id: "client_portal",
    title: "Client Portal",
    description: "Professional interface clients use to view and manage their account",
    audience: "Clients accessing their dedicated portal",
    visualPreview: "/previews/client-portal.svg",
    exampleMetrics: ["Usage summary", "Billing info", "Activity history"],
    tags: ["Client-facing", "Portal", "Account management"],
  },
];
