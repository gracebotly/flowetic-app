// mastra/tools/editor/showInteractiveEditPanel.ts
//
// Tool to activate the interactive edit panel in the frontend.
// Returns structured data that chat-workspace.tsx renders as edit panel UI.
//
// Tech Stack: Tremor, Lucide icons, Radix primitives
// UI Rules: No emojis, cursor-pointer on clickables, proper light mode contrast
//

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

// Widget config uses Lucide icon names, NOT emojis
const WidgetConfigSchema = z.object({
  id: z.string(),
  title: z.string(),
  kind: z.enum(["metric", "chart", "table", "list"]),
  enabled: z.boolean(),
  icon: z.string().optional().describe("Lucide icon name, e.g. 'BarChart3', 'Table', 'Activity'"),
});

const PaletteSchema = z.object({
  id: z.string(),
  name: z.string(),
  colors: z.object({
    primary: z.string(),
    secondary: z.string(),
    accent: z.string(),
    background: z.string(),
  }),
});

export const showInteractiveEditPanel = createTool({
  id: "showInteractiveEditPanel",
  description: `Activate the interactive edit panel for dashboard customization.

USE THIS TOOL WHEN:
- User is in 'interactive_edit' phase and wants to customize the dashboard
- User says "edit", "customize", "change layout", "modify widgets"
- Preview has been generated and user wants to make adjustments

The tool fetches the current dashboard spec and returns widget configurations
that the frontend renders as an interactive edit panel with Tremor components.`,

  inputSchema: z.object({
    interfaceId: z.string().uuid().optional().describe("Interface ID (auto-detected from context if not provided)"),
    editMode: z.enum(["layout", "style", "widgets", "full"]).default("full").describe("What aspects can be edited"),
  }),

  outputSchema: z.object({
    success: z.boolean(),
    widgets: z.array(WidgetConfigSchema),
    palettes: z.array(PaletteSchema),
    density: z.enum(["compact", "comfortable", "spacious"]),
    selectedPaletteId: z.string().nullable(),
    editMode: z.string(),
    error: z.string().optional(),
  }),

  execute: async (input, context) => {
    const tenantId = context?.requestContext?.get('tenantId') as string;
    const interfaceId = input.interfaceId || context?.requestContext?.get('interfaceId') as string;

    if (!tenantId) {
      return {
        success: false,
        widgets: [],
        palettes: [],
        density: "comfortable" as const,
        selectedPaletteId: null,
        editMode: input.editMode,
        error: "Missing tenantId in RequestContext",
      };
    }

    if (!interfaceId) {
      return {
        success: false,
        widgets: [],
        palettes: [],
        density: "comfortable" as const,
        selectedPaletteId: null,
        editMode: input.editMode,
        error: "No interfaceId available. Generate a preview first.",
      };
    }

    try {
      const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!url || !serviceKey) {
        throw new Error("Supabase configuration missing");
      }

      const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

      // Fetch the latest interface version
      const { data: version, error: versionError } = await supabase
        .from('interface_versions')
        .select('id, spec_json, design_tokens')
        .eq('interface_id', interfaceId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (versionError) {
        console.error('[showInteractiveEditPanel] DB error:', versionError);
        throw new Error(versionError.message);
      }

      // Transform spec_json components into WidgetConfig format
      const specJson = version?.spec_json as any;
      const designTokens = version?.design_tokens as any;

      const widgets = (specJson?.components || []).map((comp: any, idx: number) => ({
        id: comp.id || `widget-${idx}`,
        title: comp.props?.title || comp.type || `Widget ${idx + 1}`,
        kind: mapComponentTypeToKind(comp.type),
        enabled: !comp.props?.hidden,
        icon: mapComponentTypeToIcon(comp.type), // Lucide icon name
      }));

      // Generate palette options from design tokens
      // Colors follow light mode contrast rules: text-slate-900, muted text-slate-600
      const palettes = [
        {
          id: 'current',
          name: 'Current',
          colors: {
            primary: designTokens?.colors?.primary || '#2563EB',
            secondary: designTokens?.colors?.secondary || '#64748B',
            accent: designTokens?.colors?.accent || '#14B8A6',
            background: designTokens?.colors?.background || '#F8FAFC',
          },
        },
        {
          id: 'dark',
          name: 'Dark Mode',
          colors: {
            primary: '#60A5FA',
            secondary: '#94A3B8',
            accent: '#2DD4BF',
            background: '#0F172A',
          },
        },
        {
          id: 'vibrant',
          name: 'Vibrant',
          colors: {
            primary: '#8B5CF6',
            secondary: '#EC4899',
            accent: '#F59E0B',
            background: '#FFFBEB',
          },
        },
      ];

      console.log('[showInteractiveEditPanel] Returning edit panel data:', {
        widgetCount: widgets.length,
        paletteCount: palettes.length,
        interfaceId,
      });

      return {
        success: true,
        widgets,
        palettes,
        density: "comfortable" as const,
        selectedPaletteId: 'current',
        editMode: input.editMode,
      };
    } catch (error: any) {
      console.error('[showInteractiveEditPanel] Error:', error.message);
      return {
        success: false,
        widgets: [],
        palettes: [],
        density: "comfortable" as const,
        selectedPaletteId: null,
        editMode: input.editMode,
        error: error.message,
      };
    }
  },
});

// Map component types to widget kinds
function mapComponentTypeToKind(type: string): "metric" | "chart" | "table" | "list" {
  const typeLC = (type || '').toLowerCase();
  if (typeLC.includes('metric') || typeLC.includes('kpi') || typeLC.includes('stat')) return 'metric';
  if (typeLC.includes('chart') || typeLC.includes('graph') || typeLC.includes('line') || typeLC.includes('bar') || typeLC.includes('pie')) return 'chart';
  if (typeLC.includes('table') || typeLC.includes('grid') || typeLC.includes('data')) return 'table';
  return 'list';
}

// Map component types to Lucide icon names (NOT emojis)
function mapComponentTypeToIcon(type: string): string {
  const typeLC = (type || '').toLowerCase();
  if (typeLC.includes('metric') || typeLC.includes('kpi') || typeLC.includes('stat')) return 'Activity';
  if (typeLC.includes('line')) return 'TrendingUp';
  if (typeLC.includes('bar')) return 'BarChart3';
  if (typeLC.includes('pie') || typeLC.includes('donut')) return 'PieChart';
  if (typeLC.includes('chart') || typeLC.includes('graph')) return 'LineChart';
  if (typeLC.includes('table') || typeLC.includes('grid')) return 'Table';
  if (typeLC.includes('list')) return 'List';
  return 'LayoutGrid';
}
