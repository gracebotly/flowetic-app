

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import type { EditAction } from "./types";
import { InterfaceContextSchema } from "../../lib/REQUEST_CONTEXT_CONTRACT";
import { normalizeSpec } from "../../lib/spec/uiSpecSchema";

const densityToSpacingBase = (density: string): number => {
  switch (density) {
    case "compact":
      return 4;
    case "comfortable":
    case "normal":  // Legacy support
      return 8;
    case "spacious":
    case "relaxed":  // Legacy support
      return 12;
    default:
      return 8;
  }
};

export const applyInteractiveEdits = createTool({
  id: "applyInteractiveEdits",
  description: "Applies interactive edits to dashboard spec and saves preview version",
  requestContextSchema: InterfaceContextSchema,
  inputSchema: z.object({
    actions: z.array(
      z.object({
        type: z.enum([
          "toggle_widget",
          "rename_widget",
          "switch_chart_type",
          "set_density",
          "set_palette",
          "reorder_widgets",
        ]),
        widgetId: z.string().optional(),
        title: z.string().optional(),
        chartType: z.enum(["bar", "line", "area", "pie", "donut"]).optional(),
        density: z.enum(["compact", "comfortable", "spacious"]).optional(),
        paletteId: z.string().optional(),
        order: z.array(z.string()).optional(),
      })
    ).describe("The edit actions to apply"),
  }),
  outputSchema: z.object({
    previewUrl: z.string().url(),
    previewVersionId: z.string().uuid(),
  }),
  execute: async (inputData, context) => {
    const { actions } = inputData;
    const { tenantId, userId, interfaceId, platformType } =
      (context as any)?.requestContext?.all ?? {};
    if (!tenantId || !userId) {
      throw new Error("[applyInteractiveEdits] Missing tenantId or userId in RequestContext");
    }

    const { getCurrentSpec, applySpecPatch, savePreviewVersion } = await import("@/mastra/tools/specEditor");
    const { validateSpec } = await import("@/mastra/tools/validateSpec");

    // Call getCurrentSpec directly (no destructuring needed)
    const current = await getCurrentSpec.execute!({ interfaceId }, context as any);

    if (current instanceof Error) {
      throw current;
    }

    // Phase 2: Normalize spec from DB before applying interactive edits
    let nextSpec = normalizeSpec((current as any).spec_json ?? {}) as Record<string, any>;
    let nextTokens = (current as any).design_tokens ?? {};

    // ── Process reorder FIRST (before patch ops) ────────────────
    // Reorder changes component array order in spec directly,
    // not via patch operations.
    const reorderAction = actions.find((a) => a.type === "reorder_widgets");
    if (reorderAction?.order?.length && Array.isArray(nextSpec.components)) {
      const orderedIds = reorderAction.order;
      const componentMap = new Map<string, any>();
      for (const comp of nextSpec.components) {
        if (comp?.id) componentMap.set(comp.id, comp);
      }

      // Build reordered array: known IDs first in specified order,
      // then any remaining components not in the order list
      const reordered: any[] = [];
      for (const id of orderedIds) {
        const comp = componentMap.get(id);
        if (comp) {
          reordered.push(comp);
          componentMap.delete(id);
        }
      }
      // Append remaining components not in the reorder list
      for (const comp of componentMap.values()) {
        reordered.push(comp);
      }

      // Reassign grid positions based on new order
      // Each component gets sequential row positions
      let currentRow = 0;
      for (const comp of reordered) {
        if (comp.layout) {
          comp.layout = {
            ...comp.layout,
            row: currentRow,
            col: comp.layout.col ?? 0,
          };
          currentRow += comp.layout.h ?? 2;
        }
      }

      nextSpec.components = reordered;
    }

    // ── Build patch operations for all other actions ────────────
    const ops: any[] = [];
    for (const a of actions) {
      if (a.type === "reorder_widgets") {
        // Already handled above
        continue;
      }

      if (a.type === "toggle_widget") {
        // FIX: Actually toggle — read current hidden state and flip it
        const comp = Array.isArray(nextSpec.components)
          ? nextSpec.components.find((c: any) => c?.id === a.widgetId)
          : undefined;
        const currentlyHidden = comp?.props?.hidden === true;
        ops.push({
          op: "updateComponentProps",
          componentId: a.widgetId,
          propsPatch: { hidden: !currentlyHidden },
        });
        continue;
      }

      if (a.type === "rename_widget") {
        ops.push({
          op: "updateComponentProps",
          componentId: a.widgetId,
          propsPatch: { title: a.title },
        });
        continue;
      }

      if (a.type === "switch_chart_type") {
        ops.push({
          op: "updateComponentProps",
          componentId: a.widgetId,
          propsPatch: { chartType: a.chartType },
        });
        continue;
      }

      if (a.type === "set_density") {
        ops.push({
          op: "setDesignToken",
          tokenPath: "theme.spacing.base",
          tokenValue: a.density ? densityToSpacingBase(a.density) : 8,
        });
        continue;
      }

      if (a.type === "set_palette") {
        // Palette changes are handled by design tokens
        // The paletteId maps to colors in the frontend palettes array
        // For now, just store the palette selection as a token
        if (a.paletteId) {
          ops.push({
            op: "setDesignToken",
            tokenPath: "theme.activePaletteId",
            tokenValue: a.paletteId,
          });
        }
        continue;
      }
    }

    if (ops.length) {
      const patched = await applySpecPatch.execute!(
        { spec_json: nextSpec, design_tokens: nextTokens, operations: ops },
        context as any
      );

      if (patched instanceof Error) {
        throw patched;
      }

      nextSpec = (patched as any).spec_json;
      nextTokens = (patched as any).design_tokens;
    }

    const validation = await validateSpec.execute!({ spec_json: nextSpec }, context as any);

    if (validation instanceof Error) {
      throw validation;
    }

    const validResult = validation as any;
    if (!validResult.valid || validResult.score < 0.8) {
      throw new Error("Validation score below threshold");
    }

    const saved = await savePreviewVersion.execute!({ spec_json: nextSpec, design_tokens: nextTokens }, context as any);

    if (saved instanceof Error) {
      throw saved;
    }

    const savedResult = saved as any;
    return { previewUrl: savedResult.previewUrl, previewVersionId: savedResult.versionId };
  },
});

