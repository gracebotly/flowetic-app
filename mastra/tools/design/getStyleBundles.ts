import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * Style bundle types
 */
interface StylePalette {
  name: string;
  swatches: Array<{ name: string; hex: string; rgb: number[] }>;
}

interface StyleBundle {
  id: string;
  name: string;
  description: string;
  previewImageUrl: string;
  palette: StylePalette;
  densityPreset: "compact" | "comfortable" | "spacious";
  tags: string[];
  designTokens: Record<string, string | number>;
}

/**
 * Full catalog of style archetypes.
 * The tool selects the best 2 based on context, then serves
 * different pairs on subsequent calls via excludeIds.
 */
const STYLE_CATALOG: StyleBundle[] = [
  {
    id: "professional-clean",
    name: "Professional Clean",
    description: "Clean, minimal dashboard for business clients",
    previewImageUrl: "/style-previews/minimalism.png",
    palette: {
      name: "SaaS B2B",
      swatches: [
        { name: "Primary", hex: "#2563EB", rgb: [37, 99, 235] },
        { name: "Secondary", hex: "#64748B", rgb: [100, 116, 139] },
        { name: "CTA", hex: "#10B981", rgb: [16, 185, 129] },
        { name: "Background", hex: "#F8FAFC", rgb: [248, 250, 252] },
        { name: "Text", hex: "#0F172A", rgb: [15, 23, 42] },
      ],
    },
    densityPreset: "comfortable",
    tags: ["Client-facing", "Professional", "Clean"],
    designTokens: {
      "theme.color.primary": "#2563EB",
      "theme.color.secondary": "#64748B",
      "theme.color.cta": "#10B981",
      "theme.color.background": "#F8FAFC",
      "theme.color.text": "#0F172A",
      "theme.spacing.base": 10,
      "theme.radius.md": 8,
      "theme.shadow.card": "soft",
    },
  },
  {
    id: "premium-dark",
    name: "Premium Dark",
    description: "High-contrast dark theme for premium feel",
    previewImageUrl: "/style-previews/dark-mode.png",
    palette: {
      name: "Agency Premium",
      swatches: [
        { name: "Primary", hex: "#60A5FA", rgb: [96, 165, 250] },
        { name: "Secondary", hex: "#A78BFA", rgb: [167, 139, 250] },
        { name: "CTA", hex: "#F472B6", rgb: [244, 114, 182] },
        { name: "Background", hex: "#0B1220", rgb: [11, 18, 32] },
        { name: "Text", hex: "#E5E7EB", rgb: [229, 231, 235] },
      ],
    },
    densityPreset: "comfortable",
    tags: ["Premium", "Dark", "Modern"],
    designTokens: {
      "theme.color.primary": "#60A5FA",
      "theme.color.secondary": "#A78BFA",
      "theme.color.cta": "#F472B6",
      "theme.color.background": "#0B1220",
      "theme.color.text": "#E5E7EB",
      "theme.spacing.base": 10,
      "theme.radius.md": 8,
      "theme.shadow.card": "soft",
    },
  },
  {
    id: "glass-premium",
    name: "Glass Premium",
    description: "Glassmorphism with AI-inspired colors",
    previewImageUrl: "/style-previews/glassmorphism.png",
    palette: {
      name: "AI Platform",
      swatches: [
        { name: "Primary", hex: "#3B82F6", rgb: [59, 130, 246] },
        { name: "Secondary", hex: "#8B5CF6", rgb: [139, 92, 246] },
        { name: "CTA", hex: "#06B6D4", rgb: [6, 182, 212] },
        { name: "Background", hex: "#F9FAFB", rgb: [249, 250, 251] },
        { name: "Text", hex: "#111827", rgb: [17, 24, 39] },
      ],
    },
    densityPreset: "comfortable",
    tags: ["Premium", "Glass", "AI"],
    designTokens: {
      "theme.color.primary": "#3B82F6",
      "theme.color.secondary": "#8B5CF6",
      "theme.color.cta": "#06B6D4",
      "theme.color.background": "#F9FAFB",
      "theme.color.text": "#111827",
      "theme.spacing.base": 10,
      "theme.radius.md": 12,
      "theme.shadow.card": "glass",
    },
  },
  {
    id: "bold-startup",
    name: "Bold Startup",
    description: "Bold, energetic design for differentiation",
    previewImageUrl: "/style-previews/brutalism.png",
    palette: {
      name: "Ecommerce",
      swatches: [
        { name: "Primary", hex: "#EF4444", rgb: [239, 68, 68] },
        { name: "Secondary", hex: "#F59E0B", rgb: [245, 158, 11] },
        { name: "CTA", hex: "#10B981", rgb: [16, 185, 129] },
        { name: "Background", hex: "#FFFFFF", rgb: [255, 255, 255] },
        { name: "Text", hex: "#1F2937", rgb: [31, 41, 55] },
      ],
    },
    densityPreset: "comfortable",
    tags: ["Bold", "Startup", "Energetic"],
    designTokens: {
      "theme.color.primary": "#EF4444",
      "theme.color.secondary": "#F59E0B",
      "theme.color.cta": "#10B981",
      "theme.color.background": "#FFFFFF",
      "theme.color.text": "#1F2937",
      "theme.spacing.base": 10,
      "theme.radius.md": 0,
      "theme.shadow.card": "soft",
    },
  },
  {
    id: "warm-earth",
    name: "Warm Earth",
    description: "Organic, warm tones for approachable dashboards",
    previewImageUrl: "/style-previews/warm-earth.png",
    palette: {
      name: "Warm Natural",
      swatches: [
        { name: "Primary", hex: "#D97706", rgb: [217, 119, 6] },
        { name: "Secondary", hex: "#92400E", rgb: [146, 64, 14] },
        { name: "CTA", hex: "#059669", rgb: [5, 150, 105] },
        { name: "Background", hex: "#FFFBEB", rgb: [255, 251, 235] },
        { name: "Text", hex: "#1C1917", rgb: [28, 25, 23] },
      ],
    },
    densityPreset: "spacious",
    tags: ["Warm", "Approachable", "Organic"],
    designTokens: {
      "theme.color.primary": "#D97706",
      "theme.color.secondary": "#92400E",
      "theme.color.cta": "#059669",
      "theme.color.background": "#FFFBEB",
      "theme.color.text": "#1C1917",
      "theme.spacing.base": 12,
      "theme.radius.md": 12,
      "theme.shadow.card": "soft",
    },
  },
  {
    id: "corporate-trust",
    name: "Corporate Trust",
    description: "Conservative, trustworthy design for enterprise clients",
    previewImageUrl: "/style-previews/corporate.png",
    palette: {
      name: "Enterprise",
      swatches: [
        { name: "Primary", hex: "#1E40AF", rgb: [30, 64, 175] },
        { name: "Secondary", hex: "#374151", rgb: [55, 65, 81] },
        { name: "CTA", hex: "#15803D", rgb: [21, 128, 61] },
        { name: "Background", hex: "#FFFFFF", rgb: [255, 255, 255] },
        { name: "Text", hex: "#111827", rgb: [17, 24, 39] },
      ],
    },
    densityPreset: "compact",
    tags: ["Enterprise", "Trust", "Conservative"],
    designTokens: {
      "theme.color.primary": "#1E40AF",
      "theme.color.secondary": "#374151",
      "theme.color.cta": "#15803D",
      "theme.color.background": "#FFFFFF",
      "theme.color.text": "#111827",
      "theme.spacing.base": 8,
      "theme.radius.md": 4,
      "theme.shadow.card": "subtle",
    },
  },
  {
    id: "neon-cyber",
    name: "Neon Cyber",
    description: "High-energy cyberpunk aesthetic for tech-forward brands",
    previewImageUrl: "/style-previews/cyber.png",
    palette: {
      name: "Cyberpunk",
      swatches: [
        { name: "Primary", hex: "#22D3EE", rgb: [34, 211, 238] },
        { name: "Secondary", hex: "#E879F9", rgb: [232, 121, 249] },
        { name: "CTA", hex: "#4ADE80", rgb: [74, 222, 128] },
        { name: "Background", hex: "#020617", rgb: [2, 6, 23] },
        { name: "Text", hex: "#F1F5F9", rgb: [241, 245, 249] },
      ],
    },
    densityPreset: "compact",
    tags: ["Cyber", "Neon", "Tech"],
    designTokens: {
      "theme.color.primary": "#22D3EE",
      "theme.color.secondary": "#E879F9",
      "theme.color.cta": "#4ADE80",
      "theme.color.background": "#020617",
      "theme.color.text": "#F1F5F9",
      "theme.spacing.base": 8,
      "theme.radius.md": 4,
      "theme.shadow.card": "glow",
    },
  },
  {
    id: "pastel-soft",
    name: "Pastel Soft",
    description: "Gentle, calming design for healthcare and wellness",
    previewImageUrl: "/style-previews/pastel.png",
    palette: {
      name: "Wellness",
      swatches: [
        { name: "Primary", hex: "#7C3AED", rgb: [124, 58, 237] },
        { name: "Secondary", hex: "#EC4899", rgb: [236, 72, 153] },
        { name: "CTA", hex: "#14B8A6", rgb: [20, 184, 166] },
        { name: "Background", hex: "#FAF5FF", rgb: [250, 245, 255] },
        { name: "Text", hex: "#1E1B4B", rgb: [30, 27, 75] },
      ],
    },
    densityPreset: "spacious",
    tags: ["Soft", "Calming", "Wellness"],
    designTokens: {
      "theme.color.primary": "#7C3AED",
      "theme.color.secondary": "#EC4899",
      "theme.color.cta": "#14B8A6",
      "theme.color.background": "#FAF5FF",
      "theme.color.text": "#1E1B4B",
      "theme.spacing.base": 12,
      "theme.radius.md": 16,
      "theme.shadow.card": "soft",
    },
  },
];

