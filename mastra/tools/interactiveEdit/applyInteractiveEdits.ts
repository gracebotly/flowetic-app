

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getCurrentSpec, applySpecPatch, savePreviewVersion } from "@/mastra/tools/specEditor";
import { validateSpec } from "@/mastra/tools/validateSpec";
import { EditActionSchema, EditAction, DensityPreset } from "./types";
import { reorderComponents } from "./reorderComponents";
import { callTool } from "../../lib/callTool";

function densityToSpacingBase(d: DensityPreset) {
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
    actions: z.array(EditActionSchema).min(1).max(30),
  }),
  outputSchema: z.object({
    previewUrl: z.string().url(),
    previewVersionId: z.string().uuid(),
  }),
  execute: async (inputData: any, context: any) => {
    const current = await callTool(
      getCurrentSpec,
      { interfaceId: inputData.interfaceId },
      { requestContext: context?.requestContext ?? context ?? {} },
    );

    let nextSpec = current.spec_json ?? {};
    let nextTokens = current.design_tokens ?? {};

    const reorderAction = inputData.actions.find((a: any) => a.type === "reorder_widgets") as any;
    if (reorderAction?.orderedIds?.length) {
      const reordered = await callTool(
        reorderComponents,
        { spec_json: nextSpec, orderedIds: reorderAction.orderedIds },
        { requestContext: context?.requestContext ?? context ?? {} },
      );

      nextSpec = reordered.spec_json;
    }

    const ops: any[] = [];

    for (const a of inputData.actions) {
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
      const patched = await callTool(
        applySpecPatch,
        { spec_json: nextSpec, design_tokens: nextTokens, operations: ops },
        { requestContext: context?.requestContext ?? context ?? {} },
      );

      nextSpec = patched.spec_json;
      nextTokens = patched.design_tokens;
    }

    const validation = await callTool(
      validateSpec,
      { spec_json: nextSpec },
      { requestContext: context?.requestContext ?? context ?? {} },
    );

    if (!validation.valid || validation.score < 0.8) throw new Error("INTERACTIVE_EDIT_VALIDATION_FAILED");

    const saved = await callTool(
      savePreviewVersion,
      {
        tenantId: inputData.tenantId,
        userId: inputData.userId,
        interfaceId: inputData.interfaceId,
        spec_json: nextSpec,
        design_tokens: nextTokens,
        platformType: inputData.platformType,
      },
      { requestContext: context?.requestContext ?? context ?? {} },
    );

    return { previewUrl: saved.previewUrl, previewVersionId: saved.versionId };
  },
});

