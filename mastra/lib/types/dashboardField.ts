// mastra/lib/types/dashboardField.ts
//
// Shared type contract for the dashboard generation pipeline.
// This is the SINGLE SOURCE OF TRUTH for field classification types.
//
// Used by:
//   - mastra/tools/generateMapping.ts (classifyField output)
//   - mastra/lib/semantics/applySemanticOverrides.ts (semantic enrichment)
//   - mastra/lib/policies/dashboardPolicy.ts (policy enforcement)
//   - mastra/tools/generateUISpec.ts (component builders)
//
// If you change this file, all consumers update automatically.
// That is the point — no duplicate interfaces, no type drift.

// ============================================================================
// Field Shape (from classifyField heuristics)
// ============================================================================

export type FieldShape =
  | 'id'
  | 'status'
  | 'binary'
  | 'timestamp'
  | 'duration'
  | 'money'
  | 'rate'
  | 'label'
  | 'high_cardinality_text'
  | 'long_text'
  | 'numeric'
  | 'unknown';

export type FieldRole = 'hero' | 'supporting' | 'trend' | 'breakdown' | 'detail';

export type SemanticSource = 'heuristic' | 'skill_override';

// ============================================================================
// Base Classified Field (output of classifyField)
// ============================================================================

export interface BaseClassifiedField {
  name: string;
  type: string;
  shape: FieldShape;
  component: string;
  aggregation: string;
  role: FieldRole;
  uniqueValues: number;
  totalRows: number;
  nullable: boolean;
  sample: unknown;
  skip: boolean;
  skipReason?: string;
}

// ============================================================================
// Dashboard Field (full pipeline field — after semantic + policy passes)
// This is the canonical type that flows through the entire pipeline.
// ============================================================================

export interface DashboardField extends BaseClassifiedField {
  /** Where this classification came from */
  semanticSource: SemanticSource;
  /** If identifier, points to human-readable companion field */
  references?: string;
  /** Human-readable display name from skill config */
  displayName?: string;
  /** The skill rule that was applied (for audit trail) */
  appliedRule?: {
    semantic_type: string;
    reason?: string;
    version: number;
  };
  /** Policy actions applied to this field (for explainability) */
  policyActions?: string[];
}

// ============================================================================
// Field Analysis Output (serializable subset for tool output / downstream)
// ============================================================================

export interface FieldAnalysisOutput {
  name: string;
  type: string;
  shape: string;
  component: string;
  aggregation: string;
  role: string;
  uniqueValues: number;
  totalRows: number;
  skip: boolean;
  skipReason?: string;
  semanticSource?: SemanticSource;
  references?: string;
  displayName?: string;
  policyActions?: string[];
}
