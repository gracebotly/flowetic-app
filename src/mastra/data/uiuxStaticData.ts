/**
 * Pre-processed UI/UX Pro Max skill data for serverless environments.
 *
 * Generated from: workspace/skills/ui-ux-pro-max/data/
 * This enables BM25-style search without Python or filesystem access.
 *
 * To regenerate: npx tsx scripts/generate-uiux-static-data.ts
 */

export interface StyleEntry {
  id: string;
  name: string;
  type: string;
  keywords: string;
  primaryColors: string;
  effects: string;
  bestFor: string;
  performance: string;
  accessibility: string;
  aiPromptKeywords: string;
  cssKeywords: string;
  implementationChecklist: string;
  designSystemVariables: string;
}

export interface ColorEntry {
  id: string;
  productType: string;
  primary: string;
  secondary: string;
  cta: string;
  background: string;
  text: string;
  accent: string;
  notes: string;
}

export interface TypographyEntry {
  id: string;
  pairingName: string;
  headingFont: string;
  bodyFont: string;
  mood: string;
  bestFor: string;
  googleFontsUrl: string;
  cssImport: string;
}

export interface ProductEntry {
  id: string;
  productType: string;
  keywords: string;
  primaryStyleRecommendation: string;
  secondaryStyles: string;
  landingPagePattern: string;
  dashboardStyle: string;
  colorMood: string;
  typographyMood: string;
  keyEffects: string;
  antiPatterns: string;
}

// Pre-processed data - curated for Getflowetic dashboard use case
// Full CSV data has 67 styles, 96 colors, 57 typography pairings, 100 products
// This subset focuses on dashboard-relevant entries

