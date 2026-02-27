// mastra/lib/generateProposals.ts
// ============================================================================
// Parallel proposal generator for the 2-phase journey.
//
// Orchestrates:
// 1. classifyArchetype() — pure logic, <1ms
// 2. 3× designSystemWorkflow — parallel execution with variety parameters
// 3. buildWireframeLayout() — deterministic layout generation per blend
// 4. Assembly into Proposal[] for persistence + streaming to frontend
//
// Called from: route.ts handleDeterministicPropose() (Wave 3)
// Persists to: journey_sessions.proposals (JSONB)
// ============================================================================

import type {
  Archetype,
  EmphasisBlend,
  Proposal,
  ProposalDesignSystem,
  ProposalsPayload,
  WireframeComponent,
  WireframeLayout,
} from '@/types/proposal';
import { exploreGoals } from './goalExplorer';
import { isDarkBackground } from '../tools/uiux/mapCSVToTokens';
import type { GoalExplorerResult } from '@/types/proposal';

/**
 * Compute a simplified perceptual color distance across multiple color slots.
 * Uses weighted Euclidean distance in RGB space (not full CIEDE2000,
 * but sufficient for "are these two palettes visually distinct?").
 *
 * Returns a number 0-100+. Below 25 = too similar for distinct proposals.
 */
function computeSimpleDeltaE(
  primary1: string, primary2: string,
  accent1: string, accent2: string,
  bg1: string, bg2: string,
): number {
  const dist = (a: string, b: string) => {
    const ca = a.replace('#', '');
    const cb = b.replace('#', '');
    if (ca.length !== 6 || cb.length !== 6) return 0;
    const dr = parseInt(ca.substring(0, 2), 16) - parseInt(cb.substring(0, 2), 16);
    const dg = parseInt(ca.substring(2, 4), 16) - parseInt(cb.substring(2, 4), 16);
    const db = parseInt(ca.substring(4, 6), 16) - parseInt(cb.substring(4, 6), 16);
    // Weighted: human eye is most sensitive to green, least to blue
    return Math.sqrt(2 * dr * dr + 4 * dg * dg + 3 * db * db);
  };
  // Primary has highest weight (0.5), accent (0.3), background (0.2)
  return dist(primary1, primary2) * 0.5 + dist(accent1, accent2) * 0.3 + dist(bg1, bg2) * 0.2;
}