/**
 * Score archetypes against workflow context.
 */
function scoreArchetypes(
  archetypes: StyleBundle[],
  context: {
    platformType?: string;
    selectedOutcome?: string;
    workflowName?: string;
  }
): Array<{ bundle: StyleBundle; score: number }> {
  const { platformType, selectedOutcome, workflowName } = context;
  const wfLower = (workflowName || "").toLowerCase();

  return archetypes.map((bundle) => {
    let score = 0;

    // Platform affinity
    if (platformType === "vapi" || platformType === "retell") {
      if (bundle.id === "premium-dark") score += 3;
      if (bundle.id === "neon-cyber") score += 2;
      if (bundle.id === "glass-premium") score += 1;
    } else if (
      platformType === "n8n" ||
      platformType === "make" ||
      platformType === "activepieces"
    ) {
      if (bundle.id === "professional-clean") score += 3;
      if (bundle.id === "corporate-trust") score += 2;
      if (bundle.id === "glass-premium") score += 1;
    }

    // Outcome affinity
    if (selectedOutcome === "product") {
      if (bundle.id === "bold-startup") score += 3;
      if (bundle.id === "neon-cyber") score += 2;
      if (bundle.id === "glass-premium") score += 1;
    } else {
      if (bundle.id === "professional-clean") score += 2;
      if (bundle.id === "premium-dark") score += 1;
      if (bundle.id === "corporate-trust") score += 1;
    }

    // Workflow name keyword matching
    if (wfLower.includes("lead") || wfLower.includes("crm") || wfLower.includes("sales")) {
      if (bundle.id === "professional-clean") score += 2;
      if (bundle.id === "corporate-trust") score += 1;
    }
    if (wfLower.includes("roi") || wfLower.includes("revenue") || wfLower.includes("finance")) {
      if (bundle.id === "corporate-trust") score += 2;
      if (bundle.id === "premium-dark") score += 1;
    }
    if (
      wfLower.includes("health") ||
      wfLower.includes("patient") ||
      wfLower.includes("wellness")
    ) {
      if (bundle.id === "pastel-soft") score += 3;
      if (bundle.id === "warm-earth") score += 1;
    }
    if (wfLower.includes("ai") || wfLower.includes("agent") || wfLower.includes("bot")) {
      if (bundle.id === "neon-cyber") score += 2;
      if (bundle.id === "glass-premium") score += 2;
    }
    if (
      wfLower.includes("support") ||
      wfLower.includes("ticket") ||
      wfLower.includes("helpdesk")
    ) {
      if (bundle.id === "warm-earth") score += 2;
      if (bundle.id === "professional-clean") score += 1;
    }

    // Small random jitter so ties break differently each call
    score += Math.random() * 0.5;

    return { bundle, score };
  });
}