export const STYLES: StyleEntry[] = [
  {
    id: "glassmorphism",
    name: "Glassmorphism",
    type: "Visual Effect",
    keywords: "frosted glass, blur, transparency, premium, depth, layered, backdrop-filter, translucent",
    primaryColors: "rgba(255,255,255,0.1-0.3), blur(10-20px), subtle borders",
    effects: "backdrop-filter: blur(), background transparency, border glow, depth layering",
    bestFor: "Premium dashboards, modern SaaS, fintech, client portals",
    performance: "Good (GPU accelerated)",
    accessibility: "WCAG AA (ensure text contrast)",
    aiPromptKeywords: "glass effect, frosted, blur background, translucent cards, depth layers",
    cssKeywords: "backdrop-filter, rgba, blur, border-radius, box-shadow",
    implementationChecklist: "☐ backdrop-filter support check, ☐ fallback for Safari, ☐ contrast ratio 4.5:1",
    designSystemVariables: "--glass-blur: 12px, --glass-bg: rgba(255,255,255,0.1), --glass-border: rgba(255,255,255,0.2)"
  },
  {
    id: "minimalism",
    name: "Minimalism",
    type: "Design Philosophy",
    keywords: "clean, whitespace, simple, elegant, uncluttered, focused, essential, breathing room",
    primaryColors: "Monochrome, limited palette, high contrast",
    effects: "Subtle shadows, clean lines, generous spacing",
    bestFor: "Professional dashboards, reports, B2B clients, data-heavy interfaces",
    performance: "Excellent",
    accessibility: "WCAG AAA achievable",
    aiPromptKeywords: "minimal design, clean interface, whitespace, simple, uncluttered",
    cssKeywords: "padding, margin, max-width, line-height, font-weight",
    implementationChecklist: "☐ Remove decorative elements, ☐ Increase whitespace, ☐ Limit colors to 3",
    designSystemVariables: "--spacing-base: 16px, --max-content-width: 1200px, --line-height: 1.6"
  },
  {
    id: "dark-mode",
    name: "Dark Mode",
    type: "Theme",
    keywords: "dark theme, night mode, low light, OLED, eye strain reduction, professional, technical",
    primaryColors: "#0A0A0A, #171717, #1F1F1F backgrounds with light text",
    effects: "Subtle glows, reduced shadows, accent color pops",
    bestFor: "Developer tools, ops dashboards, technical users, long sessions",
    performance: "Excellent (OLED battery savings)",
    accessibility: "WCAG AA (invert contrast ratios)",
    aiPromptKeywords: "dark theme, night mode, dark background, light text, glow effects",
    cssKeywords: "background-color: dark, color: light, prefers-color-scheme",
    implementationChecklist: "☐ System preference detection, ☐ Toggle persistence, ☐ Image adjustments",
    designSystemVariables: "--bg-primary: #0A0A0A, --bg-surface: #171717, --text-primary: #FAFAFA"
  },
  {
    id: "neumorphism",
    name: "Neumorphism / Soft UI",
    type: "Visual Effect",
    keywords: "soft shadows, raised elements, recessed, tactile, soft UI, skeuomorphic, embossed",
    primaryColors: "Monochrome backgrounds with matching shadows",
    effects: "Dual shadows (light + dark), soft edges, subtle depth",
    bestFor: "Wellness apps, premium interfaces, client-facing dashboards",
    performance: "Good",
    accessibility: "WCAG AA (ensure sufficient contrast)",
    aiPromptKeywords: "soft shadows, raised buttons, recessed inputs, tactile, soft UI",
    cssKeywords: "box-shadow inset, multiple shadows, border-radius",
    implementationChecklist: "☐ Both light and dark shadows, ☐ Consistent light source, ☐ Subtle not extreme",
    designSystemVariables: "--shadow-light: -5px -5px 10px rgba(255,255,255,0.8), --shadow-dark: 5px 5px 10px rgba(0,0,0,0.1)"
  },
  {
    id: "brutalism",
    name: "Brutalism / Neubrutalism",
    type: "Design Philosophy",
    keywords: "bold, raw, high contrast, thick borders, primary colors, anti-design, punk",
    primaryColors: "Primary colors (red, blue, yellow), black borders",
    effects: "Hard shadows, thick borders (3px+), no gradients",
    bestFor: "Creative agencies, Gen Z brands, bold statements, differentiation",
    performance: "Excellent",
    accessibility: "WCAG AAA (high contrast)",
    aiPromptKeywords: "bold design, thick borders, primary colors, raw aesthetic, anti-design",
    cssKeywords: "border: 3px solid black, box-shadow: 4px 4px 0 black, no border-radius",
    implementationChecklist: "☐ Consistent border weight, ☐ Limited color palette, ☐ No gradients",
    designSystemVariables: "--border-width: 3px, --shadow-offset: 4px, --border-color: #000000"
  },
  {
    id: "bento-grid",
    name: "Bento Grid",
    type: "Layout",
    keywords: "grid layout, cards, modular, organized, Apple-style, dashboard tiles, asymmetric grid",
    primaryColors: "Flexible, works with any palette",
    effects: "Card animations, hover reveals, smooth transitions",
    bestFor: "Feature showcases, dashboards, portfolio layouts, landing pages",
    performance: "Excellent",
    accessibility: "WCAG AA (semantic structure important)",
    aiPromptKeywords: "bento box layout, grid cards, modular sections, Apple-style grid",
    cssKeywords: "display: grid, grid-template-columns, gap, aspect-ratio",
    implementationChecklist: "☐ Responsive breakpoints, ☐ Consistent gap spacing, ☐ Card hierarchy",
    designSystemVariables: "--grid-gap: 16px, --card-radius: 16px, --card-padding: 24px"
  },
  {
    id: "executive-dashboard",
    name: "Executive Dashboard",
    type: "BI/Analytics",
    keywords: "KPI cards, metrics, summary view, at-a-glance, C-suite, business intelligence",
    primaryColors: "Professional palette (blue/grey/white), accent for KPIs",
    effects: "KPI count-up animations, trend arrows, metric card hover",
    bestFor: "C-suite dashboards, business summaries, decision-maker views",
    performance: "Excellent",
    accessibility: "WCAG AA",
    aiPromptKeywords: "executive dashboard, KPI cards, metrics summary, business intelligence",
    cssKeywords: "display: flex, font-size: 48px, sparkline, status indicators",
    implementationChecklist: "☐ 4-6 KPIs maximum, ☐ Trend indicators, ☐ One-page view",
    designSystemVariables: "--kpi-font-size: 48px, --status-green: #22C55E, --status-red: #EF4444"
  },
  {
    id: "real-time-monitoring",
    name: "Real-Time Monitoring",
    type: "BI/Analytics",
    keywords: "live data, status indicators, alerts, streaming, DevOps, system monitoring",
    primaryColors: "Alert colors: critical (red), warning (orange), normal (green)",
    effects: "Real-time updates, alert pulse, status blink, smooth data streams",
    bestFor: "System monitoring, DevOps, real-time analytics, ops dashboards",
    performance: "Good (real-time load considerations)",
    accessibility: "WCAG AA",
    aiPromptKeywords: "real-time dashboard, live updates, status monitoring, alert system",
    cssKeywords: "animation: pulse, WebSocket updates, transition: smooth",
    implementationChecklist: "☐ Connection status indicator, ☐ Alert severity levels, ☐ Performance optimization",
    designSystemVariables: "--alert-critical: #EF4444, --alert-warning: #F59E0B, --alert-success: #22C55E"
  }
];

