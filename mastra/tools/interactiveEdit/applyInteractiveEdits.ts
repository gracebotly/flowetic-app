

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import type { EditAction } from "./types";
import { DensityPresetSchema } from "./types";
import { reorderComponents } from "./reorderComponents";

function densityToSpacingBase(d: z.infer<typeof DensityPresetSchema>) {
  if (d === "compact") return 8;
  if (d === "spacious") return 14;
  return 10;
}

export const applyInteractiveEdits = createTool({
  id: "interactive.applyEdits",
  description:
    "Apply interactive edit actions (toggle/rename/switch chart type + density) to current preview spec and persist a new preview version.",
  inputSchema: z.object({
    tenantId: z.string().uuid(),
    userId: z.string().uuid(),
    interfaceId: z.string().uuid(),
    platformType: z.string().min(1),
    actions: z.array(EditAction).min(1).max(30),
  }),
  outputSchema: z.object({
    previewUrl: z.string().url(),
    previewVersionId: z.string().uuid(),
  }),
  execute: async (inputData, context) => {
    // FIXED: Correct parameter destructuring - use inputData, not { context, runtimeContext }
    const { tenantId, userId, interfaceId, platformType, actions } = inputData;

    // Import tools at the top level inside execute
    const { getCurrentSpec, applySpecPatch, savePreviewVersion } = await import("@/mastra/tools/specEditor");
    const { validateSpec } = await import("@/mastra/tools/validateSpec");

    const current = await getCurrentSpec.execute(
      { tenantId, interfaceId },  // FIXED: Pass parameters directly, not wrapped in context
      context
    );

    let nextSpec = current.spec_json ?? {};
    let nextTokens = current.design_tokens ?? {};

    const reorderAction = actions.find((a) => a.type === "reorder_widgets") as any;
    if (reorderAction?.orderedIds?.length) {
      const reordered = await reorderComponents.execute(
        { spec_json: nextSpec, orderedIds: reorderAction.orderedIds },  // FIXED: Direct parameters
        context
      );
      nextSpec = reordered.spec_json;
    }

    const ops: any[] = [];
    for (const a of actions) {
      if (a.type === "toggle_widget") {
        ops.push({
          op: "updateComponentProps",
          componentId: a.widgetId,
          propsPatch: { hidden: !a.enabled },
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
          tokenValue: densityToSpacingBase(a.density),
        });
      }
    }

    if (ops.length) {
      const patched = await applySpecPatch.execute(
        { spec_json: nextSpec, design_tokens: nextTokens, operations: ops },  // FIXED: Direct parameters
        context
      );
      nextSpec = patched.spec_json;
      nextTokens = patched.design_tokens;
    }

    const validation = await validateSpec.execute(
      { spec_json: nextSpec },  // FIXED: Direct parameters
      context
    );

    if (!validation.valid || validation.score < 0.8) throw new Error("INTERACTIVE_EDIT_VALIDATION_FAILED");

    const saved = await savePreviewVersion.execute(
      {
        tenantId,
        userId,
        interfaceId,
        spec_json: nextSpec,
        design_tokens: nextTokens,
        platformType,
      },  // FIXED: All parameters flat
      context
    );

    return { previewUrl: saved.previewUrl, previewVersionId: saved.versionId };
  },
});

