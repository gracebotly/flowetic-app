import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const getStyleBundles = createTool({
  id: "getStyleBundles",
  description: "Generate and display style bundle pairs (design systems) with streaming UI",

  inputSchema: z.object({
    count: z.number().optional().default(4),
  }),

  outputSchema: z.object({
    bundles: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string(),
      })
    ),
  }),

  execute: async (inputData, context) => {
    const bundles = [
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
        densityPreset: "comfortable" as const,
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
        densityPreset: "comfortable" as const,
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
        densityPreset: "comfortable" as const,
        tags: ["Premium", "Glass", "AI"],
        designTokens: {
          "theme.color.primary": "#3B82F6",
          "theme.color.secondary": "#8B5CF6",
          "theme.color.cta": "#06B6D4",
          "theme.color.background": "#F9FAFB",
          "theme.color.text": "#111827",
          "theme.spacing.base": 10,
          "theme.radius.md": 8,
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
        densityPreset: "comfortable" as const,
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
    ];

    // ✅ STREAM CUSTOM UI DATA
    if (context?.writer && bundles.length >= 2) {
      const firstTwo = bundles.slice(0, 2);

      await context.writer.custom({
        type: "data-design-system-pair",
        systems: firstTwo.map((bundle) => ({
          id: bundle.id,
          name: bundle.name,
          emoji: "🎨",
          colors:
            bundle.palette?.swatches
              ?.slice(0, 3)
              .map((s) => s.hex)
              .join(" / ") || "Colors",
          style: bundle.description,
          typography:
            bundle.designTokens?.["font.family.sans"] || "Inter",
          bestFor: bundle.tags?.join(", ") || "General use",
          fullOutput: JSON.stringify(bundle, null, 2),
        })),
        hasMore: bundles.length > 2,
      } as any); // Type assertion - AI SDK preserves properties at runtime
    }

    return {
      bundles: bundles.map((b) => ({
        id: b.id,
        name: b.name,
        description: b.description,
      })),
    };
  },
});