export const COLORS: ColorEntry[] = [
  {
    id: "saas-b2b",
    productType: "SaaS B2B",
    primary: "#2563EB",
    secondary: "#3B82F6",
    cta: "#22C55E",
    background: "#F8FAFC",
    text: "#0F172A",
    accent: "#DBEAFE",
    notes: "Trust blue + action green. Professional, conversion-focused."
  },
  {
    id: "fintech-banking",
    productType: "Fintech/Banking",
    primary: "#0F172A",
    secondary: "#1E3A8A",
    cta: "#CA8A04",
    background: "#F8FAFC",
    text: "#020617",
    accent: "#E2E8F0",
    notes: "Trust navy + premium gold. Security and sophistication."
  },
  {
    id: "healthcare-medical",
    productType: "Healthcare/Medical",
    primary: "#0D9488",
    secondary: "#14B8A6",
    cta: "#2563EB",
    background: "#F0FDFA",
    text: "#134E4A",
    accent: "#CCFBF1",
    notes: "Calm teal + trust blue. Clean, professional, reassuring."
  },
  {
    id: "ecommerce-general",
    productType: "E-commerce General",
    primary: "#7C3AED",
    secondary: "#8B5CF6",
    cta: "#F97316",
    background: "#FAF5FF",
    text: "#4C1D95",
    accent: "#EDE9FE",
    notes: "Vibrant purple + action orange. Engaging, conversion-focused."
  },
  {
    id: "ai-chatbot-platform",
    productType: "AI/Chatbot Platform",
    primary: "#8B5CF6",
    secondary: "#A78BFA",
    cta: "#22C55E",
    background: "#0F0F23",
    text: "#F8FAFC",
    accent: "#312E81",
    notes: "AI purple + success green on dark. Modern tech aesthetic."
  },
  {
    id: "workflow-automation",
    productType: "Workflow Automation",
    primary: "#6366F1",
    secondary: "#818CF8",
    cta: "#F97316",
    background: "#FAFAFA",
    text: "#171717",
    accent: "#E0E7FF",
    notes: "Indigo + energy orange. Productive, efficient feel."
  },
  {
    id: "crm-sales",
    productType: "CRM/Sales Platform",
    primary: "#0EA5E9",
    secondary: "#38BDF8",
    cta: "#22C55E",
    background: "#F0F9FF",
    text: "#0C4A6E",
    accent: "#BAE6FD",
    notes: "Sky blue + success green. Approachable yet professional."
  },
  {
    id: "legal-services",
    productType: "Legal Services",
    primary: "#1E3A8A",
    secondary: "#1E40AF",
    cta: "#B45309",
    background: "#F8FAFC",
    text: "#0F172A",
    accent: "#CBD5E1",
    notes: "Authority navy + trust gold. Traditional, credible."
  },
  {
    id: "agency-premium",
    productType: "Agency/Premium",
    primary: "#18181B",
    secondary: "#27272A",
    cta: "#F8FAFC",
    background: "#09090B",
    text: "#FAFAFA",
    accent: "#3F3F46",
    notes: "Pure black + white. High contrast, premium feel."
  },
  {
    id: "call-center-voice",
    productType: "Call Center/Voice AI",
    primary: "#0066CC",
    secondary: "#0EA5E9",
    cta: "#22C55E",
    background: "#F0F9FF",
    text: "#0C4A6E",
    accent: "#BAE6FD",
    notes: "Professional blue + success green. Trust and communication."
  }
];

