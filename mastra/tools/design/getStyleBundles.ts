import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { searchDesignKBLocal } from "@/mastra/tools/designAdvisor";
import { generateDesignSystem, searchDesignDatabase } from "@/mastra/tools/design-system";
import { callTool } from "../../lib/callTool";

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

function extractHexes(text: string): string[] {
  return text.match(/#[0-9a-fA-F]{6}/g) ?? [];
}

function pickPreviewImage(styleText: string): string {
  const t = styleText.toLowerCase();
  if (t.includes("glass")) return "/style-previews/glassmorphism.png";
  if (t.includes("brutal")) return "/style-previews/brutalism.png";
  if (t.includes("neo") || t.includes("neumorph") || t.includes("soft ui")) return "/style-previews/neumorphism.png";
  if (t.includes("minimal")) return "/style-previews/minimalism.png";
  if (t.includes("dark")) return "/style-previews/dark-mode.png";
  return "/style-previews/minimalism.png";
}

function bundleFromHexes(opts: {
  idSeed: string;
  name: string;
  description: string;
  tags: string[];
  styleTextForPreview: string;
  hexes: string[];
}): StyleBundle {
  const paletteHex = (opts.hexes.length >= 5 ? opts.hexes.slice(0, 5) : []).concat(
    ["#2563EB", "#22C55E", "#F8FAFC", "#FFFFFF", "#0F172A"].slice(Math.max(0, 5 - opts.hexes.length)),
  );

  return {
    id: stableId(opts.idSeed),
    name: opts.name,
    description: opts.description,
    previewImageUrl: pickPreviewImage(opts.styleTextForPreview),
    palette: {
      name: "UI/UX Pro Max",
      swatches: [
        { name: "Primary", hex: paletteHex[0]!, rgb: hexToRgb(paletteHex[0]!) },
        { name: "Accent", hex: paletteHex[1]!, rgb: hexToRgb(paletteHex[1]!) },
        { name: "Background", hex: paletteHex[2]!, rgb: hexToRgb(paletteHex[2]!) },
        { name: "Surface", hex: paletteHex[3]!, rgb: hexToRgb(paletteHex[3]!) },
        { name: "Text", hex: paletteHex[4]!, rgb: hexToRgb(paletteHex[4]!) },
      ],
    },
    densityPreset: "comfortable",
    tags: opts.tags,
    designTokens: {
      "theme.color.primary": paletteHex[0]!,
      "theme.color.accent": paletteHex[1]!,
      "theme.color.background": paletteHex[2]!,
      "theme.color.surface": paletteHex[3]!,
      "theme.color.text": paletteHex[4]!,
      "theme.spacing.base": 10,
      "theme.radius.md": 12,
      "theme.shadow.card": "soft",
    },
  };
}

function fallbackBundles(): StyleBundle[] {
  return [
    {
      id: "agency-premium-glass",
      name: "Agency Premium (Glass)",
      description: "High-end, client-ready, soft depth and clean charts",
      previewImageUrl: "/style-previews/glassmorphism.png",
      palette: {
        name: "Premium Neutral",
        swatches: [
          { name: "Primary", hex: "#2563EB", rgb: [37, 99, 235] },
          { name: "Accent", hex: "#22C55E", rgb: [34, 197, 94] },
          { name: "Background", hex: "#F8FAFC", rgb: [248, 250, 252] },
          { name: "Surface", hex: "#FFFFFF", rgb: [255, 255, 255] },
          { name: "Text", hex: "#0F172A", rgb: [15, 23, 42] },
        ],
      },
      densityPreset: "comfortable",
      tags: ["Client-facing", "Premium", "Clean"],
      designTokens: {
        "theme.radius.md": 14,
        "theme.shadow.card": "soft",
        "theme.spacing.base": 10,
        "theme.color.primary": "#2563EB",
        "theme.color.accent": "#22C55E",
        "theme.color.background": "#F8FAFC",
        "theme.color.surface": "#FFFFFF",
        "theme.color.text": "#0F172A",
      },
    },
    {
      id: "modern-dark-saas",
      name: "Modern SaaS (Dark)",
      description: "Sleek, high contrast, great for ops + reliability",
      previewImageUrl: "/style-previews/dark-mode.png",
      palette: {
        name: "Dark SaaS",
        swatches: [
          { name: "Primary", hex: "#60A5FA", rgb: [96, 165, 250] },
          { name: "Accent", hex: "#F472B6", rgb: [244, 114, 182] },
          { name: "Background", hex: "#0B1220", rgb: [11, 18, 32] },
          { name: "Surface", hex: "#111827", rgb: [17, 24, 39] },
          { name: "Text", hex: "#E5E7EB", rgb: [229, 231, 235] },
        ],
      },
      densityPreset: "comfortable",
      tags: ["Ops", "Modern", "High contrast"],
      designTokens: {
        "theme.radius.md": 12,
        "theme.shadow.card": "medium",
        "theme.spacing.base": 10,
        "theme.color.primary": "#60A5FA",
        "theme.color.accent": "#F472B6",
        "theme.color.background": "#0B1220",
        "theme.color.surface": "#111827",
        "theme.color.text": "#E5E7EB",
      },
    },
    {
      id: "minimal-report",
      name: "Minimal Report",
      description: "Executive report feel, low noise, strong hierarchy",
      previewImageUrl: "/style-previews/minimalism.png",
      palette: {
        name: "Slate Minimal",
        swatches: [
          { name: "Primary", hex: "#334155", rgb: [51, 65, 85] },
          { name: "Accent", hex: "#0EA5E9", rgb: [14, 165, 233] },
          { name: "Background", hex: "#F9FAFB", rgb: [249, 250, 251] },
          { name: "Surface", hex: "#FFFFFF", rgb: [255, 255, 255] },
          { name: "Text", hex: "#111827", rgb: [17, 24, 39] },
        ],
      },
      densityPreset: "comfortable",
      tags: ["Client-facing", "Report", "Minimal"],
      designTokens: {
        "theme.radius.md": 10,
        "theme.shadow.card": "none",
        "theme.spacing.base": 12,
        "theme.color.primary": "#334155",
        "theme.color.accent": "#0EA5E9",
        "theme.color.background": "#F9FAFB",
        "theme.color.surface": "#FFFFFF",
        "theme.color.text": "#111827",
      },
    },
    {
      id: "bold-startup",
      name: "Bold Startup",
      description: "Punchy, high energy, looks like a real SaaS product",
      previewImageUrl: "/style-previews/brutalism.png",
      palette: {
        name: "Startup Bold",
        swatches: [
          { name: "Primary", hex: "#F97316", rgb: [249, 115, 22] },
          { name: "Accent", hex: "#A78BFA", rgb: [167, 139, 250] },
          { name: "Background", hex: "#0B0F19", rgb: [11, 15, 25] },
          { name: "Surface", hex: "#111827", rgb: [17, 24, 39] },
          { name: "Text", hex: "#F9FAFB", rgb: [249, 250, 251] },
        ],
      },
      densityPreset: "comfortable",
      tags: ["SaaS", "Bold", "High energy"],
      designTokens: {
        "theme.radius.md": 8,
        "theme.shadow.card": "hard",
        "theme.spacing.base": 10,
        "theme.color.primary": "#F97316",
        "theme.color.accent": "#A78BFA",
        "theme.color.background": "#0B0F19",
        "theme.color.surface": "#111827",
        "theme.color.text": "#F9FAFB",
      },
    },
  ];
}

// Parse function is intentionally conservative; it tries to extract palette hexes if present.
// If parsing fails, returns safe fallback bundles.
function parseBundlesFromText(text: string): StyleBundle[] | null {
  const lines = text.split("\n").map((l) => l.trim());
  const hexes = text.match(/#[0-9a-fA-F]{6}/g) ?? [];

  // If we don't even see colors, don't pretend.
  if (hexes.length < 8) return null;

  // Create 4 bundles by slicing hexes into 5-color palettes.
  const bundles: StyleBundle[] = [];
  const names = [
    { name: "Agency Premium (Glass)", preview: "/style-previews/glassmorphism.png", tags: ["Client-facing", "Premium", "Clean"] },
    { name: "Modern SaaS (Dark)", preview: "/style-previews/dark-mode.png", tags: ["Ops", "Modern", "High contrast"] },
    { name: "Minimal Report", preview: "/style-previews/minimalism.png", tags: ["Client-facing", "Report", "Minimal"] },
    { name: "Bold Startup", preview: "/style-previews/brutalism.png", tags: ["SaaS", "Bold", "High energy"] },
  ];

  for (let i = 0; i < 4; i++) {
    const paletteHex = hexes.slice(i * 5, i * 5 + 5);
    if (paletteHex.length < 5) break;

    const bundleName = names[i]!.name;
    bundles.push({
      id: stableId(bundleName),
      name: bundleName,
      description: "RAG-recommended bundle based on your dashboard goals.",
      previewImageUrl: names[i]!.preview,
      palette: {
        name: "RAG Palette",
        swatches: [
          { name: "Primary", hex: paletteHex[0]!, rgb: hexToRgb(paletteHex[0]!) },
          { name: "Accent", hex: paletteHex[1]!, rgb: hexToRgb(paletteHex[1]!) },
          { name: "Background", hex: paletteHex[2]!, rgb: hexToRgb(paletteHex[2]!) },
          { name: "Surface", hex: paletteHex[3]!, rgb: hexToRgb(paletteHex[3]!) },
          { name: "Text", hex: paletteHex[4]!, rgb: hexToRgb(paletteHex[4]!) },
        ],
      },
      densityPreset: "comfortable",
      tags: names[i]!.tags,
      designTokens: {
        "theme.color.primary": paletteHex[0]!,
        "theme.color.accent": paletteHex[1]!,
        "theme.color.background": paletteHex[2]!,
        "theme.color.surface": paletteHex[3]!,
        "theme.color.text": paletteHex[4]!,
        "theme.spacing.base": 10,
        "theme.radius.md": 12,
        "theme.shadow.card": "soft",
      },
    });
  }

  return bundles.length === 4 ? bundles : null;
}

export const getStyleBundles = createTool({
  id: "design.getStyleBundles",
  description:
    "Return 4 style+palette bundles (visual-card ready) grounded in UI/UX Pro Max catalog. Used during Phase 3 (required style selection).",
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
  execute: async (inputData: any, context: any) => {
    console.log("[TOOL][design.getStyleBundles] hybrid inputs:", inputData);

    const bundles: StyleBundle[] = [];
    const sources: Array<{ kind: string; note: string }> = [];

    // Primary: Generate design system
    try {
      const primaryResult = await callTool(
        generateDesignSystem,
        { 
          query: `${inputData.platformType} ${inputData.dashboardKind} ${inputData.audience} ${inputData.outcome} premium`,
          format: "markdown"
        },
        { requestContext: context?.requestContext ?? context ?? {} }
      );

      const primaryOut = String(primaryResult?.output ?? "");
      console.log("[TOOL][design.getStyleBundles] generateDesignSystem output chars:", primaryOut.length);

      if (primaryOut) {
        const hexes = extractHexes(primaryOut);
        if (hexes.length >= 5) {
          bundles.push(bundleFromHexes({
            idSeed: "primary-generate",
            name: "AI-Generated Design System",
            description: `Primary design system for ${inputData.platformType} ${inputData.dashboardKind}`,
            tags: [inputData.audience, inputData.outcome, "Generated"],
            styleTextForPreview: primaryOut,
            hexes
          }));
          sources.push({ kind: "python-generate", note: "generateDesignSystem" });
        }
      }
    } catch {
      // Handle errors silently, fall back to safe bundle later
    }

    // Alternative 1: Style domain search
    try {
      const alt1Result = await callTool(
        searchDesignDatabase,
        { 
          query: `${inputData.platformType} ${inputData.dashboardKind} premium`,
          domain: "style",
          maxResults: 3
        },
        { requestContext: context?.requestContext ?? context ?? {} }
      );

      const alt1Out = String(alt1Result?.output ?? "");
      if (alt1Out) {
        const hexes = extractHexes(alt1Out);
        if (hexes.length >= 3) {
          bundles.push(bundleFromHexes({
            idSeed: "alt-style-premium",
            name: "Premium Style Alternative",
            description: `Alternative style for ${inputData.dashboardKind}`,
            tags: [inputData.audience, "Style"],
            styleTextForPreview: alt1Out,
            hexes
          }));
          sources.push({ kind: "python-domain", note: "domain=style" });
        }
      }
    } catch {
      // Handle errors silently
    }

    // Alternative 2: Opposite aesthetic
    try {
      const oppositeStyle = inputData.audience === "client" ? "brutalism high-contrast" : "minimal";
      const alt2Result = await callTool(
        searchDesignDatabase,
        { 
          query: `${inputData.platformType} ${inputData.dashboardKind} ${oppositeStyle}`,
          domain: "style",
          maxResults: 2
        },
        { requestContext: context?.requestContext ?? context ?? {} }
      );

      const alt2Out = String(alt2Result?.output ?? "");
      if (alt2Out) {
        const hexes = extractHexes(alt2Out);
        if (hexes.length >= 3) {
          bundles.push(bundleFromHexes({
            idSeed: "alt-opposite-aesthetic",
            name: oppositeStyle === "minimal" ? "Minimal Alternative" : "Bold Alternative",
            description: `Opposite aesthetic: ${oppositeStyle}`,
            tags: ["Alternative", oppositeStyle.includes("minimal") ? "Clean" : "Bold"],
            styleTextForPreview: alt2Out,
            hexes
          }));
          sources.push({ kind: "python-domain", note: `domain=style (${oppositeStyle})` });
        }
      }
    } catch {
      // Handle errors silently
    }

    // Alternative 3: Platform-specific colors
    try {
      const alt3Result = await callTool(
        searchDesignDatabase,
        { 
          query: `${inputData.platformType} dashboard ${inputData.outcome}`,
          domain: "color",
          maxResults: 2
        },
        { requestContext: context?.requestContext ?? context ?? {} }
      );

      const alt3Out = String(alt3Result?.output ?? "");
      if (alt3Out) {
        const hexes = extractHexes(alt3Out);
        if (hexes.length >= 3) {
          bundles.push(bundleFromHexes({
            idSeed: "alt-platform-colors",
            name: `${inputData.platformType} Color Palette`,
            description: `Platform-specific colors for ${inputData.platformType}`,
            tags: [inputData.platformType, "Colors"],
            styleTextForPreview: alt3Out,
            hexes
          }));
          sources.push({ kind: "python-domain", note: "domain=color" });
        }
      }
    } catch {
      // Handle errors silently
    }

    // Fill remaining slots with fallback bundles to ensure exactly 4 results
    while (bundles.length < 4) {
      const fallback = fallbackBundles();
      const remaining = 4 - bundles.length;
      for (let i = 0; i < remaining && i < fallback.length; i++) {
        if (!bundles.find(b => b.name === fallback[i].name)) {
          bundles.push(fallback[i]);
          sources.push({ kind: "fallback", note: "Default safe bundle" });
        }
      }
      if (bundles.length === 0) break; // Safety check
    }

    // Take exactly 4 bundles
    const finalBundles = bundles.slice(0, 4);
    
    // Validate output against schema before returning
    const validated = z.array(StyleBundle).length(4).parse(finalBundles);

    return { bundles: validated, sources };
  },
});
