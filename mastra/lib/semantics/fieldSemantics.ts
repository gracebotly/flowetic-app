// mastra/lib/semantics/fieldSemantics.ts
//
// Loads and validates per-platform field-semantics.yaml files.
// These are "executable skills" — structured config that the deterministic
// generateMapping pipeline reads at classification time.
//
// Pattern: Same as dbt MetricFlow / Looker LookML, but lightweight & in-process.
// Skills stop being conversational-only and become executable configuration.

import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Schema (Zod validation — fail loudly with actionable errors)
// ============================================================================


function parseScalar(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseFieldSemanticsYaml(raw: string): unknown {
  const root: Record<string, unknown> = {};
  const stack: Array<{ indent: number; container: Record<string, unknown> }> = [{ indent: -1, container: root }];

  for (const originalLine of raw.split(/\r?\n/)) {
    const line = originalLine.replace(/	/g, '  ');
    if (!line.trim() || line.trim().startsWith('#')) continue;

    const indent = (line.match(/^ */)?.[0].length ?? 0);
    const trimmed = line.trim();
    const keyMatch = trimmed.match(/^([^:]+):(.*)$/);
    if (!keyMatch) continue;

    const key = keyMatch[1].trim();
    const valuePart = keyMatch[2].trim();

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    const parent = stack[stack.length - 1].container;

    if (valuePart === '') {
      const nextObj: Record<string, unknown> = {};
      parent[key] = nextObj;
      stack.push({ indent, container: nextObj });
    } else {
      parent[key] = parseScalar(valuePart);
    }
  }

  return root;
}

const FieldRuleSchema = z.object({
  semantic_type: z.enum([
    'identifier',      // Machine ID (workflow_id, scenario_id) — has `references` to label field
    'surrogate_key',   // Unique-per-row key (execution_id, call_id) — count only, never chart
    'dimension',       // Categorical label (workflow_name, status) — chart-eligible
    'measure',         // Numeric metric (duration_ms, cost) — aggregate with avg/sum
    'time_dimension',  // Temporal axis (started_at, ended_at) — trend charts
    'constant',        // Same value every row (platform) — skip
    'detail',          // Free text (error_message) — table only
  ]),
  references: z.string().optional(),
  chart_eligible: z.boolean(),
  aggregation: z.string(),
  role: z.enum(['hero', 'supporting', 'trend', 'breakdown', 'detail']),
  display_name: z.string().optional(),
  component_preference: z.string().optional(),
  max_pie_cardinality: z.number().optional(),
  unit: z.string().optional(),
  filter_value: z.string().optional(),
  reason: z.string().optional(),
});

const FieldSemanticsConfigSchema = z.object({
  version: z.number(),
  entity_type: z.string(),
  platform: z.string(),
  field_rules: z.record(z.string(), FieldRuleSchema),
});

export type FieldRule = z.infer<typeof FieldRuleSchema>;
export type FieldSemanticsConfig = z.infer<typeof FieldSemanticsConfigSchema>;

// ============================================================================
// Cache (per-platform, loaded once per process)
// ============================================================================

const semanticsCache = new Map<string, FieldSemanticsConfig | null>();

// ============================================================================
// Loader
// ============================================================================

/**
 * Load field semantics for a given platform.
 *
 * Resolution order:
 *   1. workspace/skills/{platform}/field-semantics.yaml
 *   2. workspace/skills/{platform}/field-semantics.yml
 *   3. null (no semantics — heuristic-only mode)
 *
 * Validates against Zod schema. Throws on invalid config (fail loudly).
 * Caches per platform for process lifetime.
 */
export function loadFieldSemantics(platform: string): FieldSemanticsConfig | null {
  const cacheKey = platform.toLowerCase();

  if (semanticsCache.has(cacheKey)) {
    return semanticsCache.get(cacheKey) ?? null;
  }

  const candidates = [
    path.resolve(process.cwd(), 'workspace', 'skills', cacheKey, 'field-semantics.yaml'),
    path.resolve(process.cwd(), 'workspace', 'skills', cacheKey, 'field-semantics.yml'),
  ];

  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = parseFieldSemanticsYaml(raw);
        const validated = FieldSemanticsConfigSchema.parse(parsed);

        console.log(
          `[fieldSemantics] Loaded v${validated.version} for "${platform}" — ` +
          `${Object.keys(validated.field_rules).length} field rules from ${path.basename(filePath)}`
        );

        semanticsCache.set(cacheKey, validated);
        return validated;
      } catch (err) {
        // Fail loudly — bad YAML should break the build, not silently skip
        const message = err instanceof z.ZodError
          ? `Field semantics validation failed for "${platform}":\n${err.errors.map(e => `  - ${e.path.join('.')}: ${e.message}`).join('\n')}`
          : `Failed to parse field-semantics.yaml for "${platform}": ${err}`;

        console.error(`[fieldSemantics] ${message}`);
        throw new Error(message);
      }
    }
  }

  // No semantics file — legitimate for platforms without config yet
  console.log(`[fieldSemantics] No field-semantics.yaml found for "${platform}" — using heuristic-only mode`);
  semanticsCache.set(cacheKey, null);
  return null;
}

/**
 * Look up the semantic rule for a specific field name.
 * Checks exact match first, then checks SEMANTIC_ALIASES from generateMapping
 * for canonical name resolution.
 */
export function getFieldRule(
  config: FieldSemanticsConfig | null,
  fieldName: string,
): FieldRule | null {
  if (!config) return null;
  const lower = fieldName.toLowerCase();

  // Exact match
  if (config.field_rules[lower]) return config.field_rules[lower];
  if (config.field_rules[fieldName]) return config.field_rules[fieldName];

  // Try common aliases (same aliases as SEMANTIC_ALIASES in generateMapping)
  const aliasMap: Record<string, string> = {
    workflowid: 'workflow_id',
    flow_id: 'workflow_id',
    flowid: 'workflow_id',
    automation_id: 'workflow_id',
    process_id: 'workflow_id',
    workflowname: 'workflow_name',
    scenario_name: 'scenario_name',
    automation_name: 'workflow_name',
    executionid: 'execution_id',
    run_id: 'execution_id',
    runid: 'execution_id',
    callid: 'call_id',
    sessionid: 'session_id',
    conversationid: 'conversation_id',
    message_id: 'execution_id', // treat as surrogate key
    startedat: 'started_at',
    start_time: 'started_at',
    starttime: 'started_at',
    created_at: 'started_at',
    createdat: 'started_at',
    endedat: 'ended_at',
    finished_at: 'ended_at',
    finishedat: 'ended_at',
    stopped_at: 'ended_at',
    stoppedat: 'ended_at',
    completed_at: 'ended_at',
    durationms: 'duration_ms',
    duration: 'duration_ms',
    elapsed_time: 'duration_ms',
    execution_time: 'duration_ms',
    runtime: 'duration_ms',
    error_message: 'error_message',
    errormessage: 'error_message',
    error: 'error_message',
    failure_reason: 'error_message',
    agentid: 'agent_id',
    agentname: 'agent_name',
    scenarioid: 'scenario_id',
  };

  const canonical = aliasMap[lower] || aliasMap[fieldName];
  if (canonical && config.field_rules[canonical]) {
    return config.field_rules[canonical];
  }

  return null;
}

/**
 * Clear the semantics cache (useful for testing).
 */
export function clearSemanticsCache(): void {
  semanticsCache.clear();
}
