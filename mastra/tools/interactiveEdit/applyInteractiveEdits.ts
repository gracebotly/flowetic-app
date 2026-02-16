

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import type { EditAction } from "./types";
import { InterfaceContextSchema } from "../../lib/REQUEST_CONTEXT_CONTRACT";

const densityToSpacingBase = (density: "compact" | "normal" | "relaxed") => {
  switch (density) {
    case "compact":
      return 4;
    case "normal":
      return 8;
    case "relaxed":
      return 12;
  }
};

export const applyInteractiveEdits = createTool({
  id: "applyInteractiveEdits",
  description: "Applies interactive edits to dashboard spec and saves preview version",
  requestContextSchema: InterfaceContextSchema,
  inputSchema: z.object({
    actions: z.array(
      z.object({
        type: z.enum(["toggle_widget", "rename_widget", "switch_chart_type", "set_density"]),
        widgetId: z.string().optional(),
        title: z.string().optional(),
        chartType: z.enum(["bar", "line", "pie", "area", "scatter"]).optional(),
        density: z.enum(["compact", "normal", "relaxed"]).optional(),
      })
    ).describe("The edit actions to apply"),
  }),
  outputSchema: z.object({
    previewUrl: z.string().url(),
    previewVersionId: z.string().uuid(),
  }),
  execute: async (inputData, context) => {
    const { actions } = inputData;
    // Read from validated RequestContext (Mastra validates via requestContextSchema before execute)
    const { tenantId, userId, supabaseAccessToken, interfaceId, platformType } =
      context?.requestContext?.all ?? {};

    if (!interfaceId) {
      throw new Error(
        '[applyInteractiveEdits] No interfaceId in RequestContext. ' +
        'Cannot apply edits without a target interface.'
      );
    }

    const { getCurrentSpec, applySpecPatch, savePreviewVersion } = await import("@/mastra/tools/specEditor");
    const { validateSpec } = await import("@/mastra/tools/validateSpec");

    // Call getCurrentSpec directly (no destructuring needed)
    const current = await getCurrentSpec.execute!({ interfaceId }, context as any);

    if (current instanceof Error) {
      throw current;
    }

    let nextSpec = (current as any).spec_json ?? {};
    let nextTokens = (current as any).design_tokens ?? {};

    // Note: reorder functionality removed due to non-existent import
    // const reorderAction = actions.find((a) => a.type === "reorder_widgets") as any;
    // if (reorderAction?.orderedIds?.length) {
    //   Future implementation needed for component reordering
    // }

    const ops: any[] = [];
    for (const a of actions) {
      if (a.type === "toggle_widget") {
        ops.push({
          op: "updateComponentProps",
          componentId: a.widgetId,
          propsPatch: { hidden: true }, // Just set hidden, don't toggle
        });
      } else if (a.type === "rename_widget") {
        ops.push({
          op: "updateComponentProps",
          componentId: a.widgetId,
          propsPatch: { title: a.title },
        });
      } else if (a.type === "switch_chart_type") {
        ops.push({
          op: "updateComponentProps",
          componentId: a.widgetId,
          propsPatch: { chartType: a.chartType },
        });
      } else if (a.type === "set_density") {
        ops.push({
          op: "setDesignToken",
          tokenPath: "theme.spacing.base",
          tokenValue: a.density ? densityToSpacingBase(a.density) : 8, // Default to 8
        });
      }
    }

    if (ops.length) {
      const patched = await applySpecPatch.execute!(
        { spec_json: nextSpec, design_tokens: nextTokens, operations: ops },
        context
      );

      if (patched instanceof Error) {
        throw patched;
      }

      nextSpec = (patched as any).spec_json;
      nextTokens = (patched as any).design_tokens;
    }

    const validation = await validateSpec.execute!({ spec_json: nextSpec }, context);

    if (validation instanceof Error) {
      throw validation;
    }

    const validResult = validation as any;
    if (!validResult.valid || validResult.score < 0.8) {
      throw new Error("Validation score below threshold");
    }

    const saved = await savePreviewVersion.execute!({ spec_json: nextSpec, design_tokens: nextTokens }, context);

    if (saved instanceof Error) {
      throw saved;
    }

    const savedResult = saved as any;
    return { previewUrl: savedResult.previewUrl, previewVersionId: savedResult.versionId };
  },
});

