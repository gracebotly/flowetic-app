// mastra/lib/semantics/applySemanticOverrides.ts
//
// Post-classification pass that applies field-semantics.yaml rules
// on top of heuristic classifications from classifyField().
//
// Precedence model (deterministic, testable):
//   1. Heuristic classification (classifyField) — always runs first
//   2. Skill override (this function) — YAML rules win over heuristic
//   3. Safety guard — if a rule would make the dashboard empty, fall back
//
// Every override is logged with source attribution for observability.

import { loadFieldSemantics, getFieldRule, type FieldSemanticsConfig } from './fieldSemantics';
import type { DashboardField, BaseClassifiedField } from '../types/dashboardField';

// Re-export DashboardField as SemanticClassifiedField for backwards compatibility.
// All new code should import DashboardField directly from types/dashboardField.
export type SemanticClassifiedField = DashboardField;

// ============================================================================
// Override Logic
// ============================================================================

/**
 * Apply semantic overrides from field-semantics.yaml to heuristic classifications.
 *
 * This is the bridge between "skills" (YAML config) and "deterministic pipeline"
 * (classifyField). Skills stop being conversational-only; they now directly
 * control what gets charted, what gets skipped, and what labels appear.
 *
 * @param classified - Output of classifyField() for each field
 * @param platformType - Platform slug (e.g., "n8n", "make", "vapi")
 * @returns Fields with semantic overrides applied + observability metadata
 */
export function applySemanticOverrides(
  classified: BaseClassifiedField[],
  platformType: string,
): SemanticClassifiedField[] {
  let config: FieldSemanticsConfig | null = null;

  try {
    config = loadFieldSemantics(platformType);
  } catch (err) {
    // loadFieldSemantics throws on invalid YAML — log and fall back to heuristic
    console.error(`[applySemanticOverrides] Failed to load semantics for "${platformType}" — using heuristic only:`, err);
  }

  // Build a set of all field names for companion-field validation
  const allFieldNames = new Set(classified.map(f => f.name.toLowerCase()));

  const result: SemanticClassifiedField[] = classified.map(field => {
    const rule = getFieldRule(config, field.name);

    // No rule found — pass through with heuristic source tag
    if (!rule) {
      return {
        ...field,
        semanticSource: 'heuristic' as const,
        policyActions: [],
      };
    }

    // ── Apply the rule ─────────────────────────────────────────────
    const override: SemanticClassifiedField = {
      ...field,
      semanticSource: 'skill_override' as const,
      displayName: rule.display_name,
      references: rule.references,
      appliedRule: {
        semantic_type: rule.semantic_type,
        reason: rule.reason,
        version: config!.version,
      },
      policyActions: [],
    };

    // Role override
    if (rule.role) {
      override.role = rule.role;
    }

    // Aggregation override
    if (rule.aggregation && rule.aggregation !== 'none') {
      override.aggregation = rule.aggregation;
    }

    // Component preference override
    if (rule.component_preference) {
      override.component = rule.component_preference;
    }

    // ── Identifier resolution (the core fix) ───────────────────────
    // If this is an identifier with a references field, and the companion
    // field exists in the dataset, skip this field from charts.
    if (rule.semantic_type === 'identifier' && rule.references) {
      const companionExists = allFieldNames.has(rule.references.toLowerCase());
      if (companionExists) {
        override.skip = true;
        override.skipReason = `Identifier → references "${rule.references}" (companion exists) — use companion for labels`;
        override.component = 'MetricCard'; // count only
        override.aggregation = 'count';
      } else {
        // Companion doesn't exist — keep as MetricCard count but don't skip entirely
        console.warn(
          `[applySemanticOverrides] "${field.name}" references "${rule.references}" ` +
          'but companion field not found in dataset — keeping as MetricCard count'
        );
        override.component = 'MetricCard';
        override.aggregation = 'count';
        override.skip = false;
      }
    }

    // ── Surrogate key handling ──────────────────────────────────────
    // Surrogate keys (execution_id, call_id, session_id) are NEVER chart-eligible.
    // Force to MetricCard count regardless of heuristic classification.
    if (rule.semantic_type === 'surrogate_key') {
      override.component = 'MetricCard';
      override.aggregation = 'count';
      override.role = 'hero';
      // Don't skip — it becomes a "Total Runs" KPI card
      // But if it was classified as PieChart/BarChart by heuristic, override that
      if (['PieChart', 'BarChart', 'TimeseriesChart'].includes(field.component)) {
        override.skipReason = `Surrogate key — forced from ${field.component} to MetricCard count`;
      }
    }

    // ── Constant field handling ─────────────────────────────────────
    if (rule.semantic_type === 'constant') {
      override.skip = true;
      override.skipReason = rule.reason || 'Constant value — no information content';
    }

    // ── Chart eligibility enforcement ──────────────────────────────
    if (rule.chart_eligible === false) {
      // Not allowed in charts — if heuristic assigned a chart component, override
      if (['PieChart', 'BarChart', 'TimeseriesChart', 'LineChart'].includes(override.component)) {
        override.component = 'MetricCard';
      }
    }

    // ── Max pie cardinality guard ──────────────────────────────────
    if (
      rule.max_pie_cardinality &&
      override.component === 'PieChart' &&
      field.uniqueValues > rule.max_pie_cardinality
    ) {
      override.component = 'BarChart';
      console.log(
        `[applySemanticOverrides] "${field.name}" exceeded max_pie_cardinality ` +
        `(${field.uniqueValues} > ${rule.max_pie_cardinality}) — downgraded PieChart → BarChart`
      );
    }

    console.log(
      `[applySemanticOverrides] "${field.name}": ${field.shape}/${field.component} → ` +
      `${rule.semantic_type}/${override.component} (${rule.reason || 'skill rule'})`
    );

    return override;
  });

  // ── Safety guard: don't let skill rules make the dashboard empty ──
  const activeAfterOverrides = result.filter(f => !f.skip);
  if (activeAfterOverrides.length === 0 && classified.some(f => !f.skip)) {
    console.warn(
      '[applySemanticOverrides] SAFETY GUARD: All fields were skipped after overrides — ' +
      'reverting to heuristic classification to prevent empty dashboard'
    );
    return classified.map(f => ({
      ...f,
      semanticSource: 'heuristic' as const,
      policyActions: [],
    }));
  }

  // ── Observability summary ────────────────────────────────────────
  const overrideCount = result.filter(f => f.semanticSource === 'skill_override').length;
  const skipCount = result.filter(f => f.skip).length;
  console.log(
    `[applySemanticOverrides] Applied ${overrideCount}/${result.length} skill overrides, ` +
    `${skipCount} fields skipped, ${result.length - skipCount} active`
  );

  return result;
}
