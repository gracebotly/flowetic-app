// mastra/lib/specAutoFixer.ts
//
// Phase 4: Deterministic spec auto-fixer.
// Runs BEFORE validation scoring in validateSpec.ts.
// Catches and repairs common spec errors without LLM re-generation.
//
// Design principle: Never invent data. Only fix structural/constraint violations.
// Every fix is logged for observability.

import { getSkeleton, ALL_SKELETON_IDS, type SkeletonId } from './layout/skeletons';

// ============================================================================
// Types
// ============================================================================

export interface AutoFixResult {
  /** The repaired spec (mutated copy — original is not modified) */
  spec: Record<string, any>;
  /** Human-readable descriptions of every fix applied */
  fixes: string[];
  /** Total number of fixes applied */
  fixCount: number;
}

interface ComponentLayout {
  col: number;
  row: number;
  w: number;
  h: number;
}

// ============================================================================
// Per-component-type minimum sizes
// ============================================================================

const MIN_SIZES: Record<string, { w: number; h: number }> = {
  MetricCard: { w: 2, h: 1 },
  TimeseriesChart: { w: 4, h: 2 },
  BarChart: { w: 4, h: 2 },
  PieChart: { w: 4, h: 2 },
  DonutChart: { w: 4, h: 2 },
  AreaChart: { w: 4, h: 2 },
  ScatterChart: { w: 4, h: 2 },
  DataTable: { w: 6, h: 3 },
  StatusFeed: { w: 4, h: 3 },
  InsightCard: { w: 4, h: 2 },
  HeroSection: { w: 12, h: 2 },
  FeatureGrid: { w: 12, h: 2 },
  PricingCards: { w: 12, h: 2 },
  CTASection: { w: 12, h: 1 },
  PageHeader: { w: 12, h: 1 },
  FilterBar: { w: 12, h: 1 },
  CRUDTable: { w: 6, h: 3 },
  UIHeader: { w: 12, h: 1 },
  SectionHeader: { w: 12, h: 1 },
  Pagination: { w: 12, h: 1 },
  AuthForm: { w: 4, h: 4 },
  BrandVisual: { w: 4, h: 4 },
  EmptyStateCard: { w: 4, h: 3 },
};

// ============================================================================
// Required props per component type (only truly critical defaults)
// ============================================================================

const REQUIRED_PROP_DEFAULTS: Record<string, Record<string, unknown>> = {
  MetricCard: {
    title: 'Metric',
    valueField: 'value',
    aggregation: 'count',
  },
  TimeseriesChart: {
    xAxisField: 'timestamp',
    yAxisField: 'value',
    title: 'Trend',
  },
  BarChart: {
    xAxisField: 'category',
    yAxisField: 'value',
    title: 'Breakdown',
  },
  PieChart: {
    categoryField: 'category',
    valueField: 'value',
    title: 'Distribution',
  },
  DonutChart: {
    categoryField: 'category',
    valueField: 'value',
    title: 'Distribution',
  },
  DataTable: {
    columns: [],
    title: 'Records',
  },
};

// ============================================================================
// Main AutoFixer
// ============================================================================

/**
 * Deterministic auto-fixer for UI specs.
 * Applies 10 repair rules in order. Each rule is independent and idempotent.
 *
 * @param rawSpec - The spec to fix (will be deep-cloned, not mutated)
 * @param designTokens - Optional design tokens for color validation
 * @returns AutoFixResult with repaired spec, fix descriptions, and count
 */
