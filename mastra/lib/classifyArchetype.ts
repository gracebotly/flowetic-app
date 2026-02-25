// mastra/lib/classifyArchetype.ts
// ============================================================================
// Deterministic archetype classifier for the 2-phase journey.
//
// Analyzes workflow name, platform type, entity names, and event patterns
// to classify what KIND of workflow this is. The archetype drives the
// emphasis blend for each proposal (ops vs client-facing vs analytics).
//
// This is PURE LOGIC — no LLM calls, no DB queries, no network I/O.
// It runs synchronously and returns in <1ms.
// ============================================================================

import type { Archetype, EmphasisBlend } from '@/types/proposal';

// ─── Signal keywords mapped to archetypes ─────────────────────────────────

const ARCHETYPE_SIGNALS: Record<Archetype, {
  /** Keywords in workflow name or entity names (case-insensitive) */
  nameSignals: string[];
  /** Platform types that strongly suggest this archetype */
  platformSignals: string[];
  /** Minimum keyword matches to trigger (default 1) */
  threshold?: number;
}> = {
  ops_monitoring: {
    nameSignals: [
      'monitor', 'alert', 'health', 'uptime', 'status', 'error', 'fail',
      'retry', 'timeout', 'latency', 'incident', 'ops', 'devops', 'infra',
      'deploy', 'ci', 'cd', 'pipeline', 'cron', 'schedule', 'batch',
      'webhook', 'sync', 'backup', 'log',
    ],
    platformSignals: [],
  },
  lead_pipeline: {
    nameSignals: [
      'lead', 'crm', 'pipeline', 'funnel', 'prospect', 'deal', 'opportunity',
      'contact', 'customer', 'conversion', 'qualify', 'nurture', 'outreach',
      'sales', 'revenue', 'roi', 'retention', 'churn', 'onboard',
      'signup', 'trial', 'demo', 'booking',
    ],
    platformSignals: [],
  },
  voice_analytics: {
    nameSignals: [
      'voice', 'call', 'phone', 'ivr', 'agent', 'conversation', 'transcript',
      'sentiment', 'speech', 'audio', 'dial', 'ring', 'sip', 'pbx',
      'assistant', 'bot',
    ],
    platformSignals: ['vapi', 'retell'],
  },
  content_automation: {
    nameSignals: [
      'content', 'social', 'post', 'publish', 'blog', 'article', 'email',
      'newsletter', 'campaign', 'marketing', 'seo', 'engagement', 'share',
      'tweet', 'instagram', 'linkedin', 'youtube', 'tiktok', 'reddit',
      'medium', 'wordpress', 'ghost',
    ],
    platformSignals: [],
  },
  data_integration: {
    nameSignals: [
      'etl', 'sync', 'import', 'export', 'migrate', 'transform', 'warehouse',
      'bigquery', 'snowflake', 'postgres', 'mysql', 'airtable', 'sheets',
      'csv', 'api', 'rest', 'graphql', 'webhook',
    ],
    platformSignals: [],
  },
  client_reporting: {
    nameSignals: [
      'report', 'client', 'white-label', 'whitelabel', 'agency', 'brand',
      'customer-facing', 'portal', 'embed', 'share', 'export', 'pdf',
      'snapshot', 'weekly', 'monthly', 'quarterly',
    ],
    platformSignals: [],
  },
  ai_automation: {
    nameSignals: [
      'ai research', 'llm agent', 'rag pipeline', 'chatbot builder',
      'ai service', 'ml pipeline', 'model training', 'inference',
      'embedding', 'vector search', 'prompt chain', 'ai workflow',
      'gpt', 'claude', 'gemini', 'openai', 'langchain', 'autogen',
    ],
    platformSignals: [],
    threshold: 2,
  },
  general: {
    nameSignals: [],
    platformSignals: [],
  },
};

// ─── Emphasis blend presets per archetype ──────────────────────────────────
// These define the BASE blend. generateProposals.ts creates 3 variants
// by shifting the emphasis (e.g., +20% product for variant B).

