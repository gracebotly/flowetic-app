// mastra/tools/getStyleBundles.ts
//
// Returns canonical style bundles for user selection during the style phase.
// Registered on designAdvisorAgent since it's a design-domain tool.
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * Canonical style bundles that match the DB CHECK constraint.
 * These are the ONLY valid values for selected_style_bundle_id.
 */
export const CANONICAL_STYLE_BUNDLES = {
  'professional-clean': {
    displayName: 'Professional Clean',
    description: 'Minimalist design with clean lines and professional feel',
    colors: {
      primary: '#3B82F6',
      secondary: '#64748B',
      accent: '#14B8A6',
      background: '#FFFFFF',
    },
    fonts: {
      heading: 'Inter',
      body: 'Inter',
    },
  },
  'premium-dark': {
    displayName: 'Premium Dark',
    description: 'Sophisticated dark theme with premium accents',
    colors: {
      primary: '#8B5CF6',
      secondary: '#A78BFA',
      accent: '#F59E0B',
      background: '#0F172A',
    },
    fonts: {
      heading: 'Plus Jakarta Sans',
      body: 'Inter',
    },
  },
  'glass-premium': {
    displayName: 'Glass Premium',
    description: 'Modern glassmorphism with translucent elements',
    colors: {
      primary: '#06B6D4',
      secondary: '#8B5CF6',
      accent: '#F472B6',
      background: '#F8FAFC',
    },
    fonts: {
      heading: 'Outfit',
      body: 'Inter',
    },
  },
  'bold-startup': {
    displayName: 'Bold Startup',
    description: 'Vibrant colors and bold typography for startups',
    colors: {
      primary: '#EF4444',
      secondary: '#F97316',
      accent: '#FBBF24',
      background: '#FFFFFF',
    },
    fonts: {
      heading: 'Space Grotesk',
      body: 'Inter',
    },
  },
  'corporate-trust': {
    displayName: 'Corporate Trust',
    description: 'Traditional corporate styling that conveys trust',
    colors: {
      primary: '#1E40AF',
      secondary: '#3B82F6',
      accent: '#059669',
      background: '#F9FAFB',
    },
    fonts: {
      heading: 'Merriweather',
      body: 'Source Sans Pro',
    },
  },
  'neon-cyber': {
    displayName: 'Neon Cyber',
    description: 'Cyberpunk-inspired with neon accents on dark',
    colors: {
      primary: '#22D3EE',
      secondary: '#A855F7',
      accent: '#F43F5E',
      background: '#030712',
    },
    fonts: {
      heading: 'Orbitron',
      body: 'Rajdhani',
    },
  },
  'pastel-soft': {
    displayName: 'Pastel Soft',
    description: 'Gentle pastel palette with soft, friendly feel',
    colors: {
      primary: '#F9A8D4',
      secondary: '#A5B4FC',
      accent: '#6EE7B7',
      background: '#FFFBEB',
    },
    fonts: {
      heading: 'Quicksand',
      body: 'Nunito',
    },
  },
  'warm-earth': {
    displayName: 'Warm Earth',
    description: 'Natural earthy tones with organic warmth',
    colors: {
      primary: '#B45309',
      secondary: '#A16207',
      accent: '#65A30D',
      background: '#FFFBEB',
    },
    fonts: {
      heading: 'Playfair Display',
      body: 'Lato',
    },
  },
  'modern-saas': {
    displayName: 'Modern SaaS',
    description: 'Contemporary SaaS styling with data-dense layouts',
    colors: {
      primary: '#6366F1',
      secondary: '#8B5CF6',
      accent: '#10B981',
      background: '#FFFFFF',
    },
    fonts: {
      heading: 'Inter',
      body: 'Inter',
    },
  },
} as const;

export type CanonicalStyleBundleSlug = keyof typeof CANONICAL_STYLE_BUNDLES;

export const getStyleBundles = createTool({
  id: "getStyleBundles",
  description: `Get available style bundles for dashboard theming.

USE THIS TOOL WHEN:
- User is in 'style' phase and needs to see style options
- User asks "show me styles" or "what design options do I have"
- You need to present 2-at-a-time style cards for selection

Returns canonical style bundles with color palettes and descriptions.
The user will select one, which gets persisted as selected_style_bundle_id.`,

  inputSchema: z.object({
    limit: z.number().min(1).max(9).optional().default(2)
      .describe("Number of bundles to return (default 2 for pair display)"),
    exclude: z.array(z.string()).optional()
      .describe("Bundle IDs to exclude (already shown to user)"),
    style: z.enum(['all', 'light', 'dark', 'vibrant', 'professional']).optional().default('all')
      .describe("Filter by style category"),
  }),

  outputSchema: z.object({
    success: z.boolean(),
    bundles: z.array(z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      colors: z.object({
        primary: z.string(),
        secondary: z.string(),
        accent: z.string(),
        background: z.string(),
      }),
      fonts: z.object({
        heading: z.string(),
        body: z.string(),
      }),
    })),
    hasMore: z.boolean(),
    totalAvailable: z.number(),
    error: z.string().optional(),
  }),

  execute: async (input, context) => {
    const tenantId = context?.requestContext?.get('tenantId') as string;
    if (!tenantId) {
      return {
        success: false,
        bundles: [],
        hasMore: false,
        totalAvailable: 0,
        error: "Missing tenantId in RequestContext",
      };
    }

    const excludeSet = new Set(input.exclude || []);

    // Convert to array format
    const allBundles = Object.entries(CANONICAL_STYLE_BUNDLES).map(([slug, data]) => ({
      id: slug,
      name: data.displayName,
      description: data.description,
      colors: { ...data.colors },
      fonts: { ...data.fonts },
    }));

    // Filter out excluded bundles
    let availableBundles = allBundles.filter(b => !excludeSet.has(b.id));

    // Apply style filter if specified
    if (input.style && input.style !== 'all') {
      const styleFilters: Record<string, string[]> = {
        light: ['professional-clean', 'glass-premium', 'pastel-soft', 'warm-earth', 'modern-saas'],
        dark: ['premium-dark', 'neon-cyber'],
        vibrant: ['bold-startup', 'neon-cyber', 'pastel-soft'],
        professional: ['professional-clean', 'corporate-trust', 'modern-saas'],
      };
      const allowedIds = styleFilters[input.style] || [];
      availableBundles = availableBundles.filter(b => allowedIds.includes(b.id));
    }

    // Return requested number
    const limit = input.limit || 2;
    const returnedBundles = availableBundles.slice(0, limit);

    console.log('[getStyleBundles] Returning bundles:', {
      requested: limit,
      excluded: input.exclude?.length || 0,
      returned: returnedBundles.map(b => b.id),
      hasMore: availableBundles.length > limit,
    });

    return {
      success: true,
      bundles: returnedBundles,
      hasMore: availableBundles.length > limit,
      totalAvailable: availableBundles.length,
    };
  },
});