export function autoFixSpec(
  rawSpec: Record<string, any>,
  designTokens?: Record<string, any>,
): AutoFixResult {
  // Wolf V2 Phase 3: structuredClone is immune to prototype pollution attacks
  // that can occur with JSON round-tripping when __proto__ keys are present.
  // Available in Node.js 17+ (we're on Node 20+).
  const spec = structuredClone(rawSpec);
  const fixes: string[] = [];

  if (!spec.components || !Array.isArray(spec.components)) {
    // Nothing to fix if no components exist
    return { spec, fixes, fixCount: 0 };
  }

  const gridColumns = spec.layout?.columns || 12;

  // ── Rule 1: Skeleton KPI limits ─────────────────────────────────────
  // If spec has a layoutSkeletonId, enforce that skeleton's maxKPIs
  if (spec.layoutSkeletonId && ALL_SKELETON_IDS.includes(spec.layoutSkeletonId)) {
    try {
      const skeleton = getSkeleton(spec.layoutSkeletonId as SkeletonId);
      const kpiComponents = spec.components.filter(
        (c: any) => c.type === 'MetricCard'
      );

      if (kpiComponents.length > skeleton.maxKPIs && skeleton.maxKPIs > 0) {
        const excessCount = kpiComponents.length - skeleton.maxKPIs;
        // Keep the first N, remove the rest
        const kpiIds = kpiComponents.map((c: any) => c.id);
        const removeIds = new Set(kpiIds.slice(skeleton.maxKPIs));

        spec.components = spec.components.filter(
          (c: any) => !removeIds.has(c.id)
        );

        fixes.push(
          `Rule 1 (KPI limit): Trimmed ${excessCount} excess KPI(s) to skeleton "${spec.layoutSkeletonId}" max of ${skeleton.maxKPIs}`
        );
      }
    } catch {
      // Invalid skeleton ID — skip rule, don't crash
    }
  }

  // ── Rule 2: Grid overflow — components exceeding column boundary ────
  for (const comp of spec.components) {
    const layout: ComponentLayout = comp.layout;
    if (!layout) continue;

    const endCol = layout.col + layout.w;
    if (endCol > gridColumns) {
      const oldW = layout.w;
      layout.w = Math.max(1, gridColumns - layout.col);
      fixes.push(
        `Rule 2 (Grid overflow): Component "${comp.id}" shrank width from ${oldW} to ${layout.w} (was ending at col ${endCol}, max ${gridColumns})`
      );
    }

    // Also fix col itself if out of bounds
    if (layout.col >= gridColumns) {
      const oldCol = layout.col;
      layout.col = 0;
      layout.w = Math.min(layout.w, gridColumns);
      fixes.push(
        `Rule 2 (Grid overflow): Component "${comp.id}" col reset from ${oldCol} to 0 (was beyond grid)`
      );
    }
  }

  // ── Rule 3: Overlapping components — detect grid collisions ─────────
  // Sort components by row, then col for deterministic processing
  const sorted = [...spec.components].sort((a: any, b: any) => {
    const rowDiff = (a.layout?.row || 0) - (b.layout?.row || 0);
    if (rowDiff !== 0) return rowDiff;
    return (a.layout?.col || 0) - (b.layout?.col || 0);
  });

  // Build occupancy map and shift down on collision
  const occupancy: Array<{ id: string; row: number; col: number; w: number; h: number }> = [];

  for (const comp of sorted) {
    const layout: ComponentLayout = comp.layout;
    if (!layout) continue;

    let collision = true;
    let shiftAttempts = 0;
    const maxShifts = 20; // Safety valve

    while (collision && shiftAttempts < maxShifts) {
      collision = false;
      for (const placed of occupancy) {
        // Check AABB overlap
        const overlapsHorizontally =
          layout.col < placed.col + placed.w && layout.col + layout.w > placed.col;
        const overlapsVertically =
          layout.row < placed.row + placed.h && layout.row + layout.h > placed.row;

        if (overlapsHorizontally && overlapsVertically) {
          const oldRow = layout.row;
          layout.row = placed.row + placed.h; // Shift below the conflicting component
          fixes.push(
            `Rule 3 (Overlap): Component "${comp.id}" shifted from row ${oldRow} to ${layout.row} (collided with "${placed.id}")`
          );
          collision = true;
          break; // Re-check from the start of occupancy
        }
      }
      shiftAttempts++;
    }

    occupancy.push({
      id: comp.id,
      row: layout.row,
      col: layout.col,
      w: layout.w,
      h: layout.h,
    });
  }

  // ── Rule 4: Missing required props — add safe defaults ──────────────
  for (const comp of spec.components) {
    const defaults = REQUIRED_PROP_DEFAULTS[comp.type];
    if (!defaults) continue;
    if (!comp.props) comp.props = {};

    for (const [key, defaultValue] of Object.entries(defaults)) {
      if (comp.props[key] === undefined || comp.props[key] === null || comp.props[key] === '') {
        comp.props[key] = defaultValue;
        fixes.push(
          `Rule 4 (Missing prop): Component "${comp.id}" (${comp.type}) added default "${key}"`
        );
      }
    }
  }

  // ── Rule 5: Color validation against design tokens ──────────────────
  if (designTokens?.colors) {
    const validColors = new Set(
      Object.values(designTokens.colors).filter(
        (v): v is string => typeof v === 'string' && v.startsWith('#')
      )
    );

    for (const comp of spec.components) {
      if (!comp.props) continue;

      // Check color-like props
      for (const [key, value] of Object.entries(comp.props)) {
        if (
          typeof value === 'string' &&
          value.startsWith('#') &&
          value.length >= 4 &&
          !validColors.has(value) &&
          (key.toLowerCase().includes('color') || key.toLowerCase().includes('fill'))
        ) {
          const oldColor = value;
          comp.props[key] = designTokens.colors.primary || '#6366F1';
          fixes.push(
            `Rule 5 (Color mismatch): Component "${comp.id}" prop "${key}" changed from ${oldColor} to ${comp.props[key]} (not in design tokens)`
          );
        }
      }
    }
  }

  // ── Rule 6: Minimum component sizes ─────────────────────────────────
  for (const comp of spec.components) {
    const layout: ComponentLayout = comp.layout;
    if (!layout) continue;

    const minSize = MIN_SIZES[comp.type];
    if (!minSize) continue;

    if (layout.w < minSize.w) {
      const oldW = layout.w;
      layout.w = minSize.w;
      fixes.push(
        `Rule 6 (Min size): Component "${comp.id}" (${comp.type}) width expanded from ${oldW} to ${minSize.w}`
      );
    }

    if (layout.h < minSize.h) {
      const oldH = layout.h;
      layout.h = minSize.h;
      fixes.push(
        `Rule 6 (Min size): Component "${comp.id}" (${comp.type}) height expanded from ${oldH} to ${minSize.h}`
      );
    }
  }

  // ── Rule 7: Duplicate IDs — append suffix ───────────────────────────
  const seenIds = new Map<string, number>();
  for (const comp of spec.components) {
    if (!comp.id) {
      comp.id = `auto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      fixes.push(`Rule 7 (Missing ID): Generated ID "${comp.id}" for component of type "${comp.type}"`);
      continue;
    }

    const count = seenIds.get(comp.id) || 0;
    if (count > 0) {
      const oldId = comp.id;
      comp.id = `${oldId}-dup${count}`;
      fixes.push(
        `Rule 7 (Duplicate ID): Renamed "${oldId}" to "${comp.id}" (occurrence #${count + 1})`
      );
    }
    seenIds.set(comp.id.replace(/-dup\d+$/, ''), count + 1);
  }

  // ── Rule 8: Single dominant enforcement ─────────────────────────────
  const dominantComponents = spec.components.filter(
    (c: any) => c.props?.dominant === true || c.layout?.dominant === true
  );

  if (dominantComponents.length > 1) {
    // Keep only the first dominant, un-mark the rest
    for (let i = 1; i < dominantComponents.length; i++) {
      const comp = dominantComponents[i];
      if (comp.props?.dominant) comp.props.dominant = false;
      if (comp.layout?.dominant) comp.layout.dominant = false;
      fixes.push(
        `Rule 8 (Single dominant): Removed dominant flag from "${comp.id}" (only first dominant kept)`
      );
    }
  }

  // ── Rule 9: Spacing token enforcement ───────────────────────────────
  // Reject arbitrary gap values — must match skeleton spacing presets
  const validGaps = [8, 12, 16, 20, 24, 28, 32]; // Covers compact(16), comfortable(24), narrative(28)
  if (spec.layout?.gap && typeof spec.layout.gap === 'number') {
    if (!validGaps.includes(spec.layout.gap)) {
      const oldGap = spec.layout.gap;
      // Snap to nearest valid gap
      spec.layout.gap = validGaps.reduce((prev, curr) =>
        Math.abs(curr - oldGap) < Math.abs(prev - oldGap) ? curr : prev
      );
      fixes.push(
        `Rule 9 (Spacing): Layout gap snapped from ${oldGap}px to ${spec.layout.gap}px (nearest valid preset)`
      );
    }
  }

  // ── Rule 10: Accessibility minimums ─────────────────────────────────
  // MetricCard font sizes must be ≥ 14px for readability
  for (const comp of spec.components) {
    if (comp.type !== 'MetricCard') continue;
    if (!comp.props) continue;

    const fontSize = comp.props.fontSize || comp.props.valueFontSize;
    if (typeof fontSize === 'number' && fontSize < 14) {
      const oldSize = fontSize;
      if (comp.props.fontSize) comp.props.fontSize = 14;
      if (comp.props.valueFontSize) comp.props.valueFontSize = 14;
      fixes.push(
        `Rule 10 (Accessibility): Component "${comp.id}" font size raised from ${oldSize}px to 14px (minimum for MetricCard)`
      );
    }
  }



  // ── Rule 11: Max 3 distinct chart types per view ────────────────────
  // Premium dashboards never mix more than 3 chart types. Visual chaos
  // from 5+ chart types is the #1 reason generated UIs look "AI-made."
  // When exceeded, convert the least-used chart types to the dominant type.
  const CHART_TYPES = new Set([
    'TimeseriesChart', 'BarChart', 'PieChart', 'DonutChart', 'AreaChart', 'LineChart',
  ]);
  const MAX_CHART_TYPES = 3;

  const chartComponents = spec.components.filter(
    (c: any) => CHART_TYPES.has(c.type),
  );

  if (chartComponents.length > 0) {
    // Count occurrences of each chart type
    const typeCount = new Map<string, number>();
    for (const c of chartComponents) {
      typeCount.set(c.type, (typeCount.get(c.type) || 0) + 1);
    }

    if (typeCount.size > MAX_CHART_TYPES) {
      // Sort by frequency descending — keep the top 3 most-used types
      const sorted = [...typeCount.entries()].sort((a, b) => b[1] - a[1]);
      const keepTypes = new Set(sorted.slice(0, MAX_CHART_TYPES).map(([t]) => t));

      // The dominant type is the most-used one — least-used types convert to this
      const dominantChartType = sorted[0][0];

      // Convert least-used chart types to the dominant type
      const convertedTypes: string[] = [];
      for (const comp of spec.components) {
        if (CHART_TYPES.has(comp.type) && !keepTypes.has(comp.type)) {
          const oldType = comp.type;
          comp.type = dominantChartType;
          if (!comp.props) comp.props = {};

          // Remap props if converting between incompatible chart types
          // (e.g., PieChart uses categoryField, TimeseriesChart uses xAxisField)
          if (dominantChartType === 'TimeseriesChart' || dominantChartType === 'LineChart' || dominantChartType === 'AreaChart') {
            // Target is a time/axis chart — ensure xAxisField and yAxisField exist
            if (!comp.props.xAxisField && comp.props.categoryField) {
              comp.props.xAxisField = comp.props.categoryField;
              delete comp.props.categoryField;
            }
            if (!comp.props.yAxisField) {
              comp.props.yAxisField = comp.props.valueField || 'count';
            }
          } else if (dominantChartType === 'PieChart' || dominantChartType === 'DonutChart') {
            // Target is a categorical chart — ensure categoryField and valueField exist
            if (!comp.props.categoryField && comp.props.xAxisField) {
              comp.props.categoryField = comp.props.xAxisField;
              delete comp.props.xAxisField;
            }
            if (!comp.props.valueField) {
              comp.props.valueField = comp.props.yAxisField || 'count';
            }
          } else if (dominantChartType === 'BarChart') {
            // BarChart can work with either prop set — prefer xAxisField/yAxisField
            if (!comp.props.xAxisField && comp.props.categoryField) {
              comp.props.xAxisField = comp.props.categoryField;
            }
            if (!comp.props.yAxisField) {
              comp.props.yAxisField = comp.props.valueField || 'count';
            }
          }

          if (!convertedTypes.includes(oldType)) convertedTypes.push(oldType);
        }
      }

      if (convertedTypes.length > 0) {
        fixes.push(
          `Rule 11 (Max chart types): ${typeCount.size} chart types exceeded max ${MAX_CHART_TYPES}. ` +
          `Converted ${convertedTypes.join(', ')} → ${dominantChartType} (dominant by frequency).`,
        );
      }
    }
  }
  // ── Log summary ─────────────────────────────────────────────────────
  if (fixes.length > 0) {
    console.log(`[specAutoFixer] Applied ${fixes.length} fix(es):`, fixes);
  } else {
    console.log('[specAutoFixer] Spec passed — 0 fixes needed');
  }

  return {
    spec,
    fixes,
    fixCount: fixes.length,
  };
}
