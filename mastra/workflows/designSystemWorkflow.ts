import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { loadUIUXCSV } from "../tools/uiux/loadUIUXCSV";
import { rankRowsByQuery } from "../tools/uiux/_rank";
import { buildDesignTokens } from "../tools/uiux/mapCSVToTokens";
// ─── Schemas ───────────────────────────────────────────────────────────
const designSystemInputSchema = z.object({
  workflowName: z.string(),
  platformType: z.string(),
  selectedOutcome: z.string().optional(),
  selectedEntities: z.string().optional(),
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  // Variety parameters — enable regeneration with different results
  userFeedback: z.string().optional().describe("User's style preference or rejection reason, appended to BM25 query for better matching"),
  excludeStyleNames: z.array(z.string()).optional().describe("Style names to exclude from results (e.g. previously rejected styles)"),
  excludeColorHexValues: z.array(z.string()).optional().describe("Previously used primary hex values to exclude (prevents same-colors-different-name syndrome)"),
});
const designSystemOutputSchema = z.object({
  designSystem: z.object({
    style: z.object({
      name: z.string(),
      type: z.string(),
      keywords: z.string().optional(),
      effects: z.string().optional(),
    }),
    colors: z.object({
      primary: z.string(),
      secondary: z.string(),
      accent: z.string(),
      success: z.string().optional(),
      warning: z.string().optional(),
      error: z.string().optional(),
      background: z.string(),
      text: z.string().optional(),
    }),
    typography: z.object({
      headingFont: z.string(),
      bodyFont: z.string(),
      scale: z.string().optional(),
    }),
    fonts: z.object({
      heading: z.string(),
      body: z.string(),
      googleFontsUrl: z.string().optional(),
      cssImport: z.string().optional(),
    }).optional(),
    charts: z.array(z.object({
      type: z.string(),
      bestFor: z.string(),
    })).optional(),
    uxGuidelines: z.array(z.string()).optional(),
    spacing: z.object({ unit: z.number() }).optional(),
    radius: z.number().optional(),
    shadow: z.string().optional(),
  }),
  reasoning: z.string(),
  skillActivated: z.boolean(),
});
// ─── Step 1: Gather Design Data (DETERMINISTIC — no LLM) ──────────────
const gatherDesignData = createStep({
  id: "gather-design-data",
  inputSchema: designSystemInputSchema,
  outputSchema: z.object({
    styleResults: z.array(z.record(z.string())),
    colorResults: z.array(z.record(z.string())),
    typographyResults: z.array(z.record(z.string())),
    chartResults: z.array(z.record(z.string())),
    uxResults: z.array(z.record(z.string())),
    productResults: z.array(z.record(z.string())),
    workflowName: z.string(),
    platformType: z.string(),
    selectedOutcome: z.string().optional(),
    selectedEntities: z.string().optional(),
    tenantId: z.string().uuid(),
    userId: z.string().uuid(),
    userFeedback: z.string().optional(),
    excludeStyleNames: z.array(z.string()).optional(),
    excludeColorHexValues: z.array(z.string()).optional(),
  }),
  execute: async ({ inputData }) => {
    // Build BM25 query: base context + user feedback for variety
    const queryParts = [
      inputData.workflowName,
      inputData.platformType,
      inputData.selectedOutcome,
    ];
    // Append user feedback to BM25 query for regeneration variety.
    // Keywords like "darker", "premium", "minimal" shift BM25 ranking
    // to surface different styles/colors than the initial generation.
    if (inputData.userFeedback) {
      queryParts.push(inputData.userFeedback);
    }
    const query = queryParts.filter(Boolean).join(" ");
    console.log(`[designSystemWorkflow:gather] BM25 query: "${query}"${inputData.excludeStyleNames?.length ? ` (excluding: ${inputData.excludeStyleNames.join(', ')})` : ''}`);
    // Load all CSVs
    const [styleRows, colorRows, typographyRows, chartRows, uxRows, productRows] =
      await Promise.all([
        loadUIUXCSV("style"),
        loadUIUXCSV("color"),
        loadUIUXCSV("typography"),
        loadUIUXCSV("chart"),
        loadUIUXCSV("ux"),
        loadUIUXCSV("product"),
      ]);
    const extraStyleLimit = inputData.excludeStyleNames?.length || 0;
    const extraColorLimit = inputData.excludeColorHexValues?.length || 0;
    // BM25 rank all domains in parallel
    // When excluding, fetch MORE results so we have enough after filtering
    const [rawStyleResults, rawColorResults, typographyResults, chartResults, uxResults, productResults] =
      await Promise.all([
        rankRowsByQuery({ rows: styleRows, query, limit: 3 + extraStyleLimit * 2, domain: 'style' }),
        rankRowsByQuery({ rows: colorRows, query, limit: 3 + extraColorLimit * 3, domain: 'color' }),
        rankRowsByQuery({ rows: typographyRows, query, limit: 3, domain: 'typography' }),
        rankRowsByQuery({ rows: chartRows, query, limit: 3, domain: 'chart' }),
        rankRowsByQuery({ rows: uxRows, query, limit: 5, domain: 'ux' }),
        rankRowsByQuery({ rows: productRows, query, limit: 2, domain: 'product' }),
      ]);
    // ── EXCLUSION: Filter out previously shown styles and colors ──────────────
    //
    // excludeStyleNames contains LLM-generated creative names ("Pipeline Velocity Pro")
    // which don't match any CSV column. Style rows can be filtered by "Style Category".
    //
    // For COLORS, we exclude by PRIMARY HEX VALUE, not by name.
    // inputData.excludeColorHexValues (new field) contains hex codes like "#E11D48"
    // that the user already saw. This prevents "same colors, different name" syndrome.
    const excludeNameSet = new Set((inputData.excludeStyleNames || []).map((n: string) => n.toLowerCase()));
    const excludeHexSet = new Set((inputData.excludeColorHexValues || []).map((h: string) => h.toUpperCase()));

    const styleResults = excludeNameSet.size > 0
      ? rawStyleResults.filter((r: Record<string, string>) =>
          !excludeNameSet.has((r["Style Category"] || "").toLowerCase())
        ).slice(0, 3)
      : rawStyleResults.slice(0, 3);

    // Color exclusion: filter by ACTUAL primary hex value, not by name
    const colorResults = excludeHexSet.size > 0
      ? rawColorResults.filter((r: Record<string, string>) =>
          !excludeHexSet.has((r["Primary (Hex)"] || "").toUpperCase())
        ).slice(0, 3)
      : rawColorResults.slice(0, 3);

    // SAFETY: If exclusion filtered out everything, fall back to unfiltered + offset
    // This handles the edge case where the user rejected all top-ranked colors
    const finalColorResults = colorResults.length > 0
      ? colorResults
      : rawColorResults.slice(excludeHexSet.size, excludeHexSet.size + 3);

    console.log(`[designSystemWorkflow:gather] Results: style=${styleResults.length}, color=${finalColorResults.length}, typography=${typographyResults.length}, chart=${chartResults.length}, ux=${uxResults.length}, product=${productResults.length}`);
    return {
      styleResults,
      colorResults: finalColorResults,
      typographyResults,
      chartResults,
      uxResults,
      productResults,
      workflowName: inputData.workflowName,
      platformType: inputData.platformType,
      selectedOutcome: inputData.selectedOutcome,
      selectedEntities: inputData.selectedEntities,
      tenantId: inputData.tenantId,
      userId: inputData.userId,
      userFeedback: inputData.userFeedback,
      excludeStyleNames: inputData.excludeStyleNames,
      excludeColorHexValues: inputData.excludeColorHexValues,
    };
  },
});
// ─── Step 2: Synthesize (LLM selects from CSV data — no tool calls) ──
const synthesizeDesignSystem = createStep({
  id: "synthesize-design-system",
  inputSchema: z.object({
    styleResults: z.array(z.record(z.string())),
    colorResults: z.array(z.record(z.string())),
    typographyResults: z.array(z.record(z.string())),
    chartResults: z.array(z.record(z.string())),
    uxResults: z.array(z.record(z.string())),
    productResults: z.array(z.record(z.string())),
    workflowName: z.string(),
    platformType: z.string(),
    selectedOutcome: z.string().optional(),
    selectedEntities: z.string().optional(),
    tenantId: z.string().uuid(),
    userId: z.string().uuid(),
    userFeedback: z.string().optional(),
    excludeStyleNames: z.array(z.string()).optional(),
    excludeColorHexValues: z.array(z.string()).optional(),
  }),
  outputSchema: designSystemOutputSchema,
  execute: async ({ inputData, mastra }) => {
    const {
      styleResults, colorResults, typographyResults, chartResults,
      uxResults, productResults, workflowName, platformType,
    } = inputData;
    // Build deterministic tokens from top CSV results first
    const topColor = colorResults[0] || {};
    const topTypography = typographyResults[0] || {};
    const topStyle = styleResults[0] || {};
    const deterministicTokens = buildDesignTokens({
      colorRow: topColor,
      typographyRow: topTypography,
      styleRow: topStyle,
    });
    // Use LLM ONLY for synthesis: pick best combination and give it a custom name.
    // toolChoice: "none" and maxSteps: 1 = no tool calls possible.
    const agent = mastra?.getAgent("designAdvisorAgent");
    if (!agent) {
      console.warn("[designSystemWorkflow:synthesize] No agent — using deterministic tokens only");
      return {
        designSystem: {
          style: deterministicTokens.style,
          colors: deterministicTokens.colors,
          typography: {
            headingFont: deterministicTokens.fonts.heading,
            bodyFont: deterministicTokens.fonts.body,
            scale: "1.25",
          },
          fonts: deterministicTokens.fonts,
          charts: chartResults.slice(0, 3).map(r => ({
            type: r["Best Chart Type"] || r["Chart Type"] || r.type || "Bar Chart",
            bestFor: r["Data Type"] || r["Best For"] || r.bestFor || "Comparisons",
          })),
          uxGuidelines: uxResults.slice(0, 5).map(r =>
            r["Guideline"] || r["Description"] || r.guideline || "Follow best practices"
          ),
          spacing: deterministicTokens.spacing,
          radius: deterministicTokens.radius,
          shadow: deterministicTokens.shadow,
        },
        reasoning: `Deterministic selection from BM25 results for "${workflowName}" (${platformType}).`,
        skillActivated: true,
      };
    }
    // Build context-aware prompt with variety hints
    const userFeedbackSection = inputData.userFeedback
      ? [
          ``,
          `## USER PREFERENCE (IMPORTANT — prioritize this)`,
          `The user said: "${inputData.userFeedback}"`,
          `Select options that match this preference. If they asked for "darker", pick dark palettes. If "minimal", pick clean styles.`,
        ]
      : [];
    const exclusionSection = inputData.excludeStyleNames?.length
      ? [
          ``,
          `## EXCLUDED (already rejected by user — do NOT pick these)`,
          ...inputData.excludeStyleNames.map(n => `- "${n}"`),
          `Pick something DIFFERENT from the excluded items.`,
        ]
      : [];
    // Debug: Log actual chart CSV column names so we can fix mappings
    if (chartResults.length > 0) {
      console.log('[designSystemWorkflow:synthesize] Chart CSV columns:', Object.keys(chartResults[0]));
      console.log('[designSystemWorkflow:synthesize] First chart row:', JSON.stringify(chartResults[0]).substring(0, 200));
    }

    const prompt = [
      `You are selecting the BEST design system for a "${workflowName}" dashboard (${platformType}).`,
      ...userFeedbackSection,
      ...exclusionSection,
      ``,
      `## AVAILABLE DATA FROM CSV SEARCH (use ONLY these values)`,
      ``,
      `### Styles (${styleResults.length} matches):`,
      ...styleResults.map((r, i) => `${i + 1}. ${r["Style Category"] || "Unknown"} — Type: ${r["Type"] || "?"}, Keywords: ${r["Keywords"] || "?"}, Colors: ${r["Primary Colors"] || "?"}`),
      ``,
      `### Color Palettes (${colorResults.length} matches):`,
      ...colorResults.map((r, i) => `${i + 1}. ${r["Product Type"] || "Custom"} — Primary: ${r["Primary (Hex)"] || "?"}, Secondary: ${r["Secondary (Hex)"] || "?"}, Accent/CTA: ${r["CTA (Hex)"] || "?"}, Background: ${r["Background (Hex)"] || "auto"}, Mood: ${r["Notes"] || "?"}`),
      ``,
      `### Typography (${typographyResults.length} matches):`,
      ...typographyResults.map((r, i) => `${i + 1}. ${r["Font Pairing Name"] || "Unknown"} — Heading: ${r["Heading Font"]}, Body: ${r["Body Font"]}, Mood: ${r["Mood/Style Keywords"]}, URL: ${r["Google Fonts URL"] || "none"}`),
      ``,
      `### Chart Types (${chartResults.length} matches):`,
      ...chartResults.map((r, i) => {
        const chartType = r["Best Chart Type"] || r["Chart Type"] || r["chart_type"] || r["Type"] || r["name"] || r["Name"] || "Unknown";
        const bestFor = r["Data Type"] || r["Best For"] || r["best_for"] || r["Description"] || r["description"] || r["Use Case"] || "General";
        return `${i + 1}. ${chartType} — Best for: ${bestFor}`;
      }),
      ``,
      `## YOUR TASK`,
      `1. Pick the BEST color palette from the options above (use exact hex values).`,
      `2. Pick the BEST typography pairing from the options above (use exact font names).`,
      `3. Give this design system a UNIQUE, CREATIVE name that reflects the workflow context.`,
      `   Examples: "Midnight Legal Suite", "Warm Lead Tracker", "Neon Voice Command Center"`,
      `   Do NOT use generic names like "Modern SaaS" or "Professional Clean".`,
      `4. Select 2-3 chart types from above.`,
      ``,
      `## OUTPUT (JSON only, no markdown)`,
      `Return ONLY a JSON object with this structure:`,
      `{`,
      `  "selectedColorIndex": 0,`,
      `  "selectedTypographyIndex": 0,`,
      `  "customStyleName": "Your Creative Name Here",`,
      `  "selectedCharts": [{"type": "chart type from the Charts list above", "bestFor": "what this chart is best for"}], // Pick 2-3 chart types that best fit this workflow`,
      `  "reasoning": "Why these choices work for this workflow"`,
      `}`,
    ].join("\n");
    try {
      const result = await agent.generate(prompt, {
        maxSteps: 1,
        toolChoice: "none",
      });
      const text = result.text || "";
      const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)?.[1] || text.match(/\{[\s\S]*\}/)?.[0];
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch);
        const colorIdx = Math.min(parsed.selectedColorIndex ?? 0, colorResults.length - 1);
        const typoIdx = Math.min(parsed.selectedTypographyIndex ?? 0, typographyResults.length - 1);
        const selectedColor = colorResults[Math.max(0, colorIdx)] || topColor;
        const selectedTypo = typographyResults[Math.max(0, typoIdx)] || topTypography;
        const tokens = buildDesignTokens({
          colorRow: selectedColor,
          typographyRow: selectedTypo,
          styleRow: topStyle,
          customName: parsed.customStyleName || deterministicTokens.style.name,
        });
        console.log(`[designSystemWorkflow:synthesize] LLM selected: "${tokens.style.name}", primary: ${tokens.colors.primary}`);
        return {
          designSystem: {
            style: tokens.style,
            colors: tokens.colors,
            typography: {
              headingFont: tokens.fonts.heading,
              bodyFont: tokens.fonts.body,
              scale: "1.25",
            },
            fonts: tokens.fonts,
            charts: parsed.selectedCharts || chartResults.slice(0, 3).map(r => ({
              type: r["Best Chart Type"] || r["Chart Type"] || r["chart_type"] || r["Type"] || r["name"] || r["Name"] || "Bar Chart",
              bestFor: r["Data Type"] || r["Best For"] || r["best_for"] || r["Description"] || r["description"] || r["Use Case"] || r["use_case"] || "General visualization",
            })),
            uxGuidelines: uxResults.slice(0, 5).map(r =>
              r["Guideline"] || r["Description"] || r.guideline || "Follow best practices"
            ),
            spacing: tokens.spacing,
            radius: tokens.radius,
            shadow: tokens.shadow,
          },
          reasoning: parsed.reasoning || `Selected from CSV data for "${workflowName}".`,
          skillActivated: true,
        };
      }
    } catch (err) {
      console.warn("[designSystemWorkflow:synthesize] LLM synthesis failed, using deterministic:", err);
    }
    // Fallback: use deterministic tokens from top results
    return {
      designSystem: {
        style: deterministicTokens.style,
        colors: deterministicTokens.colors,
        typography: {
          headingFont: deterministicTokens.fonts.heading,
          bodyFont: deterministicTokens.fonts.body,
          scale: "1.25",
        },
        fonts: deterministicTokens.fonts,
        charts: chartResults.slice(0, 3).map(r => ({
          type: r["Best Chart Type"] || r["Chart Type"] || r["chart_type"] || r["Type"] || r["name"] || r["Name"] || r.type || "Bar Chart",
          bestFor: r["Data Type"] || r["Best For"] || r["best_for"] || r["Description"] || r["description"] || r["Use Case"] || r["use_case"] || r.bestFor || "General visualization",
        })),
        uxGuidelines: uxResults.slice(0, 5).map(r =>
          r["Guideline"] || r["Description"] || r.guideline || "Follow best practices"
        ),
        spacing: deterministicTokens.spacing,
        radius: deterministicTokens.radius,
        shadow: deterministicTokens.shadow,
      },
      reasoning: `Deterministic fallback from BM25 results for "${workflowName}".`,
      skillActivated: true,
    };
  },
});
// ─── Workflow ──────────────────────────────────────────────────────────
export const designSystemWorkflow = createWorkflow({
  id: "designSystemWorkflow",
  inputSchema: designSystemInputSchema,
  outputSchema: designSystemOutputSchema,
})
  .then(gatherDesignData)
  .then(synthesizeDesignSystem)
  .commit();
