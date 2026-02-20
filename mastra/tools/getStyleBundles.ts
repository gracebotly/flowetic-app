// mastra/tools/getStyleBundles.ts
//
// Returns canonical style bundles for user selection during the style phase.
// Registered on designAdvisorAgent since it's a design-domain tool.
//
// BUG 3 FIX: Colors are now derived from STYLE_BUNDLE_TOKENS (the same source
// that generateUISpec uses to render the dashboard). This eliminates the mismatch
// where users previewed one set of colors but the dashboard rendered another.
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { STYLE_BUNDLE_TOKENS } from "./generateUISpec";

/**
 * Canonical style bundles that match the DB CHECK constraint.
 * These are the ONLY valid values for selected_style_bundle_id.
 *
 * BUG 3 FIX: Colors are derived from STYLE_BUNDLE_TOKENS to guarantee
 * what the user previews matches what the dashboard renders.
 * Descriptions and display names are kept here since STYLE_BUNDLE_TOKENS
 * doesn't carry those.
 */
const BUNDLE_METADATA: Record<string, { displayName: string; description: string }> = {
  'professional-clean': {
    displayName: 'Professional Clean',
    description: 'Minimalist design with clean lines and professional feel',
  },
  'premium-dark': {
    displayName: 'Premium Dark',
    description: 'Sophisticated dark theme with premium accents',
  },
  'glass-premium': {
    displayName: 'Glass Premium',
    description: 'Modern glassmorphism with translucent elements',
  },
  'bold-startup': {
    displayName: 'Bold Startup',
    description: 'Vibrant colors and bold typography for startups',
  },
  'corporate-trust': {
    displayName: 'Corporate Trust',
    description: 'Traditional corporate styling that conveys trust',
  },
  'neon-cyber': {
    displayName: 'Neon Cyber',
    description: 'Cyberpunk-inspired with neon accents on dark',
  },
  'pastel-soft': {
    displayName: 'Pastel Soft',
    description: 'Gentle pastel palette with soft, friendly feel',
  },
  'warm-earth': {
    displayName: 'Warm Earth',
    description: 'Natural, earthy tones for a grounded, warm aesthetic',
  },
  'modern-saas': {
    displayName: 'Modern SaaS',
    description: 'Contemporary SaaS dashboard with balanced aesthetics',
  },
};

// Build CANONICAL_STYLE_BUNDLES by merging STYLE_BUNDLE_TOKENS colors with local metadata.
// If a key exists in STYLE_BUNDLE_TOKENS but not in BUNDLE_METADATA, it's included with
// a generated display name. If a key exists only in BUNDLE_METADATA but not in
// STYLE_BUNDLE_TOKENS, it's skipped (no tokens = can't render).
export const CANONICAL_STYLE_BUNDLES: Record<string, {
  displayName: string;
  description: string;
  colors: { primary: string; secondary: string; accent: string; background: string };
  fonts: { heading: string; body: string };
}> = Object.fromEntries(
  Object.entries(STYLE_BUNDLE_TOKENS)
    .filter(([key]) => BUNDLE_METADATA[key]) // Only include bundles with metadata
    .map(([key, tokens]) => {
      const meta = BUNDLE_METADATA[key];
      return [key, {
        displayName: meta.displayName,
        description: meta.description,
        colors: {
          primary: tokens.colors.primary,
          secondary: tokens.colors.secondary,
          // 'accent' isn't in STYLE_BUNDLE_TOKENS — use success as accent (green tones work well)
          accent: tokens.colors.success,
          background: tokens.colors.background,
        },
        fonts: {
          heading: tokens.fonts.heading.split(',')[0].trim(), // Strip fallback fonts for display
          body: tokens.fonts.body.split(',')[0].trim(),
        },
      }];
    })
);

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