function shiftHueHex(hex: string, degrees: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return hex;
  let r = parseInt(clean.substring(0, 2), 16) / 255;
  let g = parseInt(clean.substring(2, 4), 16) / 255;
  let b = parseInt(clean.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  h = ((h * 360 + degrees) % 360) / 360;
  if (h < 0) h += 1;
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (c: number) => Math.round(c * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

// ─── Data Availability Assessment ─────────────────────────────────────────
// Queries actual event data BEFORE generating proposals to ensure
// proposals only promise what the data can deliver.

interface DataInsight {
  /** e.g. "success_rate", "avg_duration", "top_error", "event_frequency" */
  metric: string;
  /** Human-readable label, e.g. "Success Rate" */
  label: string;
  /** Computed value, e.g. 0.87, 4200, "timeout" */
  value: string | number;
  /** Optional unit, e.g. "%", "ms", "per day" */
  unit?: string;
}

type SupportedGoal =
  | 'success_rate_tracking'
  | 'duration_performance'
  | 'error_analysis'
  | 'execution_timeline'
  | 'volume_trends'
  | 'status_breakdown'
  | 'multi_type_comparison'
  | 'simple_event_count';

interface DataAvailability {
  totalEvents: number;
  eventTypes: string[];
  availableFields: string[];
  fieldShapes: Record<string, 'status' | 'timestamp' | 'duration' | 'identifier' | 'text' | 'numeric'>;
  dataRichness: 'rich' | 'moderate' | 'sparse' | 'minimal';
  canSupportTimeseries: boolean;
  canSupportBreakdowns: boolean;
  usableFieldCount: number;
  /** NEW Phase A: Computed statistics from actual event values */
  insights: DataInsight[];
  /** NEW Phase A: What visualization goals the data can actually support */
  supportedGoals: SupportedGoal[];
  /** NEW Phase A: Natural language summary for LLM grounding (Phase B) */
  naturalSummary: string;
  /** NEW Phase A: Time span of the data in hours */
  timeSpanHours: number;
}

function inferFieldShape(fieldName: string, sampleValue: unknown): DataAvailability['fieldShapes'][string] {
  const name = fieldName.toLowerCase();

  // ── Identifiers (skip these for visualization) ────────────────────
  if (name.includes('_id') || name === 'id') return 'identifier';

  // ── Status / binary (categorical with few values) ─────────────────
  if (name.includes('status') || name.includes('state') || name.includes('result') || name.includes('outcome')) return 'status';
  // Boolean fields: qualified, is_hot, approved, active, etc.
  if (typeof sampleValue === 'boolean') return 'status';
  if (name.startsWith('is_') || name.startsWith('has_') || name === 'qualified' || name === 'approved' || name === 'active') return 'status';

  // ── Timestamps ────────────────────────────────────────────────────
  if (name.includes('_at') || name.includes('time') || name.includes('date') || name.includes('timestamp')) return 'timestamp';

  // ── Durations ─────────────────────────────────────────────────────
  if (name.includes('duration') || name.includes('elapsed') || name.includes('_ms') || name.includes('_seconds')) return 'duration';

  // ── Numeric: distinguish rates/scores from raw numbers ────────────
  if (typeof sampleValue === 'number' || (typeof sampleValue === 'string' && !isNaN(Number(sampleValue)) && sampleValue.trim() !== '')) {
    // Scores and rates (0-100 range, or field name suggests it)
    if (name.includes('score') || name.includes('rating') || name.includes('rate') || name.includes('confidence') || name.includes('percent')) return 'numeric';
    // Money / budget / revenue (large numbers or money-related names)
    if (name.includes('budget') || name.includes('cost') || name.includes('price') || name.includes('revenue') || name.includes('amount') || name.includes('spend')) return 'numeric';
    return 'numeric';
  }

  // ── Categorical text (known business dimension fields) ────────────
  // These are LOW cardinality text fields that make great breakdowns/pie charts.
  // The name-based heuristic catches common business fields from n8n workflow outputs.
  const CATEGORICAL_PATTERNS = [
    'industry', 'sector', 'category', 'type', 'segment', 'tier',
    'source', 'channel', 'region', 'country', 'city', 'department',
    'priority', 'level', 'stage', 'phase', 'plan', 'size',
    'lead_source', 'campaign', 'referral', 'medium',
  ];
  if (CATEGORICAL_PATTERNS.some(pat => name === pat || name.includes(pat))) return 'status';

  return 'text';
}

function humanizeLabel(fieldName: string): string {
  return fieldName
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, c => c.toUpperCase());
}

async function assessDataAvailability(
  supabase: any,
  tenantId: string,
  sourceId?: string,
  workflowName?: string,
): Promise<DataAvailability> {
  const empty: DataAvailability = {
    totalEvents: 0,
    eventTypes: [],
    availableFields: [],
    fieldShapes: {},
    dataRichness: 'minimal',
    canSupportTimeseries: false,
    canSupportBreakdowns: false,
    usableFieldCount: 0,
    insights: [],
    supportedGoals: [],
    naturalSummary: 'No event data available yet.',
    timeSpanHours: 0,
  };

  try {
    let query = supabase
      .from('events')
      .select('type, labels, state, timestamp', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('timestamp', { ascending: false })
      .limit(50);

    if (sourceId) {
      query = query.eq('source_id', sourceId);
    }

    // ✅ FIX: Scope to specific workflow when the user selected one.
    // Without this, a single n8n source with 3 workflows returns all events.
    if (workflowName) {
      query = query.eq('state->>workflow_name', workflowName);
      console.log(`[assessDataAvailability] Scoping to workflow: "${workflowName}"`);
    }

    const { data: events, count } = await query;
    const totalEvents = typeof count === 'number' ? count : (events?.length ?? 0);

    if (!events || events.length === 0) {
      return empty;
    }

    // ── Step 1: Field discovery (existing logic) ─────────────────────
    const eventTypes = [...new Set(events.map((e: any) => e.type).filter(Boolean))] as string[];
    const fieldSet = new Set<string>();
    const fieldSamples: Record<string, unknown> = {};

    for (const event of events) {
      if (event.labels && typeof event.labels === 'object') {
        for (const [key, value] of Object.entries(event.labels)) {
          fieldSet.add(key);
          if (!fieldSamples[key]) fieldSamples[key] = value;
        }
      }
      if (event.state && typeof event.state === 'object') {
        for (const [key, value] of Object.entries(event.state)) {
          fieldSet.add(key);
          if (!fieldSamples[key]) fieldSamples[key] = value;
          // Flatten one level of nested objects (e.g., body.user_name, research.summary)
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            for (const [nestedKey, nestedValue] of Object.entries(value as Record<string, unknown>)) {
              const flatKey = `${key}.${nestedKey}`;
              fieldSet.add(flatKey);
              if (!fieldSamples[flatKey]) fieldSamples[flatKey] = nestedValue;
            }
          }
        }
      }
    }

    const availableFields = [...fieldSet];
    const fieldShapes: Record<string, DataAvailability['fieldShapes'][string]> = {};
    for (const field of availableFields) {
      fieldShapes[field] = inferFieldShape(field, fieldSamples[field]);
    }

    const timestampFields = availableFields.filter(f => fieldShapes[f] === 'timestamp');
    const statusFields = availableFields.filter(f => fieldShapes[f] === 'status');
    const usableFieldCount = availableFields.filter(f => fieldShapes[f] !== 'identifier').length;

    const canSupportTimeseries = timestampFields.length > 0 || totalEvents >= 5;
    const canSupportBreakdowns = statusFields.length > 0 || eventTypes.length > 1;

    let dataRichness: DataAvailability['dataRichness'];
    if (usableFieldCount >= 10 && eventTypes.length >= 3) {
      dataRichness = 'rich';
    } else if (usableFieldCount >= 6 && eventTypes.length >= 2) {
      dataRichness = 'moderate';
    } else if (usableFieldCount >= 3 || totalEvents >= 5) {
      dataRichness = 'sparse';
    } else {
      dataRichness = 'minimal';
    }

    // ── Step 2: NEW — Compute actual statistics from values ──────────
    const insights: DataInsight[] = [];
    const supportedGoals: SupportedGoal[] = [];

    // Helper: extract a field value from event's labels or state
    const getFieldValue = (event: any, fieldName: string): unknown => {
      return event?.state?.[fieldName] ?? event?.labels?.[fieldName] ?? undefined;
    };

    // 2a: Status/success rate computation
    const statusFieldName = availableFields.find(f => fieldShapes[f] === 'status');
    if (statusFieldName) {
      const statusValues: string[] = [];
      for (const event of events) {
        const val = getFieldValue(event, statusFieldName);
        if (val !== undefined && val !== null) {
          statusValues.push(String(val).toLowerCase());
        }
      }

      if (statusValues.length > 0) {
        // Count by status value
        const statusCounts: Record<string, number> = {};
        for (const v of statusValues) {
          statusCounts[v] = (statusCounts[v] || 0) + 1;
        }

        // Success rate: count values matching success-like patterns
        const successPatterns = /^(success|succeeded|completed|ok|passed|done|finished|active|running)$/i;
        const failPatterns = /^(error|failed|failure|crashed|timeout|aborted|cancelled|rejected)$/i;

        let successCount = 0;
        let failCount = 0;
        for (const [val, cnt] of Object.entries(statusCounts)) {
          if (successPatterns.test(val)) successCount += cnt;
          if (failPatterns.test(val)) failCount += cnt;
        }

        const totalWithStatus = statusValues.length;
        if (successCount + failCount > 0) {
          const successRate = successCount / (successCount + failCount);
          insights.push({
            metric: 'success_rate',
            label: 'Success Rate',
            value: Math.round(successRate * 100),
            unit: '%',
          });
          insights.push({
            metric: 'fail_count',
            label: 'Failed Executions',
            value: failCount,
          });
          supportedGoals.push('success_rate_tracking');
        }

        // Status distribution (top 5 statuses)
        const sortedStatuses = Object.entries(statusCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5);
        insights.push({
          metric: 'status_distribution',
          label: 'Status Breakdown',
          value: sortedStatuses.map(([k, v]) => `${k}: ${v}`).join(', '),
        });
        supportedGoals.push('status_breakdown');
      }
    }

    // 2b: Duration statistics
    const durationFieldName = availableFields.find(f => fieldShapes[f] === 'duration');
    if (durationFieldName) {
      const durationValues: number[] = [];
      for (const event of events) {
        const val = getFieldValue(event, durationFieldName);
        const num = typeof val === 'number' ? val : parseFloat(String(val));
        if (!isNaN(num) && num >= 0) {
          durationValues.push(num);
        }
      }

      if (durationValues.length > 0) {
        const sorted = [...durationValues].sort((a, b) => a - b);
        const avg = Math.round(sorted.reduce((s, v) => s + v, 0) / sorted.length);
        const median = sorted[Math.floor(sorted.length / 2)];
        const min = sorted[0];
        const max = sorted[sorted.length - 1];

        // Detect if values are milliseconds or seconds
        const isMs = durationFieldName.includes('_ms') || avg > 500;
        const unit = isMs ? 'ms' : 's';

        insights.push({ metric: 'avg_duration', label: 'Avg Duration', value: avg, unit });
        insights.push({ metric: 'median_duration', label: 'Median Duration', value: median, unit });
        insights.push({ metric: 'min_duration', label: 'Min Duration', value: min, unit });
        insights.push({ metric: 'max_duration', label: 'Max Duration', value: max, unit });
        supportedGoals.push('duration_performance');
      }
    }

    // 2c: Error message analysis
    const errorFieldName = availableFields.find(f =>
      /error_message|error_msg|error_text|error_detail/i.test(f)
    );
    if (errorFieldName) {
      const errorMessages: string[] = [];
      for (const event of events) {
        const val = getFieldValue(event, errorFieldName);
        if (val && typeof val === 'string' && val.trim().length > 0) {
          errorMessages.push(val.trim());
        }
      }

      if (errorMessages.length > 0) {
        // Count unique errors
        const errorCounts: Record<string, number> = {};
        for (const msg of errorMessages) {
          // Normalize: take first 100 chars to group similar errors
          const key = msg.slice(0, 100);
          errorCounts[key] = (errorCounts[key] || 0) + 1;
        }

        const topErrors = Object.entries(errorCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3);

        insights.push({
          metric: 'error_count',
          label: 'Events With Errors',
          value: errorMessages.length,
        });
        insights.push({
          metric: 'unique_errors',
          label: 'Unique Error Types',
          value: Object.keys(errorCounts).length,
        });
        if (topErrors.length > 0) {
          insights.push({
            metric: 'top_error',
            label: 'Most Common Error',
            value: `${topErrors[0][0].slice(0, 80)} (${topErrors[0][1]}x)`,
          });
        }
        supportedGoals.push('error_analysis');
      }
    }

    // 2d: Time span and frequency
    const timestamps: Date[] = [];
    for (const event of events) {
      if (event.timestamp) {
        const d = new Date(event.timestamp);
        if (!isNaN(d.getTime())) {
          timestamps.push(d);
        }
      }
    }

    let timeSpanHours = 0;
    if (timestamps.length >= 2) {
      const sorted = [...timestamps].sort((a, b) => a.getTime() - b.getTime());
      const earliest = sorted[0];
      const latest = sorted[sorted.length - 1];
      timeSpanHours = Math.round((latest.getTime() - earliest.getTime()) / (1000 * 60 * 60) * 10) / 10;

      insights.push({
        metric: 'time_span',
        label: 'Data Time Span',
        value: timeSpanHours < 24
          ? `${timeSpanHours} hours`
          : `${Math.round(timeSpanHours / 24 * 10) / 10} days`,
      });

      if (timeSpanHours > 0) {
        const eventsPerDay = Math.round(totalEvents / (timeSpanHours / 24) * 10) / 10;
        insights.push({
          metric: 'event_frequency',
          label: 'Event Frequency',
          value: eventsPerDay,
          unit: 'per day',
        });
      }

      supportedGoals.push('execution_timeline');
      if (totalEvents >= 5) {
        supportedGoals.push('volume_trends');
      }
    }

    // 2e: Multi-type comparison
    if (eventTypes.length > 1) {
      supportedGoals.push('multi_type_comparison');
    }

    // 2f: Fallback goal — always have at least one
    if (supportedGoals.length === 0) {
      supportedGoals.push('simple_event_count');
      insights.push({
        metric: 'total_events',
        label: 'Total Events',
        value: totalEvents,
      });
    }

    // ── Step 3: NEW — Enriched field insights (from Phase 2 payload extraction) ──
    // Analyze extracted business fields (not just base execution fields).
    // These fields were added by extractPayloadFields() in Phase 2.
    const BASE_FIELDS = new Set([
      'workflow_id', 'workflow_name', 'execution_id', 'status',
      'started_at', 'ended_at', 'duration_ms', 'error_message', 'platform',
      'platformType',
    ]);

    const enrichedFields = availableFields.filter(f => !BASE_FIELDS.has(f));
    const enrichedFieldCount = enrichedFields.length;

    if (enrichedFieldCount > 0) {
      // Upgrade dataRichness based on enriched fields
      if (enrichedFieldCount >= 8 && totalEvents >= 5) {
        dataRichness = 'rich';
      } else if (enrichedFieldCount >= 4 && totalEvents >= 3) {
        dataRichness = dataRichness === 'minimal' ? 'moderate' : (dataRichness === 'sparse' ? 'moderate' : dataRichness);
      }

      // Compute insights from enriched categorical fields
      for (const field of enrichedFields) {
        const shape = fieldShapes[field];
        if (shape === 'identifier' || shape === 'timestamp' || shape === 'duration') continue;

        // Collect values across events
        const values: unknown[] = [];
        for (const event of events) {
          const val = getFieldValue(event, field);
          if (val !== null && val !== undefined && val !== '') {
            values.push(val);
          }
        }
        if (values.length === 0) continue;

        if (shape === 'status') {
          // Categorical: compute distribution
          const distribution: Record<string, number> = {};
          for (const v of values) {
            const key = String(v);
            distribution[key] = (distribution[key] || 0) + 1;
          }
          const entries = Object.entries(distribution).sort((a, b) => b[1] - a[1]);
          const topEntries = entries.slice(0, 4);
          const distStr = topEntries.map(([k, v]) => `${k}: ${v}`).join(', ');
          insights.push({
            metric: `${field}_distribution`,
            label: `${humanizeLabel(field)} Breakdown`,
            value: distStr,
          });

          // If it's a boolean-ish field, compute conversion rate
          if (entries.length === 2) {
            const trueKeys = ['true', 'yes', '1', 'hot', 'qualified', 'approved', 'active', 'success'];
            const positiveEntry = entries.find(([k]) => trueKeys.includes(k.toLowerCase()));
            if (positiveEntry) {
              const rate = Math.round((positiveEntry[1] / values.length) * 100);
              insights.push({
                metric: `${field}_rate`,
                label: `${humanizeLabel(field)} Rate`,
                value: rate,
                unit: '%',
              });
              if (!supportedGoals.includes('status_breakdown')) {
                supportedGoals.push('status_breakdown');
              }
            }
          }
        } else if (shape === 'numeric') {
          // Numeric: compute avg, min, max
          const nums = values.map(v => Number(v)).filter(n => !isNaN(n));
          if (nums.length >= 2) {
            const avg = Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
            insights.push({
              metric: `avg_${field}`,
              label: `Avg ${humanizeLabel(field)}`,
              value: avg,
            });
          }
        }
      }

      // Compute distribution insights for categorical business fields
      for (const field of enrichedFields.slice(0, 15)) {
        const shape = fieldShapes[field];
        if (shape === 'timestamp' || shape === 'duration' || shape === 'identifier' || shape === 'numeric') continue;
        const sample = fieldSamples[field];
        if (sample && typeof sample === 'object') continue;

        const values: string[] = [];
        for (const event of events) {
          let val: unknown;
          if (field.includes('.')) {
            const [parent, child] = field.split('.', 2);
            val = (event.state as any)?.[parent]?.[child];
          } else {
            val = (event.state as any)?.[field] ?? (event.labels as any)?.[field];
          }
          if (val !== null && val !== undefined && val !== '') {
            values.push(String(val));
          }
        }
        if (values.length === 0) continue;
        const unique = [...new Set(values)];

        if (unique.length >= 2 && unique.length <= 10) {
          const counts: Record<string, number> = {};
          for (const v of values) counts[v] = (counts[v] || 0) + 1;
          const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
          insights.push({
            metric: `${field}_distribution`,
            label: `${humanizeLabel(field.includes('.') ? field.split('.').pop()! : field)} Breakdown`,
            value: sorted.map(([k, v]) => `${k}: ${v}`).join(', '),
          });
        }
      }

      // Add enriched field count as insight
      insights.push({
        metric: 'enriched_field_count',
        label: 'Business Data Fields',
        value: enrichedFieldCount,
      });
    }

    // ── Step 3: NEW — Build natural language summary ─────────────────
    const naturalSummary = buildNaturalSummary(
      totalEvents,
      eventTypes,
      availableFields,
      fieldShapes,
      insights,
      supportedGoals,
      timeSpanHours,
    );

    return {
      totalEvents,
      eventTypes,
      availableFields,
      fieldShapes,
      dataRichness,
      canSupportTimeseries,
      canSupportBreakdowns,
      usableFieldCount,
      insights,
      supportedGoals,
      naturalSummary,
      timeSpanHours,
    };
  } catch (err) {
    console.error('[assessDataAvailability] Error querying events:', err);
    return empty;
  }
}

// ─── Natural Language Summary Builder ─────────────────────────────────────
// Produces a LIDA-style compact summary paragraph that describes what the
// data ACTUALLY contains. This string is the grounding context for Phase B
// (LLM Goal Explorer) and for data-aware feedback hints.

function buildNaturalSummary(
  totalEvents: number,
  eventTypes: string[],
  availableFields: string[],
  fieldShapes: Record<string, string>,
  insights: DataInsight[],
  supportedGoals: SupportedGoal[],
  timeSpanHours: number,
): string {
  const parts: string[] = [];

  // Opening: volume + time span
  const timeDesc = timeSpanHours < 24
    ? `over ${Math.round(timeSpanHours * 10) / 10} hours`
    : `over ${Math.round(timeSpanHours / 24 * 10) / 10} days`;
  const typeDesc = eventTypes.length === 1
    ? `Single event type: ${eventTypes[0]}`
    : `${eventTypes.length} event types: ${eventTypes.join(', ')}`;
  parts.push(`${totalEvents} events ${timeSpanHours > 0 ? timeDesc : '(no time range)'}. ${typeDesc}.`);

  // Fields summary grouped by shape
  const shapeGroups: Record<string, string[]> = {};
  for (const field of availableFields) {
    const shape = fieldShapes[field] || 'text';
    if (shape === 'identifier') continue; // skip IDs
    if (!shapeGroups[shape]) shapeGroups[shape] = [];
    shapeGroups[shape].push(field);
  }
  const fieldParts: string[] = [];
  for (const [shape, fields] of Object.entries(shapeGroups)) {
    fieldParts.push(`${shape}: ${fields.join(', ')}`);
  }
  if (fieldParts.length > 0) {
    parts.push(`Fields — ${fieldParts.join('; ')}.`);
  }

  // Key insights
  const successInsight = insights.find(i => i.metric === 'success_rate');
  const failInsight = insights.find(i => i.metric === 'fail_count');
  const avgDuration = insights.find(i => i.metric === 'avg_duration');
  const topError = insights.find(i => i.metric === 'top_error');
  const frequency = insights.find(i => i.metric === 'event_frequency');

  if (successInsight) {
    let statusLine = `Success rate: ${successInsight.value}%`;
    if (failInsight && typeof failInsight.value === 'number' && failInsight.value > 0) {
      statusLine += ` (${failInsight.value} failures)`;
    }
    parts.push(statusLine + '.');
  }

  if (avgDuration) {
    parts.push(`Avg duration: ${avgDuration.value}${avgDuration.unit || ''}.`);
  }

  if (topError) {
    parts.push(`Top error: ${topError.value}.`);
  }

  if (frequency) {
    parts.push(`Frequency: ~${frequency.value} ${frequency.unit || ''}.`);
  }

  // Capabilities statement
  const canDo: string[] = [];
  const cantDo: string[] = [];

  if (supportedGoals.includes('success_rate_tracking')) canDo.push('success/fail tracking');
  if (supportedGoals.includes('duration_performance')) canDo.push('duration analysis');
  if (supportedGoals.includes('error_analysis')) canDo.push('error drill-down');
  if (supportedGoals.includes('execution_timeline')) canDo.push('time-series trends');
  if (supportedGoals.includes('volume_trends')) canDo.push('volume trends');
  if (supportedGoals.includes('multi_type_comparison')) canDo.push('multi-type comparisons');

  if (!supportedGoals.includes('multi_type_comparison')) cantDo.push('multi-type comparisons');
  if (!supportedGoals.includes('duration_performance')) cantDo.push('duration analysis');
  if (totalEvents < 20) cantDo.push('statistically significant trends');

  if (canDo.length > 0) {
    parts.push(`Data supports: ${canDo.join(', ')}.`);
  }
  if (cantDo.length > 0) {
    parts.push(`NOT supported: ${cantDo.join(', ')}.`);
  }

  return parts.join(' ');
}

// ─── Data-Aware Feedback Hints ────────────────────────────────────────────
// Instead of hardcoded strings like "monitoring operations professional",
// build BM25 hints that describe what the data ACTUALLY supports.
// A workflow with 13 error events and 1 event type should not get a hint
// about "data-dense detailed analytics" — it should get "error monitoring
// reliability tracking".

function buildDataAwareFeedbackHints(
  archetype: Archetype,
  dataAvailability: DataAvailability | null,
  proposalCount: number,
): string[] {
  if (!dataAvailability || dataAvailability.dataRichness === 'minimal') {
    // Minimal data: one simple hint is all we need
    return [`${archetype} simple overview summary`];
  }

  const shapes = dataAvailability.fieldShapes;
  const fields = dataAvailability.availableFields;

  // Build capability descriptors from actual field shapes
  const capabilities: string[] = [];
  if (fields.some(f => shapes[f] === 'status')) capabilities.push('status tracking');
  if (fields.some(f => shapes[f] === 'duration')) capabilities.push('performance timing');
  if (fields.some(f => shapes[f] === 'timestamp')) capabilities.push('time-series trends');
  if (fields.some(f => shapes[f] === 'numeric')) capabilities.push('numeric metrics');
  if (dataAvailability.canSupportBreakdowns) capabilities.push('categorical breakdown');
  if (dataAvailability.eventTypes.length > 1) capabilities.push('multi-type comparison');

  const capString = capabilities.slice(0, 3).join(' ');

  const hints: string[] = [];

  // Proposal 0: operational focus (always generated)
  hints.push(`${archetype} ${capString} operational`);

  if (proposalCount >= 2) {
    // Proposal 1: client-facing — but only claim what data supports
    const clientCaps = dataAvailability.canSupportTimeseries
      ? 'trend visibility client-facing'
      : 'summary overview client-facing';
    hints.push(`${archetype} ${clientCaps}`);
  }

  if (proposalCount >= 3) {
    // Proposal 2: analytics — but scoped to actual data density
    const analyticsCaps = dataAvailability.usableFieldCount >= 6
      ? 'detailed analytics multi-metric'
      : 'focused analytics key-metrics';
    hints.push(`${archetype} ${analyticsCaps}`);
  }

  return hints;
}

// ─── Types for workflow integration ───────────────────────────────────────

interface DesignSystemWorkflowInput {
  workflowName: string;
  platformType: string;
  selectedOutcome: string;
  selectedEntities: string;
  tenantId: string;
  userId: string;
  userFeedback?: string;
  excludeStyleNames?: string[];
  excludeColorHexValues?: string[];
}

interface DesignSystemResult {
  designSystem: ProposalDesignSystem;
  reasoning: string;
}

interface GenerateProposalsInput {
  workflowName: string;
  platformType: string;
  selectedEntities: string;
  tenantId: string;
  userId: string;
  /** Mastra instance — used to get the designSystemWorkflow */
  mastra: any;
  /** Optional RequestContext to pass through to workflow runs */
  requestContext?: any;
  /** Supabase client for data availability queries */
  supabase?: any;
  /** Source ID to scope event queries */
  sourceId?: string;
}

interface GenerateProposalsResult {
  success: boolean;
  proposals: Proposal[];
  payload: ProposalsPayload;
  archetype: Archetype;
  dataAvailability?: DataAvailability | null;
  error?: string;
  /** Timing info for observability */
  timing: {
    classifyMs: number;
    designSystemMs: number;
    totalMs: number;
  };
}

// ─── Wireframe layout generation ──────────────────────────────────────────
// Deterministic: given an emphasis blend and entity names, produce a
// component layout. No LLM calls — pure layout logic.

function buildWireframeLayout(
  blend: EmphasisBlend,
  entities: string[],
  proposalIndex: number,
  dataAvailability?: DataAvailability | null,
  goalChartTypes?: Array<'kpi' | 'line_chart' | 'bar_chart' | 'pie_chart' | 'table' | 'funnel' | 'timeline' | 'status_grid'>,
  goalFocusMetrics?: string[],
): WireframeLayout {
  const components: WireframeComponent[] = [];
  let entityLabels: string[];

  // Priority 1: Use Goal Explorer's focusMetrics as labels (LLM chose these for this specific proposal)
  if (goalFocusMetrics && goalFocusMetrics.length > 0) {
    entityLabels = goalFocusMetrics.map(m => humanizeLabel(m));
  }
  // Priority 2: Derive from actual data field shapes (fallback path)
  else if (dataAvailability && dataAvailability.usableFieldCount > 0) {
    const shapes = dataAvailability.fieldShapes;
    const labels: string[] = [];
    const statusField = dataAvailability.availableFields.find(f => shapes[f] === 'status');
    const durationField = dataAvailability.availableFields.find(f => shapes[f] === 'duration');
    const timestampField = dataAvailability.availableFields.find(f => shapes[f] === 'timestamp');
    const numericField = dataAvailability.availableFields.find(f => shapes[f] === 'numeric');

    if (statusField) labels.push('Success Rate');
    if (durationField) labels.push('Avg Duration');
    if (timestampField) labels.push('Runs Over Time');
    if (numericField) labels.push(humanizeLabel(numericField));
    if (labels.length === 0) labels.push('Total Events');

    entityLabels = labels;
  }
  // Priority 3: Use raw entity names from user selection
  else {
    entityLabels = entities.length > 0
      ? entities
      : ['Metric 1', 'Metric 2', 'Metric 3'];
  }

  // ── Goal-aware chart type selection ─────────────────────────────────
  // When the Goal Explorer specified chartTypes, use them to override the
  // dominant-emphasis-based layout pattern. This ensures each proposal has
  // a distinct layout structure, not just different colors on the same grid.
  if (goalChartTypes && goalChartTypes.length > 0) {
    // Build components directly from goal's chart type list
    const components: WireframeComponent[] = [];
    let currentRow = 0;

    // Separate KPIs from other chart types
    const kpiTypes = goalChartTypes.filter(ct => ct === 'kpi');
    const chartOnlyTypes = goalChartTypes.filter(ct => ct !== 'kpi');

    // Row 0: KPIs (if any)
    if (kpiTypes.length > 0 || entityLabels.length > 0) {
      const kpiCount = Math.min(Math.max(kpiTypes.length, 1), Math.min(entityLabels.length, 4));
      const kpiWidth = Math.floor(12 / kpiCount);
      for (let i = 0; i < kpiCount; i++) {
        components.push({
          id: `kpi-${i}`,
          type: 'kpi',
          label: entityLabels[i] || `KPI ${i + 1}`,
          layout: { col: i * kpiWidth, row: currentRow, w: kpiWidth, h: 1 },
        });
      }
      currentRow += 1;
    }

    // Remaining rows: one or two charts per row from goalChartTypes
    for (let i = 0; i < chartOnlyTypes.length; i += 2) {
      const first = chartOnlyTypes[i];
      const second = chartOnlyTypes[i + 1];

      if (second) {
        // Two charts side by side
        components.push({
          id: `chart-${i}`,
          type: first,
          label: entityLabels[0] ? `${entityLabels[0]} ${first.replace('_', ' ')}` : humanizeLabel(first),
          layout: { col: 0, row: currentRow, w: 7, h: 2 },
        });
        components.push({
          id: `chart-${i + 1}`,
          type: second,
          label: second === 'table' ? 'Recent Activity' : humanizeLabel(second),
          layout: { col: 7, row: currentRow, w: 5, h: 2 },
        });
      } else {
        // Single chart full width
        components.push({
          id: `chart-${i}`,
          type: first,
          label: first === 'table' ? 'Detailed Records' : `${entityLabels[0] || 'Primary'} ${humanizeLabel(first)}`,
          layout: { col: 0, row: currentRow, w: 12, h: 2 },
        });
      }
      currentRow += 2;
    }

    // If no charts were specified but we have data, add a table as catch-all
    if (chartOnlyTypes.length === 0) {
      components.push({
        id: 'data-table',
        type: 'table',
        label: 'Recent Activity',
        layout: { col: 0, row: currentRow, w: 12, h: 2 },
      });
    }

    // Name the layout based on the goal's chart mix
    const hasTimeseries = goalChartTypes.includes('line_chart') || goalChartTypes.includes('timeline');
    const hasBreakdown = goalChartTypes.includes('bar_chart') || goalChartTypes.includes('pie_chart');
    const hasGrid = goalChartTypes.includes('status_grid');
    const layoutName = hasTimeseries && hasBreakdown
      ? 'Trend & Breakdown'
      : hasTimeseries
        ? 'Time-Series Focus'
        : hasGrid
          ? 'Status Grid'
          : hasBreakdown
            ? 'Categorical Analysis'
            : 'Overview';

    return { name: layoutName, components };
  }

  // Dominant emphasis determines the layout pattern
  const dominant = blend.dashboard >= blend.product && blend.dashboard >= blend.analytics
    ? 'dashboard'
    : blend.product >= blend.analytics
      ? 'product'
      : 'analytics';

  if (dominant === 'dashboard') {
    // Dashboard-dominant: layout scaled to what data actually supports
    const kpiCount = Math.min(entityLabels.length, 4);
    const kpiWidth = kpiCount > 0 ? Math.floor(12 / kpiCount) : 12;

    for (let i = 0; i < kpiCount; i++) {
      components.push({
        id: `kpi-${i}`,
        type: 'kpi',
        label: entityLabels[i] || `KPI ${i + 1}`,
        layout: { col: i * kpiWidth, row: 0, w: kpiWidth, h: 1 },
      });
    }

    let nextRow = 1;

    // Only add trend chart if data has timeseries capability
    if (dataAvailability?.canSupportTimeseries) {
      const chartWidth = dataAvailability?.canSupportBreakdowns ? 8 : 12;
      components.push({
        id: 'trend-chart',
        type: 'line_chart',
        label: `${entityLabels[0] || 'Primary'} Over Time`,
        layout: { col: 0, row: nextRow, w: chartWidth, h: 2 },
      });

      // Only add breakdown chart if data has categorical fields
      if (dataAvailability?.canSupportBreakdowns) {
        components.push({
          id: 'breakdown',
          type: 'bar_chart',
          label: 'Breakdown by Type',
          layout: { col: 8, row: nextRow, w: 4, h: 2 },
        });
      }
      nextRow += 2;
    } else if (dataAvailability?.canSupportBreakdowns) {
      // No timeseries but has breakdowns — show bar chart full width
      components.push({
        id: 'breakdown',
        type: 'bar_chart',
        label: 'Breakdown by Type',
        layout: { col: 0, row: nextRow, w: 12, h: 2 },
      });
      nextRow += 2;
    }

    // Always include a data table — raw data is always available
    components.push({
      id: 'data-table',
      type: 'table',
      label: 'Recent Activity',
      layout: { col: 0, row: nextRow, w: 12, h: 2 },
    });

    return { name: 'Dashboard Grid', components };
  }

  if (dominant === 'product') {
    // Product-dominant: hero metric + supporting content, scaled to data
    components.push({
      id: 'hero-metric',
      type: 'kpi',
      label: entityLabels[0] || 'Primary Metric',
      layout: { col: 0, row: 0, w: 6, h: 2 },
    });

    if (entityLabels.length > 1) {
      components.push({
        id: 'secondary-metric',
        type: 'kpi',
        label: entityLabels[1],
        layout: { col: 6, row: 0, w: 6, h: 2 },
      });
    }

    let nextRow = 2;

    // Add chart only if data supports it
    if (dataAvailability?.canSupportTimeseries) {
      components.push({
        id: 'main-chart',
        type: proposalIndex === 1 ? 'bar_chart' : 'line_chart',
        label: `${entityLabels[0] || 'Performance'} Trend`,
        layout: { col: 0, row: nextRow, w: dataAvailability?.canSupportBreakdowns ? 7 : 12, h: 2 },
      });

      if (dataAvailability?.canSupportBreakdowns) {
        components.push({
          id: 'status-list',
          type: 'status_grid',
          label: 'Status Overview',
          layout: { col: 7, row: nextRow, w: 5, h: 2 },
        });
      }
      nextRow += 2;
    } else if (dataAvailability?.canSupportBreakdowns) {
      components.push({
        id: 'status-list',
        type: 'status_grid',
        label: 'Status Overview',
        layout: { col: 0, row: nextRow, w: 12, h: 2 },
      });
      nextRow += 2;
    }

    return { name: 'Client Portal', components };
  }

  // Analytics-dominant: data-dense layout, but only show what data supports
  const kpiCount = Math.min(entityLabels.length, 4);
  const kpiWidth = kpiCount > 0 ? Math.floor(12 / kpiCount) : 12;

  for (let i = 0; i < kpiCount; i++) {
    components.push({
      id: `summary-kpi-${i + 1}`,
      type: 'kpi',
      label: entityLabels[i] || `KPI ${i + 1}`,
      layout: { col: i * kpiWidth, row: 0, w: kpiWidth, h: 1 },
    });
  }

  let nextRow = 1;

  if (dataAvailability?.canSupportTimeseries) {
    const trendWidth = dataAvailability?.canSupportBreakdowns ? 6 : 12;
    components.push({
      id: 'main-trend',
      type: 'line_chart',
      label: 'Trend Analysis',
      layout: { col: 0, row: nextRow, w: trendWidth, h: 2 },
    });

    if (dataAvailability?.canSupportBreakdowns) {
      components.push({
        id: 'distribution',
        type: 'pie_chart',
        label: 'Distribution',
        layout: { col: 6, row: nextRow, w: 6, h: 2 },
      });
    }
    nextRow += 2;
  } else if (dataAvailability?.canSupportBreakdowns) {
    components.push({
      id: 'distribution',
      type: 'pie_chart',
      label: 'Distribution',
      layout: { col: 0, row: nextRow, w: 12, h: 2 },
    });
    nextRow += 2;
  }

  // Always include detail table for analytics
  components.push({
    id: 'detail-table',
    type: 'table',
    label: 'Detailed Records',
    layout: { col: 0, row: nextRow, w: 12, h: 2 },
  });

  return { name: 'Analytics Deep-Dive', components };
}

// ─── Pitch text generation ────────────────────────────────────────────────

function generatePitch(blend: EmphasisBlend, archetype: Archetype): string {
  // Determine the dominant emphasis
  const dominant = Object.entries(blend).sort((a, b) => b[1] - a[1])[0][0];

  const pitchTemplates: Record<string, string[]> = {
    dashboard: [
      'Real-time monitoring for your automation pipeline.',
      'At-a-glance operational insights for your workflow.',
      'Track performance, spot issues, stay in control.',
    ],
    product: [
      'A client-ready view of your automation results.',
      'Professional reporting your clients will love.',
      'Showcase your automation ROI to stakeholders.',
    ],
    analytics: [
      'Deep-dive analytics to optimize your workflow.',
      'Uncover patterns and trends in your execution data.',
      'Data-driven insights to improve automation performance.',
    ],
  };

  const templates = pitchTemplates[dominant] || pitchTemplates.dashboard;
  // Use archetype hash to pick a consistent template
  const hash = archetype.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return templates[hash % templates.length];
}

// ─── Outcome hint per blend ───────────────────────────────────────────────

function blendToOutcomeHint(blend: EmphasisBlend): string {
  if (blend.product >= 0.5) return 'product';
  if (blend.analytics >= 0.5) return 'analytics dashboard deep data';
  return 'dashboard monitoring ops';
}

// ─── Normalize design system from workflow output ─────────────────────────

function normalizeDesignSystem(raw: any): ProposalDesignSystem {
  return {
    style: {
      name: raw.style?.name || 'Professional',
      type: raw.style?.type || 'Modern',
      keywords: raw.style?.keywords,
      effects: raw.style?.effects,
    },
    colors: {
      primary: raw.colors?.primary || '#3B82F6',
      secondary: raw.colors?.secondary || '#6366F1',
      accent: raw.colors?.accent || '#8B5CF6',
      success: raw.colors?.success || '#10B981',
      warning: raw.colors?.warning || '#F59E0B',
      error: raw.colors?.error || '#EF4444',
      background: raw.colors?.background || '#FFFFFF',
      text: raw.colors?.text || '#0F172A',
    },
    fonts: {
      heading: raw.fonts?.heading || raw.typography?.headingFont || 'Inter, sans-serif',
      body: raw.fonts?.body || raw.typography?.bodyFont || 'Inter, sans-serif',
      googleFontsUrl: raw.fonts?.googleFontsUrl,
    },
    charts: Array.isArray(raw.charts) ? raw.charts : [],
    spacing: raw.spacing || { unit: 8 },
    radius: raw.radius ?? 8,
    shadow: raw.shadow || '0 1px 3px rgba(0,0,0,0.1)',
    rawPatterns: raw.rawPatterns || undefined,
  };
}

// ─── Main: Generate 3 proposals in parallel ───────────────────────────────

export async function generateProposals(
  input: GenerateProposalsInput,
): Promise<GenerateProposalsResult> {
  const totalStart = Date.now();

  // Step 1a: Assess data availability (DB query, ~50ms)
  let dataAvailability: DataAvailability | null = null;
  if (input.supabase) {
    dataAvailability = await assessDataAvailability(
      input.supabase,
      input.tenantId,
      input.sourceId,
      input.workflowName, // ✅ Scope to selected workflow
    );
    console.log(`[generateProposals] Data availability: ${dataAvailability.dataRichness} — ${dataAvailability.totalEvents} events, ${dataAvailability.usableFieldCount} usable fields, types: [${dataAvailability.eventTypes.join(', ')}]`);
  }

  // Step 1b: LLM Goal Explorer — replaces classifyArchetype as primary brain.
  // Sends actual data profile to LLM: "Given THIS data, what proposals make sense?"
  // Falls back to keyword classifier if LLM fails or data is minimal.
  const classifyStart = Date.now();
  const goalResult: GoalExplorerResult = await exploreGoals(
    input.workflowName,
    input.platformType,
    input.selectedEntities,
    dataAvailability,
  );
  const classifyMs = Date.now() - classifyStart;

  console.log('[generateProposals] Goal Explorer:', {
    source: goalResult.source,
    category: goalResult.category,
    confidence: goalResult.confidence,
    proposalCount: goalResult.proposalCount,
    goals: goalResult.goals.map(g => g.title),
    explorerMs: goalResult.explorerMs,
  });

  // Derive values that downstream code expects
  const proposalCount = goalResult.proposalCount;

  // Step 2: Get the design system workflow
  const workflow = input.mastra?.getWorkflow?.('designSystemWorkflow');
  if (!workflow) {
    return {
      success: false,
      proposals: [],
      payload: {
        proposals: [],
        generatedAt: new Date().toISOString(),
        context: {
          workflowName: input.workflowName,
          platformType: input.platformType,
          selectedEntities: input.selectedEntities,
          archetype: goalResult.category,
        },
      },
      archetype: goalResult.category,
      error: 'designSystemWorkflow not found in Mastra registry',
      timing: { classifyMs, designSystemMs: 0, totalMs: Date.now() - totalStart },
    };
  }

  // Step 3: Run 3 design system workflows sequentially with variety params
  const dsStart = Date.now();
  const entities = input.selectedEntities
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);

  // Build feedback hints using Goal Explorer output.
  // When source is 'llm', the goals already contain data-aware pitches.
  // When source is 'fallback', use the existing data-aware hint builder.
  const feedbackHints = goalResult.source === 'llm'
    ? goalResult.goals.map(g => `${goalResult.category} ${g.focusMetrics.join(' ')} ${g.title}`)
    : buildDataAwareFeedbackHints(goalResult.category, dataAvailability, proposalCount);

  // ── Run 3 design system workflows SEQUENTIALLY ──────────────────────
  //
  // WHY SEQUENTIAL (not parallel):
  // Each workflow's synthesize step calls designAdvisorAgent.generate(),
  // which hits the Gemini API. Running 3 parallel LLM calls to the same
  // API key caused the 3rd call to hang indefinitely — Gemini's rate
  // limit doesn't return 429, the connection just stalls. This was the
  // root cause of the 504 timeout: Promise.allSettled waited forever
  // for a promise that would never resolve.
  //
  // Sequential execution adds ~20-30s but guarantees every call gets a
  // clean API window. 45s that completes > 15s that times out at 300s.
  //
  // FUTURE OPTIMIZATION: Split gather (BM25, no LLM) from synthesis
  // (LLM). Run 3 gathers in parallel, then 3 syntheses sequentially.

  const proposals: Proposal[] = [];

  // Accumulators for REAL exclusion values (not feedback hints).
  // After each successful proposal, we extract the actual style name
  // and primary color hex that the LLM chose, and exclude them from
  // subsequent proposals to guarantee visual variety.
  const usedStyleNames: string[] = [];
  const usedColorHexValues: string[] = [];
  const usedHeadingFonts: string[] = [];

  for (let index = 0; index < proposalCount; index++) {
    // Use Goal Explorer blend + title when available, fall back to archetype presets
    const goal = goalResult.goals[index];
    const blend = goal?.emphasis || { dashboard: 0.5, product: 0.3, analytics: 0.2 };
    const title = goal?.title || `Proposal ${index + 1}`;
    const workflowStart = Date.now();

    try {
      const run = await workflow.createRun();
      const result = await run.start({
        inputData: {
          workflowName: input.workflowName,
          platformType: input.platformType,
          selectedOutcome: blendToOutcomeHint(blend),
          selectedEntities: input.selectedEntities,
          tenantId: input.tenantId,
          userId: input.userId,
          userFeedback: feedbackHints[index],
          // Exclude ACTUAL style names and color hex values from previous proposals.
          // Before this fix, feedbackHints (BM25 query strings) were passed as
          // excludeStyleNames which never matched any CSV "Style Category" value.
          excludeStyleNames: usedStyleNames.length > 0
            ? [...usedStyleNames]
            : undefined,
          excludeColorHexValues: usedColorHexValues.length > 0
            ? [...usedColorHexValues]
            : undefined,
        },
        requestContext: input.requestContext,
      } as any);

      const elapsed = Date.now() - workflowStart;

      if (result.status === 'success' && result.result) {
        const data = result.result as any;
        console.log(`[generateProposals] Workflow ${index} ✅ completed in ${elapsed}ms — "${data.designSystem?.style?.name || 'unnamed'}"`);

        // ── Accumulate real exclusion values for next proposal ────────
        const ds = data.designSystem;
        if (ds?.style?.name) {
          usedStyleNames.push(ds.style.name);
          // Also exclude the style type/category if present
          if (ds.style.type) usedStyleNames.push(ds.style.type);
        }
        if (ds?.colors?.primary) {
          usedColorHexValues.push(ds.colors.primary.toUpperCase());
          if (ds.colors?.secondary) usedColorHexValues.push(ds.colors.secondary.toUpperCase());
          if (ds.colors?.accent) usedColorHexValues.push(ds.colors.accent.toUpperCase());
          if (ds.colors?.background) usedColorHexValues.push(ds.colors.background.toUpperCase());
        }
        if (ds?.typography?.headingFont) {
          usedHeadingFonts.push(ds.typography.headingFont);
        }

        console.log(`[generateProposals] Excluding for next proposal: styles=[${usedStyleNames.join(', ')}], colors=[${usedColorHexValues.join(', ')}], fonts=[${usedHeadingFonts.join(', ')}]`);

        // ── Premium: Perceptual color distance enforcement ──────────────
        // If this proposal's colors are too close to a previous one,
        // force-shift the palette. Stripe, Linear, and Vercel all ensure
        // their theme variants are perceptually distinct (ΔE > 25).
        if (proposals.length > 0 && ds?.colors) {
          const prevColors = proposals[proposals.length - 1].designSystem.colors;
          const deltaE = computeSimpleDeltaE(
            prevColors.primary,
            ds.colors.primary,
            prevColors.accent,
            ds.colors.accent,
            prevColors.background,
            ds.colors.background,
          );
          console.log(`[generateProposals] Color distance ΔE=${deltaE.toFixed(1)} (threshold: 25)`);
          if (deltaE < 25) {
            console.log('[generateProposals] ⚠️ Proposals too similar — applying hue rotation');
            // Rotate primary by 120° (triadic harmony), accent by 90°
            ds.colors.primary = shiftHueHex(ds.colors.primary, 120);
            ds.colors.secondary = shiftHueHex(ds.colors.secondary, 120);
            ds.colors.accent = shiftHueHex(ds.colors.accent, 90);
            // Re-derive background: if both were dark, make this one light (or vice versa)
            const prevIsDark = isDarkBackground(prevColors.background);
            if (prevIsDark && isDarkBackground(ds.colors.background)) {
              ds.colors.background = '#FAFBFC';
              ds.colors.text = '#0F172A';
            } else if (!prevIsDark && !isDarkBackground(ds.colors.background)) {
              ds.colors.background = '#0F172A';
              ds.colors.text = '#F8FAFC';
            }
            // Re-derive semantics with new primary
            const { deriveSemanticColors } = await import('../tools/uiux/mapCSVToTokens');
            const newSemantics = deriveSemanticColors(ds.colors.background, ds.colors.primary);
            ds.colors.success = newSemantics.success;
            ds.colors.warning = newSemantics.warning;
            ds.colors.error = newSemantics.error;
            console.log(`[generateProposals] After hue rotation: primary=${ds.colors.primary}, bg=${ds.colors.background}`);
          }
        }

        proposals.push({
          index,
          title,
          pitch: goal?.pitch || generatePitch(blend, goalResult.category),
          archetype: goalResult.category,
          emphasisBlend: blend,
          designSystem: normalizeDesignSystem(data.designSystem),
          wireframeLayout: buildWireframeLayout(blend, entities, index, dataAvailability, goal?.chartTypes, goal?.focusMetrics),
          reasoning: data.reasoning || '',
        });
      } else {
        console.error(`[generateProposals] Workflow ${index} ❌ failed (status: ${result.status}) in ${elapsed}ms — this should not happen with sequential execution. Check Gemini API key and model availability.`);
        proposals.push({
          index,
          title,
          pitch: goal?.pitch || generatePitch(blend, goalResult.category),
          archetype: goalResult.category,
          emphasisBlend: blend,
          designSystem: normalizeDesignSystem({}),
          wireframeLayout: buildWireframeLayout(blend, entities, index, dataAvailability, goal?.chartTypes, goal?.focusMetrics),
          reasoning: 'Design system generation encountered an error. Please try regenerating.',
        });
      }
    } catch (err: any) {
      const elapsed = Date.now() - workflowStart;
      console.error(`[generateProposals] Workflow ${index} ❌ error after ${elapsed}ms:`, err?.message);
      proposals.push({
        index,
        title,
        pitch: goal?.pitch || generatePitch(blend, goalResult.category),
        archetype: goalResult.category,
        emphasisBlend: blend,
        designSystem: normalizeDesignSystem({}),
        wireframeLayout: buildWireframeLayout(blend, entities, index, dataAvailability, goal?.chartTypes, goal?.focusMetrics),
        reasoning: 'Design system generation encountered an error. Please try regenerating.',
      });
    }
  }

  const dsMs = Date.now() - dsStart;
  const successCount = proposals.filter(p => p.reasoning && !p.reasoning.includes('error')).length;
  console.log(`[generateProposals] All 3 design workflows completed in ${dsMs}ms (${successCount}/3 succeeded)`);

  const payload: ProposalsPayload = {
    proposals,
    generatedAt: new Date().toISOString(),
    context: {
      workflowName: input.workflowName,
      platformType: input.platformType,
      selectedEntities: input.selectedEntities,
      archetype: goalResult.category,
      dataAvailability: dataAvailability || undefined,
      goalExplorer: {
        source: goalResult.source,
        reasoning: goalResult.reasoning,
        explorerMs: goalResult.explorerMs,
        dataSummary: goalResult.dataSummary,
        goalCount: goalResult.goals.length,
        goalTitles: goalResult.goals.map(g => g.title),
      },
    },
  };

  const totalMs = Date.now() - totalStart;
  console.log(`[generateProposals] ✅ Generated ${proposals.length}/${proposalCount} proposals in ${totalMs}ms (data: ${dataAvailability?.dataRichness ?? 'unknown'})`);

  return {
    success: true,
    proposals,
    payload,
    archetype: goalResult.category,
    dataAvailability,
    timing: { classifyMs, designSystemMs: dsMs, totalMs },
  };
}
