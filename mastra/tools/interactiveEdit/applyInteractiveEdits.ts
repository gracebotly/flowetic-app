

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getCurrentSpec, applySpecPatch, savePreviewVersion } from "@/mastra/tools/specEditor";
import { validateSpec } from "@/mastra/tools/validateSpec";
import { EditAction, DensityPreset } from "./types";
import { reorderComponents } from "./reorderComponents";

function densityToSpacingBase(d: z.infer<typeof DensityPreset>) {
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
    const current = await getCurrentSpec.execute(
      { interfaceId: inputData.interfaceId },
      { requestContext: context?.requestContext },
    );

    if (typeof current === "object" && current !== null && "error" in current && (current as any).error) {
      throw new Error((current as any).message ?? "getCurrentSpec failed");
    }

    let nextSpec = current.spec_json ?? {};
    let nextTokens = current.design_tokens ?? {};

    const reorderAction = inputData.actions.find((a) => a.type === "reorder_widgets") as any;
    if (reorderAction?.orderedIds?.length) {
      const reordered = await reorderComponents.execute(
        { spec_json: nextSpec, orderedIds: reorderAction.orderedIds },
        { requestContext: context?.requestContext },
      );

      if (typeof reordered === "object" && reordered !== null && "error" in reordered && (reordered as any).error) {
        throw new Error((reordered as any).message ?? "reorderComponents failed");
      }

      nextSpec = (reordered as any).spec_json;
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
      const patched = await applySpecPatch.execute(
        { spec_json: nextSpec, design_tokens: nextTokens, operations: ops },
        { requestContext: context?.requestContext },
      );

      if (typeof patched === "object" && patched !== null && "error" in patched && (patched as any).error) {
        throw new Error((patched as any).message ?? "applySpecPatch failed");
      }

      nextSpec = (patched as any).spec_json;
      nextTokens = (patched as any).design_tokens;
    }

    const validation = await validateSpec.execute(
      { spec_json: nextSpec },
      { requestContext: context?.requestContext },
    );

    if (typeof validation === "object" && validation !== null && "error" in validation && (validation as any).error) {
      throw new Error((validation as any).message ?? "validateSpec failed");
    }

    if (!validation.valid || validation.score < 0.8) throw new Error("INTERACTIVE_EDIT_VALIDATION_FAILED");

    const saved = await savePreviewVersion.execute(
      {
        tenantId: inputData.tenantId,
        userId: inputData.userId,
        interfaceId: inputData.interfaceId,
        spec_json: nextSpec,
        design_tokens: nextTokens,
        platformType: inputData.platformType,
      },
      { requestContext: context?.requestContext },
    );

    if (typeof saved === "object" && saved !== null && "error" in saved && (saved as any).error) {
      throw new Error((saved as any).message ?? "savePreviewVersion failed");
    }

    return { previewUrl: saved.previewUrl, previewVersionId: saved.versionId };
  },
});

