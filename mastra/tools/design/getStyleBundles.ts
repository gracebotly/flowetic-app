import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { searchDesignKB, searchDesignKBLocal } from "@/mastra/tools/designAdvisor";
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

function convertPythonResultToBundles(
  pythonResult: any,
  inputData: {
    platformType: string;
    outcome: string;
    audience: string;
  }
): StyleBundle[] {
  const bundles: StyleBundle[] = [];
  
  // Extract recommendations from Python output
  const { recommendations, alternatives } = pythonResult;
  
  // Bundle 1: Primary recommendation
  if (recommendations?.style && recommendations?.color_palette) {
    const colors = recommendations.color_palette;
    bundles.push({
      id: stableId(recommendations.style.name || "primary-recommendation"),
      name: recommendations.style.name || "Primary Recommendation",
      description: recommendations.style.description || "AI-recommended style based on your requirements",
      previewImageUrl: "/style-previews/glassmorphism.png",
      palette: {
        name: colors.name || "Primary Palette",
        swatches: [
          { name: "Primary", hex: colors.hex_primary || "#2563EB", rgb: hexToRgb(colors.hex_primary || "#2563EB") },
          { name: "Secondary", hex: colors.hex_secondary || "#3B82F6", rgb: hexToRgb(colors.hex_secondary || "#3B82F6") },
          { name: "Accent", hex: colors.hex_accent || "#22C55E", rgb: hexToRgb(colors.hex_accent || "#22C55E") },
          { name: "Background", hex: colors.hex_background || "#F8FAFC", rgb: hexToRgb(colors.hex_background || "#F8FAFC") },
          { name: "Text", hex: colors.hex_text || "#0F172A", rgb: hexToRgb(colors.hex_text || "#0F172A") },
        ],
      },
      densityPreset: "comfortable",
      tags: (recommendations.style.tags || "").split(";").filter(Boolean),
      designTokens: {
        "theme.color.primary": colors.hex_primary || "#2563EB",
        "theme.color.secondary": colors.hex_secondary || "#3B82F6",
        "theme.color.accent": colors.hex_accent || "#22C55E",
        "theme.color.background": colors.hex_background || "#F8FAFC",
        "theme.color.text": colors.hex_text || "#0F172A",
        "theme.spacing.base": 10,
        "theme.radius.md": 12,
        "theme.shadow.card": "soft",
      },
    });
  }
  
  // Bundles 2-4: Alternatives
  const altStyles = alternatives?.styles || [];
  const altColors = alternatives?.colors || [];
  
  for (let i = 0; i < 3 && i < Math.max(altStyles.length, altColors.length); i++) {
    const style = altStyles[i] || recommendations?.style || {};
    const colors = altColors[i] || recommendations?.color_palette || {};
    
    bundles.push({
      id: stableId(style.name || `alternative-${i + 1}`),
      name: style.name || `Alternative ${i + 1}`,
      description: style.description || "Alternative style recommendation",
      previewImageUrl: `/style-previews/${i === 0 ? 'dark-mode' : i === 1 ? 'minimalism' : 'brutalism'}.png`,
      palette: {
        name: colors.name || `Palette ${i + 1}`,
        swatches: [
          { name: "Primary", hex: colors.hex_primary || "#60A5FA", rgb: hexToRgb(colors.hex_primary || "#60A5FA") },
          { name: "Secondary", hex: colors.hex_secondary || "#F472B6", rgb: hexToRgb(colors.hex_secondary || "#F472B6") },
          { name: "Accent", hex: colors.hex_accent || "#10B981", rgb: hexToRgb(colors.hex_accent || "#10B981") },
          { name: "Background", hex: colors.hex_background || "#0B1220", rgb: hexToRgb(colors.hex_background || "#0B1220") },
          { name: "Text", hex: colors.hex_text || "#E5E7EB", rgb: hexToRgb(colors.hex_text || "#E5E7EB") },
        ],
      },
      densityPreset: "comfortable",
      tags: (style.tags || "").split(";").filter(Boolean),
      designTokens: {
        "theme.color.primary": colors.hex_primary || "#60A5FA",
        "theme.color.secondary": colors.hex_secondary || "#F472B6",
        "theme.color.accent": colors.hex_accent || "#10B981",
        "theme.color.background": colors.hex_background || "#0B1220",
        "theme.color.text": colors.hex_text || "#E5E7EB",
        "theme.spacing.base": 10,
        "theme.radius.md": 12,
        "theme.shadow.card": "medium",
      },
    });
  }
  
  // Ensure exactly 4 bundles
  while (bundles.length < 4) {
    bundles.push(fallbackBundles()[bundles.length]!);
  }
  
  return bundles.slice(0, 4);
}

