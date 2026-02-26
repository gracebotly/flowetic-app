// mastra/lib/semantics/index.ts
// Barrel export for semantic layer

export { loadFieldSemantics, getFieldRule, clearSemanticsCache } from './fieldSemantics';
export type { FieldRule, FieldSemanticsConfig } from './fieldSemantics';
export { applySemanticOverrides } from './applySemanticOverrides';
export type { SemanticClassifiedField } from './applySemanticOverrides';
// Canonical type — prefer this import path for new code:
export type { DashboardField } from '../types/dashboardField';