export const getStyleBundles = createTool({
  id: "getStyleBundles",
  description:
    "Show 2 context-aware style bundle recommendations. If the user wants more options, call again with excludeIds containing the IDs already shown. The tool keeps a catalog of 8 styles and serves the next best 2 each time.",

  inputSchema: z.object({
    count: z.number().optional().default(2),
    excludeIds: z
      .array(z.string())
      .optional()
      .default([])
      .describe("IDs of bundles already shown to the user. Pass these to get fresh options."),
    platformType: z.string().optional(),
    selectedOutcome: z.string().optional(),
    workflowName: z.string().optional(),
  }),

  outputSchema: z.object({
    bundles: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string(),
      })
    ),
    hasMore: z.boolean(),
    shownSoFar: z.number(),
    totalAvailable: z.number(),
  }),

  execute: async (inputData, context) => {
    const count = inputData.count ?? 2;
    const excludeIds = new Set(inputData.excludeIds ?? []);

    // Get context from RequestContext OR from input parameters
    const platformType =
      inputData.platformType ||
      (context?.requestContext?.get("platformType") as string) ||
      undefined;
    const selectedOutcome =
      inputData.selectedOutcome ||
      (context?.requestContext?.get("selectedOutcome") as string) ||
      undefined;
    const workflowName =
      inputData.workflowName ||
      (context?.requestContext?.get("workflowName") as string) ||
      undefined;

    // Filter out already-shown bundles
    const available = STYLE_CATALOG.filter((b) => !excludeIds.has(b.id));

    if (available.length === 0) {
      // All bundles have been shown — wrap around and show top 2 again
      const scored = scoreArchetypes(STYLE_CATALOG, {
        platformType,
        selectedOutcome,
        workflowName,
      });
      scored.sort((a, b) => b.score - a.score);
      const selected = scored.slice(0, count).map((s) => s.bundle);

      return {
        bundles: selected.map((b) => ({
          id: b.id,
          name: b.name,
          description: b.description,
        })),
        hasMore: false,
        shownSoFar: STYLE_CATALOG.length,
        totalAvailable: STYLE_CATALOG.length,
      };
    }

    // Score and rank remaining archetypes
    const scored = scoreArchetypes(available, {
      platformType,
      selectedOutcome,
      workflowName,
    });
    scored.sort((a, b) => b.score - a.score);
    const selected = scored.slice(0, count).map((s) => s.bundle);

    const shownSoFar = excludeIds.size + selected.length;
    const hasMore = available.length > count;

    // Stream the pair as design system UI cards
    if (context?.writer && selected.length >= 2) {
      const streamPair = selected.slice(0, 2);

      await context.writer.write({
        type: "text-delta",
        textDelta: excludeIds.size > 0
          ? "Here are two more styles for you:\n\n"
          : "Here are two styles tailored for your workflow:\n\n",
      });

      await context.writer.custom({
        type: "data-design-system-pair",
        data: {
          systems: streamPair.map((bundle) => ({
            id: bundle.id,
            name: bundle.name,
            emoji: "🎨",
            colors: bundle.palette.swatches
              .slice(0, 3)
              .map((s) => s.hex)
              .join(" / "),
            style: bundle.description,
            typography:
              (bundle.designTokens as Record<string, string>)["font.family.sans"] || "Inter",
            bestFor: bundle.tags.join(", "),
            fullOutput: JSON.stringify(bundle, null, 2),
          })),
          hasMore,
        },
      });
    }

    return {
      bundles: selected.map((b) => ({
        id: b.id,
        name: b.name,
        description: b.description,
      })),
      hasMore,
      shownSoFar,
      totalAvailable: STYLE_CATALOG.length,
    };
  },
});