function generateContextualFallbacks(inputData: {
  platformType: string;
  outcome: string;
  audience: string;
}): StyleBundle[] {
  // Generate contextual bundles based on input parameters
  const isClient = inputData.audience === "client";
  const isDashboard = inputData.outcome === "dashboard";
  
  const contextualBundles: StyleBundle[] = [
    {
      id: stableId(`${inputData.platformType}-${inputData.audience}-primary`),
      name: `${inputData.platformType.charAt(0).toUpperCase() + inputData.platformType.slice(1)} ${inputData.audience === "client" ? "Premium" : "Efficient"}`,
      description: `Optimized for ${inputData.audience} users on ${inputData.platformType}`,
      previewImageUrl: "/style-previews/contextual-primary.png",
      palette: {
        name: "Contextual Primary",
        swatches: [
          { name: "Primary", hex: isClient ? "#2563EB" : "#60A5FA", rgb: isClient ? hexToRgb("#2563EB") : hexToRgb("#60A5FA") },
          { name: "Secondary", hex: "#3B82F6", rgb: hexToRgb("#3B82F6") },
          { name: "Accent", hex: "#22C55E", rgb: hexToRgb("#22C55E") },
          { name: "Background", hex: "#F8FAFC", rgb: hexToRgb("#F8FAFC") },
          { name: "Text", hex: "#0F172A", rgb: hexToRgb("#0F172A") },
        ],
      },
      densityPreset: isClient ? "comfortable" : "compact",
      tags: [inputData.platformType, inputData.audience, "contextual"],
      designTokens: {
        "theme.color.primary": isClient ? "#2563EB" : "#60A5FA",
        "theme.color.background": "#F8FAFC",
        "theme.spacing.base": 10,
        "theme.radius.md": 12,
      },
    }
  ];
  
  // Fill remaining slots with standard fallbacks
  const standardFallbacks = fallbackBundles();
  for (let i = 1; i < 4; i++) {
    if (standardFallbacks[i - 1]) {
      contextualBundles.push(standardFallbacks[i - 1]);
    }
  }
  
  return contextualBundles.slice(0, 4);
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
    const queryText = `${inputData.platformType} ${inputData.audience} ${inputData.outcome} ${inputData.dashboardKind}`;
    const sources: Array<{ kind: string; note: string }> = [];
    
    let bundles: StyleBundle[] = [];
    
    // Try Python BM25 search first
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      const path = require('path');
      
      // Get absolute path to search script
      const scriptPath = path.join(__dirname, 'search.py');
      const projectName = context?.requestContext?.get?.("tenantId") || "Project";
      
      const cmd = `python3 "${scriptPath}" "${queryText}" --design-system -p "${projectName}"`;
      
      console.log(`[getStyleBundles] Executing: ${cmd}`);
      
      const { stdout, stderr } = await execAsync(cmd, {
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        timeout: 30000, // 30 second timeout
      });
      
      if (stderr) {
        console.warn(`[getStyleBundles] Python stderr:`, stderr);
      }
      
      // Parse Python output
      const pythonResult = JSON.parse(stdout);
      sources.push({ kind: "bm25", note: "python-search-script" });
      
      // Convert Python result to bundles
      bundles = convertPythonResultToBundles(pythonResult, inputData);
      
      console.log(`[getStyleBundles] Generated ${bundles.length} bundles from Python search`);
      
    } catch (pythonError) {
      console.error(`[getStyleBundles] Python search failed:`, pythonError);
      
      // Fallback 1: Try TypeScript search tools
      try {
        let relevantText = "";
        
        if (searchDesignKBLocal) {
          const local = await callTool(
            searchDesignKBLocal,
            { queryText, maxChars: 8000 },
            { requestContext: context?.requestContext ?? context ?? {} }
          );
          relevantText = String(local?.relevantText ?? "");
          if (relevantText) {
            sources.push({ kind: "local", note: "searchDesignKBLocal" });
          }
        }
        
        const parsed = parseBundlesFromText(relevantText);
        if (parsed) {
          bundles = parsed;
          console.log(`[getStyleBundles] Generated ${bundles.length} bundles from local search`);
        }
      } catch (localError) {
        console.error(`[getStyleBundles] Local search failed:`, localError);
      }
    }
    
    // Final fallback: Contextual bundles
    if (bundles.length === 0) {
      bundles = generateContextualFallbacks(inputData);
      sources.push({ kind: "fallback", note: "contextual-defaults" });
      console.log(`[getStyleBundles] Using contextual fallbacks`);
    }
    
    // Validate output
    const validated = z.array(StyleBundle).length(4).parse(bundles);
    
    return { bundles: validated, sources };
  },
});
