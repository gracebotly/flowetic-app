import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { searchUIUXData, STYLES, COLORS, type StyleEntry, type ColorEntry } from "@/mastra/data/uiuxStaticData";

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [0, 0, 0];
}

const Swatch = z.object({ name: z.string(), hex: z.string(), rgb: z.array(z.number()).length(3) });

const StyleBundle = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  previewImageUrl: z.string(),
  palette: z.object({
    name: z.string(),
    swatches: z.array(Swatch.extend({ description: z.string().optional() })),
  }),
  densityPreset: z.enum(["compact", "comfortable", "spacious"]),
  tags: z.array(z.string()),
  designTokens: z.record(z.any()),
});

export type StyleBundle = z.infer<typeof StyleBundle>;

function stableId(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64);
}

function pickPreviewImage(styleName: string): string {
  const t = styleName.toLowerCase();
  if (t.includes("glass")) return "/style-previews/glassmorphism.png";
  if (t.includes("brutal") || t.includes("neubrutalism")) return "/style-previews/brutalism.png";
  if (t.includes("neumorph") || t.includes("soft")) return "/style-previews/neumorphism.png";
  if (t.includes("dark")) return "/style-previews/dark-mode.png";
  if (t.includes("bento")) return "/style-previews/bento-grid.png";
  return "/style-previews/minimalism.png";
}

function buildBundle(
  style: StyleEntry,
  color: ColorEntry,
  bundleName: string,
  description: string,
  tags: string[],
  density: "compact" | "comfortable" | "spacious" = "comfortable"
): StyleBundle {
  return {
    id: stableId(bundleName),
    name: bundleName,
    description,
    previewImageUrl: pickPreviewImage(style.name),
    palette: {
      name: color.productType,
      swatches: [
        { name: "Primary", hex: color.primary, rgb: hexToRgb(color.primary) },
        { name: "Secondary", hex: color.secondary, rgb: hexToRgb(color.secondary) },
        { name: "CTA", hex: color.cta, rgb: hexToRgb(color.cta) },
        { name: "Background", hex: color.background, rgb: hexToRgb(color.background) },
        { name: "Text", hex: color.text, rgb: hexToRgb(color.text) },
      ],
    },
    densityPreset: density,
    tags,
    designTokens: {
      "theme.color.primary": color.primary,
      "theme.color.secondary": color.secondary,
      "theme.color.cta": color.cta,
      "theme.color.background": color.background,
      "theme.color.text": color.text,
      "theme.spacing.base": density === "compact" ? 8 : density === "spacious" ? 14 : 10,
      "theme.radius.md": style.name.includes("Brutal") ? 0 : 8,
      "theme.shadow.card": style.name.includes("Glass") ? "glass" : "soft",
    },
  };
}

// Fallback bundles when search returns nothing
function fallbackBundles(): StyleBundle[] {
  const minimalStyle = STYLES.find(s => s.id === "minimalism") || STYLES[0]!;
  const darkStyle = STYLES.find(s => s.id === "dark-mode") || STYLES[2]!;
  const glassStyle = STYLES.find(s => s.id === "glassmorphism") || STYLES[0]!;
  const brutalStyle = STYLES.find(s => s.id === "brutalism") || STYLES[4]!;

  const saasColor = COLORS.find(c => c.id === "saas-b2b") || COLORS[0]!;
  const darkColor = COLORS.find(c => c.id === "agency-premium") || COLORS[8]!;
  const aiColor = COLORS.find(c => c.id === "ai-chatbot-platform") || COLORS[4]!;
  const ecomColor = COLORS.find(c => c.id === "ecommerce-general") || COLORS[3]!;

  return [
    buildBundle(minimalStyle, saasColor, "Professional Clean", "Clean, minimal dashboard for business clients", ["Client-facing", "Professional", "Clean"], "comfortable"),
    buildBundle(darkStyle, darkColor, "Premium Dark", "High-contrast dark theme for premium feel", ["Premium", "Dark", "Modern"], "comfortable"),
    buildBundle(glassStyle, aiColor, "Glass Premium", "Glassmorphism with AI-inspired colors", ["Premium", "Glass", "AI"], "comfortable"),
    buildBundle(brutalStyle, ecomColor, "Bold Startup", "Bold, energetic design for differentiation", ["Bold", "Startup", "Energetic"], "comfortable"),
  ];
}