const ARCHETYPE_BLEND_PRESETS: Record<Archetype, EmphasisBlend[]> = {
  ops_monitoring: [
    { dashboard: 0.8, product: 0.1, analytics: 0.1 },   // Ops command center
    { dashboard: 0.4, product: 0.4, analytics: 0.2 },   // Client-facing ops
    { dashboard: 0.5, product: 0.0, analytics: 0.5 },   // Deep ops analytics
  ],
  lead_pipeline: [
    { dashboard: 0.6, product: 0.3, analytics: 0.1 },   // Pipeline tracker
    { dashboard: 0.2, product: 0.7, analytics: 0.1 },   // Client portal
    { dashboard: 0.3, product: 0.1, analytics: 0.6 },   // Conversion analytics
  ],
  voice_analytics: [
    { dashboard: 0.7, product: 0.2, analytics: 0.1 },   // Call center dashboard
    { dashboard: 0.2, product: 0.6, analytics: 0.2 },   // Agent performance portal
    { dashboard: 0.3, product: 0.1, analytics: 0.6 },   // Sentiment deep-dive
  ],
  content_automation: [
    { dashboard: 0.5, product: 0.4, analytics: 0.1 },   // Content calendar
    { dashboard: 0.1, product: 0.8, analytics: 0.1 },   // Publishing portal
    { dashboard: 0.3, product: 0.1, analytics: 0.6 },   // Engagement analytics
  ],
  data_integration: [
    { dashboard: 0.7, product: 0.1, analytics: 0.2 },   // Sync status board
    { dashboard: 0.3, product: 0.5, analytics: 0.2 },   // Data portal
    { dashboard: 0.2, product: 0.1, analytics: 0.7 },   // Pipeline analytics
  ],
  client_reporting: [
    { dashboard: 0.3, product: 0.6, analytics: 0.1 },   // Client dashboard
    { dashboard: 0.1, product: 0.8, analytics: 0.1 },   // White-label portal
    { dashboard: 0.4, product: 0.1, analytics: 0.5 },   // Executive analytics
  ],
  ai_automation: [
    { dashboard: 0.6, product: 0.2, analytics: 0.2 },   // AI ops monitor
    { dashboard: 0.2, product: 0.6, analytics: 0.2 },   // AI product portal
    { dashboard: 0.3, product: 0.1, analytics: 0.6 },   // AI performance analytics
  ],
  general: [
    { dashboard: 0.6, product: 0.2, analytics: 0.2 },   // Balanced overview
    { dashboard: 0.2, product: 0.6, analytics: 0.2 },   // Client-facing
    { dashboard: 0.3, product: 0.1, analytics: 0.6 },   // Data-dense
  ],
};

// ─── Proposal title templates per archetype ───────────────────────────────

export const ARCHETYPE_TITLE_TEMPLATES: Record<Archetype, string[]> = {
  ops_monitoring: ['Ops Command Center', 'Client Ops Portal', 'Deep Ops Analytics'],
  lead_pipeline: ['Pipeline Tracker', 'Client Growth Portal', 'Conversion Analytics'],
  voice_analytics: ['Call Center Dashboard', 'Agent Performance Hub', 'Sentiment Deep-Dive'],
  content_automation: ['Content Calendar', 'Publishing Portal', 'Engagement Analytics'],
  data_integration: ['Sync Status Board', 'Data Portal', 'Pipeline Analytics'],
  client_reporting: ['Client Dashboard', 'White-Label Portal', 'Executive Analytics'],
  ai_automation: ['AI Ops Monitor', 'AI Product Portal', 'AI Performance Analytics'],
  general: ['Workflow Overview', 'Client Portal', 'Data Analytics'],
};

// ─── Public API ────────────────────────────────────────────────────────────

export interface ClassifyResult {
  /** Detected archetype */
  archetype: Archetype;
  /** Confidence score 0-1 based on signal matches */
  confidence: number;
  /** Which signals matched (for debugging) */
  matchedSignals: string[];
  /** 3 emphasis blend presets for proposal generation */
  blendPresets: EmphasisBlend[];
  /** 3 title templates */
  titleTemplates: string[];
}

/**
 * Classify a workflow into an archetype based on name, platform, and entity signals.
 *
 * Pure function — no I/O, no LLM calls. Returns in <1ms.
 *
 * @param workflowName - The workflow display name (e.g., "Lead Qualification Pipeline with ROI Trackers")
 * @param platformType - Platform slug (e.g., "n8n", "vapi", "make")
 * @param selectedEntities - Comma-separated entity names (e.g., "Leads, ROI Metrics, Pipeline Stages")
 */
export function classifyArchetype(
  workflowName: string,
  platformType: string,
  selectedEntities: string = '',
): ClassifyResult {
  const textToSearch = [
    workflowName,
    selectedEntities,
  ].join(' ').toLowerCase();

  const platformLower = platformType.toLowerCase();

  // Score each archetype
  const scores: Array<{ archetype: Archetype; score: number; matches: string[] }> = [];

  for (const [archetype, config] of Object.entries(ARCHETYPE_SIGNALS)) {
    if (archetype === 'general') continue; // Skip general — it's the fallback

    const matches: string[] = [];
    let score = 0;

    // Name/entity signal matches
    for (const signal of config.nameSignals) {
      if (textToSearch.includes(signal)) {
        matches.push(signal);
        score += 1;
      }
    }

    // Platform signal matches (worth 2x — very strong signal)
    for (const platform of config.platformSignals) {
      if (platformLower === platform || platformLower.includes(platform)) {
        matches.push(`platform:${platform}`);
        score += 2;
      }
    }

    const threshold = config.threshold ?? 1;
    if (score >= threshold) {
      scores.push({ archetype: archetype as Archetype, score, matches });
    }
  }

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  // Winner or fallback to general
  if (scores.length === 0) {
    return {
      archetype: 'general',
      confidence: 0.3,
      matchedSignals: [],
      blendPresets: ARCHETYPE_BLEND_PRESETS.general,
      titleTemplates: ARCHETYPE_TITLE_TEMPLATES.general,
    };
  }

  const winner = scores[0];
  // Confidence: cap at 0.95, scale by match count
  const confidence = Math.min(0.95, 0.4 + winner.score * 0.1);

  return {
    archetype: winner.archetype,
    confidence,
    matchedSignals: winner.matches,
    blendPresets: ARCHETYPE_BLEND_PRESETS[winner.archetype],
    titleTemplates: ARCHETYPE_TITLE_TEMPLATES[winner.archetype],
  };
}
