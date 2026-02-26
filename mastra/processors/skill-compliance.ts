import type {
  Processor,
  ProcessOutputStepArgs,
  ProcessOutputResultArgs,
} from '@mastra/core/processors';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

export const SkillSearchEntrySchema = z.object({
  domain: z.string(),
  query: z.string(),
  result_count: z.number(),
  timestamp: z.string().datetime(),
});

export const ToolCallEntrySchema = z.object({
  name: z.string(),
  step: z.number(),
  args_summary: z.record(z.string(), z.unknown()).optional(),
});

export const ComplianceRecordSchema = z.object({
  tenant_id: z.string().uuid(),
  journey_thread_id: z.string().nullable(),
  phase: z.string(),
  grounded: z.boolean(),
  enforcement_decision: z.enum(['allowed', 'warned', 'blocked']),
  skill_searches: z.array(SkillSearchEntrySchema),
  design_tools_used: z.array(z.string()),
  business_skill_used: z.boolean(),
  dashboard_skill_used: z.boolean(),
  tool_calls: z.array(ToolCallEntrySchema),
  required_domains: z.array(z.string()),
  domains_satisfied: z.array(z.string()),
  domains_missing: z.array(z.string()),
  total_steps: z.number(),
  created_at: z.string().datetime(),
});

export type ComplianceRecord = z.infer<typeof ComplianceRecordSchema>;

// ─── Phase-Specific Domain Requirements ──────────────────────────────────────

const PHASE_REQUIRED_DOMAINS: Record<string, string[]> = {
  propose: ['business'],
  build_edit: ['design'],
  deploy: [], // No skill requirements for deploy
};

// Design tools that satisfy the "design" domain requirement
const DESIGN_TOOL_NAMES = new Set([
  'getStyleRecommendations',
  'getColorRecommendations',
  'getTypographyRecommendations',
  'getChartRecommendations',
  'getIconRecommendations',
  'getUXGuidelines',
  'getProductRecommendations',
  'runDesignSystemWorkflow',
  'delegateToDesignAdvisor',
]);

// ─── Processor Implementation ────────────────────────────────────────────────

/**
 * SkillComplianceProcessor — Mastra-native compliance and enforcement layer.
 *
 * Lives inside the agent graph as an output processor. Runs after each LLM step
 * to inspect tool calls, then runs once after generation completes to evaluate
 * compliance and persist a structured record to Supabase.
 *
 * Architecture:
 * - processOutputStep: Accumulates tool call metadata across all steps
 * - processOutputResult: Evaluates final compliance, persists to DB
 *
 * NOT in route.ts. NOT console logs. NOT heuristics.
 * Compliance derives from actual tool arguments only.
 */
export class SkillComplianceProcessor implements Processor {
  readonly id = 'skill-compliance';
  readonly name = 'Skill Compliance Processor';

  // Mutable state accumulated across steps within a single stream.
  // Reset in processOutputResult after persistence.
  private skillSearches: z.infer<typeof SkillSearchEntrySchema>[] = [];
  private toolCallLog: z.infer<typeof ToolCallEntrySchema>[] = [];
  private designToolsUsed: Set<string> = new Set();
  private domainsSatisfied: Set<string> = new Set();
  private stepCount = 0;

  // ─── processOutputStep ──────────────────────────────────────────────────
  // Runs after EACH LLM step. Receives typed toolCalls with arguments.
  // Inspects searchSkillKnowledge args, design tool usage, all tool calls.
  // This is Upgrade 1: Tool Argument Inspection (Real Grounding Verification).

  async processOutputStep({
    toolCalls,
    stepNumber,
    requestContext,
  }: ProcessOutputStepArgs) {
    this.stepCount = (stepNumber ?? 0) + 1;

    if (!toolCalls || toolCalls.length === 0) {
      return [];
    }

    for (const tc of toolCalls) {
      // Mastra ProcessOutputStepArgs.toolCalls provides toolName and args
      const toolName: string = (tc as any).toolName ?? (tc as any).name ?? 'unknown';
      const args: Record<string, unknown> = (tc as any).args ?? {};

      // Log every tool call
      this.toolCallLog.push({
        name: toolName,
        step: stepNumber ?? 0,
        args_summary: this.summarizeArgs(args),
      });

      // ── searchSkillKnowledge inspection ─────────────────────────────
      if (toolName === 'searchSkillKnowledge') {
        const domain = String(args.domain ?? 'all');
        const query = String(args.query ?? '');

        this.skillSearches.push({
          domain,
          query,
          result_count: -1, // Not available in processOutputStep; -1 = unknown
          timestamp: new Date().toISOString(),
        });

        // Map search domain to compliance domains
        if (domain === 'business' || domain === 'all') {
          this.domainsSatisfied.add('business');
        }
        if (domain === 'design' || domain === 'dashboard' || domain === 'all') {
          this.domainsSatisfied.add('design');
          this.domainsSatisfied.add('dashboard');
        }
      }

      // ── Design tool inspection ──────────────────────────────────────
      if (DESIGN_TOOL_NAMES.has(toolName)) {
        this.designToolsUsed.add(toolName);
        this.domainsSatisfied.add('design');
      }

      // ── Dashboard delegation inspection ─────────────────────────────
      if (toolName === 'delegateToDashboardBuilder' || toolName === 'delegateToPlatformMapper') {
        this.domainsSatisfied.add('dashboard');
      }
    }

    return [];
  }