export const getStyleBundles = createTool({
  id: "design.getStyleBundles",
  description:
    "Return 4 style+palette bundles for dashboard design. Uses UI/UX Pro Max static data. Used during Phase 3 (style selection).",
  inputSchema: z.object({
    platformType: z.string().min(1),
    outcome: z.enum(["dashboard", "product"]),
    audience: z.enum(["client", "ops"]).default("client"),
    dashboardKind: z.string().default("workflow-activity"),
    notes: z.string().optional(),
  }),
  outputSchema: z.object({
    bundles: z.array(StyleBundle).length(4),
    sources: z.array(z.object({ kind: z.string(), note: z.string() })).default([]),
  }),
  execute: async (inputData) => {
    console.log("[TOOL][design.getStyleBundles] STATIC inputs:", inputData);

    const { platformType, audience, dashboardKind, notes } = inputData;

    // Build search query
    const query = `${platformType} ${dashboardKind} ${audience === "ops" ? "technical ops" : "client-facing"} ${notes || ""}`.trim();

    try {
      // Search for relevant styles and colors
      const matchedStyles = searchUIUXData(query, "style", 4);
      const matchedColors = searchUIUXData(query, "color", 4);

      // Build 4 bundles
      const bundles: StyleBundle[] = [];

      // Bundle 1: Primary recommendation (best match)
      const primaryStyle = matchedStyles[0] || STYLES.find(s => s.id === "minimalism")!;
      const primaryColor = matchedColors[0] || COLORS.find(c => c.id === "saas-b2b")!;
      bundles.push(buildBundle(
        primaryStyle,
        primaryColor,
        `${primaryStyle.name} - Primary`,
        `Recommended: ${primaryStyle.bestFor}`,
        ["Primary", "Recommended", audience === "client" ? "Client-ready" : "Ops"],
        audience === "ops" ? "compact" : "comfortable"
      ));

      // Bundle 2: Alternative (second best or different aesthetic)
      const altStyle = matchedStyles[1] || STYLES.find(s => s.id === "executive-dashboard")!;
      const altColor = matchedColors[1] || COLORS.find(c => c.id === "workflow-automation")!;
      bundles.push(buildBundle(
        altStyle,
        altColor,
        `${altStyle.name} - Alternative`,
        `Alternative: ${altStyle.bestFor}`,
        ["Alternative", "Safe"],
        "comfortable"
      ));

      // Bundle 3: Opposite aesthetic (for differentiation)
      const oppositeStyle = audience === "client"
        ? STYLES.find(s => s.id === "dark-mode")!
        : STYLES.find(s => s.id === "glassmorphism")!;
      const oppositeColor = audience === "client"
        ? COLORS.find(c => c.id === "agency-premium")!
        : COLORS.find(c => c.id === "ai-chatbot-platform")!;
      bundles.push(buildBundle(
        oppositeStyle,
        oppositeColor,
        `${oppositeStyle.name} - Contrast`,
        `Contrasting: ${oppositeStyle.bestFor}`,
        ["Contrast", "Differentiated"],
        audience === "ops" ? "compact" : "comfortable"
      ));

      // Bundle 4: Platform-specific
      const platformStyles: Record<string, string> = {
        n8n: "dark-mode",
        make: "minimalism",
        vapi: "real-time-monitoring",
        retell: "minimalism",
        woocommerce: "executive-dashboard",
      };
      const platformColors: Record<string, string> = {
        n8n: "workflow-automation",
        make: "workflow-automation",
        vapi: "call-center-voice",
        retell: "call-center-voice",
        woocommerce: "ecommerce-general",
      };

      const platformStyleId = platformStyles[platformType.toLowerCase()] || "minimalism";
      const platformColorId = platformColors[platformType.toLowerCase()] || "saas-b2b";
      const platformStyle = STYLES.find(s => s.id === platformStyleId) || STYLES[0]!;
      const platformColorEntry = COLORS.find(c => c.id === platformColorId) || COLORS[0]!;

      bundles.push(buildBundle(
        platformStyle,
        platformColorEntry,
        `${platformType} Optimized`,
        `Optimized for ${platformType} dashboards`,
        ["Platform", platformType, "Aligned"],
        "comfortable"
      ));

      // Validate and return
      const validated = z.array(StyleBundle).length(4).parse(bundles);

      return {
        bundles: validated,
        sources: [
          { kind: "static", note: "UI/UX Pro Max static data (serverless)" },
        ],
      };
    } catch (err) {
      console.error("[TOOL][design.getStyleBundles] Error, using fallbacks:", err);
      return {
        bundles: fallbackBundles(),
        sources: [
          { kind: "fallback", note: "Using fallback bundles due to error" },
        ],
      };
    }
  },
});
