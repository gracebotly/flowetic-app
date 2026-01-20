import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { searchDesignKB, searchDesignKBLocal } from "@/mastra/tools/designAdvisor";

const Swatch = z.object({ name: z.string(), hex: z.string() });

export const StyleBundle = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  previewImageUrl: z.string(),
  palette: z.object({
    name: z.string(),
    swatches: z.array(Swatch).min(5).max(8),
  }),
  densityPreset: z.enum(["compact", "comfortable", "spacious"]),
  tags: z.array(z.string()).max(8),
  // Tokens that Design Advisor / spec editor will apply
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
          { name: "Primary", hex: "#2563EB" },
          { name: "Accent", hex: "#22C55E" },
          { name: "Background", hex: "#F8FAFC" },
          { name: "Surface", hex: "#FFFFFF" },
          { name: "Text", hex: "#0F172A" },
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
          { name: "Primary", hex: "#60A5FA" },
          { name: "Accent", hex: "#F472B6" },
          { name: "Background", hex: "#0B1220" },
          { name: "Surface", hex: "#111827" },
          { name: "Text", hex: "#E5E7EB" },
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
          { name: "Primary", hex: "#334155" },
          { name: "Accent", hex: "#0EA5E9" },
          { name: "Background", hex: "#F9FAFB" },
          { name: "Surface", hex: "#FFFFFF" },
          { name: "Text", hex: "#111827" },
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
          { name: "Primary", hex: "#F97316" },
          { name: "Accent", hex: "#A78BFA" },
          { name: "Background", hex: "#0B0F19" },
          { name: "Surface", hex: "#111827" },
          { name: "Text", hex: "#F9FAFB" },
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
          { name: "Primary", hex: paletteHex[0]! },
          { name: "Accent", hex: paletteHex[1]! },
          { name: "Background", hex: paletteHex[2]! },
          { name: "Surface", hex: paletteHex[3]! },
          { name: "Text", hex: paletteHex[4]! },
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
  execute: async (inputData, context) => {
    const queryText =
      `Return 4 style+palette bundles for a ${inputData.dashboardKind} ` +
      `${inputData.outcome} UI, audience=${inputData.audience}, platform=${inputData.platformType}. ` +
      `Each bundle must include: name, brief description, and a 5-color palette (hex). ` +
      `Prefer premium client-ready styles. Notes: ${inputData.notes ?? ""}`;

    // Try vector search; if unavailable, fallback local.
    let relevantText = "";
    const sources: Array<{ kind: string; note: string }> = [];

    try {
      if (searchDesignKB) {
        const rag = await searchDesignKB.execute(
          { query: queryText, maxResults: 8 },
          { requestContext: context?.requestContext }
        );

        // Use the results from searchDesignKB
        if (rag.retrieved && rag.results.length > 0) {
          relevantText = rag.results.map(r => r.content).join("\n\n").slice(0, 12000);
          sources.push({ kind: "vector", note: "searchDesignKB" });
        }
      }
    } catch {
      // ignore and fallback
    }

    if (!relevantText) {
      const local = await searchDesignKBLocal.execute(
        { queryText, maxChars: 8000 },
        { requestContext: context?.requestContext }
      );
      relevantText = local.relevantText || "";
      sources.push({ kind: "local", note: "searchDesignKBLocal" });
    }

    const parsed = parseBundlesFromText(relevantText);
    const bundles = parsed ?? fallbackBundles();

    // Validate output against schema before returning
    const validated = z.array(StyleBundle).length(4).parse(bundles);

    return { bundles: validated, sources };
  },
});
