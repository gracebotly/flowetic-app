

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import type { EditAction } from "./types";

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
  inputSchema: z.object({
    tenantId: z.string().uuid().describe("The tenant ID"),
    userId: z.string().uuid().describe("The user ID"),
    interfaceId: z.string().uuid().describe("The interface ID"),
    platformType: z.string().default("make").describe("The platform type"),
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
    const { tenantId, userId, interfaceId, platformType, actions } = inputData;

    const { getCurrentSpec, applySpecPatch, savePreviewVersion } = await import("@/mastra/tools/specEditor");
    const { validateSpec } = await import("@/mastra/tools/validateSpec");

    // Call getCurrentSpec directly (no destructuring needed)
    const current = await getCurrentSpec.execute(
      { interfaceId },
      context
    );

    if (current.__type === 'ValidationError') {
      throw new Error(`Failed to get current spec: ${current.message}`);
    }

    let nextSpec = current.spec_json ?? {};
    let nextTokens = current.design_tokens ?? {};

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
        context
      );

      if (patched.__type === 'ValidationError') {
        throw new Error(`Failed to apply patch: ${patched.message}`);
      }

      nextSpec = patched.spec_json;
      nextTokens = patched.design_tokens;
    }

    const validation = await validateSpec.execute(
      { spec_json: nextSpec },
      context
    );

    if (validation.__type === 'ValidationError') {
      throw new Error("Validation failed");
    }

    if (!validation.valid || validation.score < 0.8) {
      throw new Error("Validation score below threshold");
    }

    const saved = await savePreviewVersion.execute(
      {
        tenantId,
        userId,
        interfaceId,
        spec_json: nextSpec,
        design_tokens: nextTokens,
        platformType,
      },
      context
    );

    if (saved.__type === 'ValidationError') {
      throw new Error(`Failed to save: ${saved.message}`);
    }

    return { previewUrl: saved.previewUrl, previewVersionId: saved.versionId };
  },
});