export const TYPOGRAPHY: TypographyEntry[] = [
  {
    id: "inter-system",
    pairingName: "Inter + System",
    headingFont: "Inter",
    bodyFont: "system-ui",
    mood: "Clean, modern, technical",
    bestFor: "Developer tools, technical dashboards, SaaS",
    googleFontsUrl: "https://fonts.google.com/specimen/Inter",
    cssImport: "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');"
  },
  {
    id: "space-grotesk-inter",
    pairingName: "Space Grotesk + Inter",
    headingFont: "Space Grotesk",
    bodyFont: "Inter",
    mood: "Modern, geometric, tech-forward",
    bestFor: "AI products, tech startups, automation platforms",
    googleFontsUrl: "https://fonts.google.com/specimen/Space+Grotesk",
    cssImport: "@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500&display=swap');"
  },
  {
    id: "dm-sans-system",
    pairingName: "DM Sans + System",
    headingFont: "DM Sans",
    bodyFont: "system-ui",
    mood: "Friendly, approachable, modern",
    bestFor: "Client dashboards, SaaS, business apps",
    googleFontsUrl: "https://fonts.google.com/specimen/DM+Sans",
    cssImport: "@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');"
  },
  {
    id: "plus-jakarta-inter",
    pairingName: "Plus Jakarta Sans + Inter",
    headingFont: "Plus Jakarta Sans",
    bodyFont: "Inter",
    mood: "Professional, premium, polished",
    bestFor: "B2B platforms, enterprise dashboards, fintech",
    googleFontsUrl: "https://fonts.google.com/specimen/Plus+Jakarta+Sans",
    cssImport: "@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700&family=Inter:wght@400;500&display=swap');"
  }
];