  // ─── processOutputResult ────────────────────────────────────────────────
  // Runs ONCE after generation completes. Evaluates final compliance,
  // builds Zod-validated record, persists to skill_compliance_logs.
  // This is Upgrade 2 (DB Persistence) and Upgrade 3 (Enforcement).

  async processOutputResult({
    messages,
    requestContext,
    abort,
  }: ProcessOutputResultArgs) {
    const tenantId = requestContext?.get?.('tenantId') as string | undefined;
    const phase = requestContext?.get?.('phase') as string ?? 'propose';
    const journeyThreadId = requestContext?.get?.('journeyThreadId') as string | undefined;

    // Skip compliance if no tenant context (e.g. health check, non-journey requests)
    if (!tenantId) {
      this.resetState();
      return [];
    }

    // Determine required domains for this phase
    const requiredDomains = PHASE_REQUIRED_DOMAINS[phase] ?? [];
    const domainsMissing = requiredDomains.filter(d => !this.domainsSatisfied.has(d));
    const grounded = domainsMissing.length === 0 || requiredDomains.length === 0;

    // Enforcement decision
    // Phase 3 launch: 'warned' for non-compliance (observability first).
    // Phase 4 upgrade: switch to 'blocked' for critical paths.
    const enforcementDecision: 'allowed' | 'warned' | 'blocked' =
      grounded ? 'allowed' : 'warned';

    // Build Zod-validated record
    const now = new Date().toISOString();
    const rawRecord = {
      tenant_id: tenantId,
      journey_thread_id: journeyThreadId ?? null,
      phase,
      grounded,
      enforcement_decision: enforcementDecision,
      skill_searches: this.skillSearches,
      design_tools_used: Array.from(this.designToolsUsed),
      business_skill_used: this.domainsSatisfied.has('business'),
      dashboard_skill_used: this.domainsSatisfied.has('dashboard'),
      tool_calls: this.toolCallLog,
      required_domains: requiredDomains,
      domains_satisfied: Array.from(this.domainsSatisfied),
      domains_missing: domainsMissing,
      total_steps: this.stepCount,
      created_at: now,
    };

    // Validate with Zod before writing
    const parseResult = ComplianceRecordSchema.safeParse(rawRecord);
    if (parseResult.success) {
      await this.persistComplianceRecord(parseResult.data);
    } else {
      console.error('[SkillCompliance] Zod validation failed:', parseResult.error.message);
      // Still try to persist the raw record for debugging
      await this.persistComplianceRecord(rawRecord as ComplianceRecord);
    }

    // Log summary (minimal — the DB record is the source of truth)
    if (!grounded && requiredDomains.length > 0) {
      console.warn(
        `[SkillCompliance] ⚠️ UNGROUNDED: phase=${phase} missing=[${domainsMissing.join(',')}] ` +
        `searches=${this.skillSearches.length} tools=${this.toolCallLog.length}`,
      );
    }

    // Reset state for next stream
    this.resetState();

    // Enforcement (Upgrade 3) — currently 'warned' mode.
    // Uncomment to enable hard blocking in Phase 4:
    //
    // if (enforcementDecision === 'blocked') {
    //   abort(
    //     `[SkillCompliance] Phase "${phase}" requires skill domains: [${domainsMissing.join(', ')}]. ` +
    //     `Agent did not call searchSkillKnowledge for these domains.`
    //   );
    // }

    return [];
  }

  // ─── Private Helpers ────────────────────────────────────────────────────

  /**
   * Summarize tool arguments for the compliance log.
   * Keeps string/number/boolean args, truncates long strings, labels objects by type.
   */
  private summarizeArgs(args: Record<string, unknown>): Record<string, unknown> {
    const summary: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(args)) {
      if (typeof value === 'string') {
        summary[key] = value.length > 200 ? value.substring(0, 200) + '...' : value;
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        summary[key] = value;
      } else if (value === null || value === undefined) {
        summary[key] = value;
      } else {
        summary[key] = `[${typeof value}]`;
      }
    }
    return summary;
  }

  /**
   * Persist compliance record to Supabase via service role client.
   * Non-fatal: logs error but does NOT crash the stream.
   */
  private async persistComplianceRecord(record: ComplianceRecord): Promise<void> {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseServiceKey) {
        console.warn('[SkillCompliance] Missing Supabase env vars — skipping DB persistence');
        return;
      }

      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { error } = await supabase
        .from('skill_compliance_logs')
        .insert({
          tenant_id: record.tenant_id,
          journey_thread_id: record.journey_thread_id,
          phase: record.phase,
          grounded: record.grounded,
          enforcement_decision: record.enforcement_decision,
          skill_searches: record.skill_searches,
          design_tools_used: record.design_tools_used,
          business_skill_used: record.business_skill_used,
          dashboard_skill_used: record.dashboard_skill_used,
          tool_calls: record.tool_calls,
          required_domains: record.required_domains,
          domains_satisfied: record.domains_satisfied,
          domains_missing: record.domains_missing,
          total_steps: record.total_steps,
        });

      if (error) {
        console.error('[SkillCompliance] DB write failed:', error.message);
      }
    } catch (err) {
      console.error('[SkillCompliance] Persistence error (non-fatal):', err);
    }
  }

  /**
   * Reset all accumulated state for the next stream.
   */
  private resetState(): void {
    this.skillSearches = [];
    this.toolCallLog = [];
    this.designToolsUsed = new Set();
    this.domainsSatisfied = new Set();
    this.stepCount = 0;
  }
}