export const PRODUCTS: ProductEntry[] = [
  {
    id: "ai-chatbot-platform",
    productType: "AI/Chatbot Platform",
    keywords: "chatbot, AI assistant, conversational AI, NLP, voice AI, virtual assistant",
    primaryStyleRecommendation: "Dark Mode + Glassmorphism",
    secondaryStyles: "Minimalism, AI-Native UI",
    landingPagePattern: "Feature-Rich + Demo",
    dashboardStyle: "Conversation-focused with metrics sidebar",
    colorMood: "AI purple, tech gradients, dark backgrounds",
    typographyMood: "Modern geometric, tech-forward",
    keyEffects: "Typing indicators, message animations, AI thinking states",
    antiPatterns: "Cluttered layouts, too many metrics, no conversation focus"
  },
  {
    id: "workflow-automation",
    productType: "Workflow Automation (n8n/Make style)",
    keywords: "automation, workflow, integrations, Zapier, n8n, Make, triggers, actions",
    primaryStyleRecommendation: "Minimalism + Bento Grid",
    secondaryStyles: "Dark Mode for ops, Light for clients",
    landingPagePattern: "Feature-Rich + Use Cases",
    dashboardStyle: "Flow visualization, execution logs, status indicators",
    colorMood: "Purple/indigo (n8n), teal (Make), energy orange accents",
    typographyMood: "Clean, technical, readable",
    keyEffects: "Flow animations, execution progress, status transitions",
    antiPatterns: "Complex graphs without zoom, too much text, no visual flow"
  },
  {
    id: "voice-ai-call-center",
    productType: "Voice AI / Call Center",
    keywords: "voice agent, call center, phone AI, Vapi, Retell, telephony, IVR",
    primaryStyleRecommendation: "Minimalism + Real-Time Monitoring",
    secondaryStyles: "Executive Dashboard for clients",
    landingPagePattern: "Hero + Trust Elements",
    dashboardStyle: "Call metrics, live status, transcript view",
    colorMood: "Professional blue, trust green, alert colors",
    typographyMood: "Professional, readable at a glance",
    keyEffects: "Live call indicators, waveform visualizations, status pulses",
    antiPatterns: "Tiny text, no live indicators, cluttered metrics"
  },
  {
    id: "crm-sales",
    productType: "CRM / Sales Platform",
    keywords: "CRM, sales, pipeline, deals, contacts, leads, opportunities",
    primaryStyleRecommendation: "Minimalism + Bento Grid",
    secondaryStyles: "Executive Dashboard for managers",
    landingPagePattern: "Feature-Rich + Social Proof",
    dashboardStyle: "Pipeline kanban, deal cards, activity timeline",
    colorMood: "Sky blue, success green, warning orange",
    typographyMood: "Clean, scannable, professional",
    keyEffects: "Drag-and-drop, card animations, status transitions",
    antiPatterns: "Overwhelming data tables, no visual pipeline, cluttered"
  },
  {
    id: "analytics-bi",
    productType: "Analytics / BI Dashboard",
    keywords: "analytics, business intelligence, metrics, KPIs, reporting, data visualization",
    primaryStyleRecommendation: "Executive Dashboard + Minimalism",
    secondaryStyles: "Dark Mode for analysts",
    landingPagePattern: "Demo + Feature-Rich",
    dashboardStyle: "KPI cards, charts, filters, drill-down",
    colorMood: "Professional palette, chart colors, status indicators",
    typographyMood: "Clear hierarchy, numbers prominent",
    keyEffects: "Chart animations, filter transitions, metric updates",
    antiPatterns: "Too many charts, no hierarchy, poor labeling"
  },
  {
    id: "woocommerce-support",
    productType: "WooCommerce Support / E-commerce Dashboard",
    keywords: "WooCommerce, e-commerce, orders, customers, products, support, Shopify",
    primaryStyleRecommendation: "Minimalism + Executive Dashboard",
    secondaryStyles: "Bento Grid for overview",
    landingPagePattern: "Feature-Rich + Trust",
    dashboardStyle: "Order metrics, support tickets, customer stats",
    colorMood: "Professional, approachable, success-focused",
    typographyMood: "Friendly, readable, business-oriented",
    keyEffects: "Status updates, notification indicators, smooth transitions",
    antiPatterns: "Technical jargon, overwhelming data, no clear actions"
  }
];

/**
 * Simple BM25-inspired search over static data
 */
export function searchUIUXData(
  query: string,
  domain: 'style' | 'color' | 'typography' | 'product',
  maxResults: number = 3
): any[] {
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length >= 2);

  let data: any[];
  let searchFields: string[];

  switch (domain) {
    case 'style':
      data = STYLES;
      searchFields = ['name', 'keywords', 'bestFor', 'aiPromptKeywords'];
      break;
    case 'color':
      data = COLORS;
      searchFields = ['productType', 'notes'];
      break;
    case 'typography':
      data = TYPOGRAPHY;
      searchFields = ['pairingName', 'mood', 'bestFor'];
      break;
    case 'product':
      data = PRODUCTS;
      searchFields = ['productType', 'keywords', 'primaryStyleRecommendation'];
      break;
    default:
      return [];
  }

  // Score each entry
  const scored = data.map(entry => {
    let score = 0;
    const entryText = searchFields
      .map(f => String(entry[f] || ''))
      .join(' ')
      .toLowerCase();

    for (const term of queryTerms) {
      if (entryText.includes(term)) {
        // Boost for exact field matches
        if (entry.name?.toLowerCase().includes(term) ||
            entry.productType?.toLowerCase().includes(term)) {
          score += 10;
        } else if (entry.keywords?.toLowerCase().includes(term)) {
          score += 5;
        } else {
          score += 2;
        }
      }
    }

    return { entry, score };
  });

  // Sort by score descending, return top results
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(s => s.entry);
}
