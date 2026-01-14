

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getCurrentSpec, applySpecPatch, savePreviewVersion } from "@/mastra/tools/specEditor";
import { validateSpec } from "@/mastra/tools/validateSpec";
import { EditAction, DensityPreset, ChartType } from "./types";
import { reorderComponents } from "./reorderComponents";

function densityToSpacingBase(d: z.infer<typeof DensityPreset>) {
  if (d === "compact") return 8;
  if (d === "spacious") return 14;
  return 10;
}

function chartTypeToPropsPatch(chartType: z.infer<typeof ChartType>) {
  // Map to your registry renderer chart variants:
  // - TimeseriesChart uses AreaChart in renderer.tsx
  // - BarChart uses TremorBar
  // For MVP, store a generic prop `chartType` on chart components.
  // The renderer/spec should interpret it later.
  return { chartType };
}

export const applyInteractiveEdits = createTool({
  id: "interactive.applyEdits",
  description:
    "Apply interactive edit actions (toggle/rename/switch chart type + density + palette) to the current preview spec, validate, and persist a new preview version. Reorder is handled by a dedicated tool.",
  inputSchema: z.object({
    tenantId: z.string().uuid(),
    userId: z.string().uuid(),
    interfaceId: z.string().uuid(),
    platformType: z.string().min(1),
    actions: z.array(EditAction).min(1).max(30),
  }),
  outputSchema: z.object({
    previewUrl: z.string().url(),
    previewVersionId: z.string().uuid().optional(),
  }),
  execute: async ({ context, runtimeContext }) => {
    // Load current spec
    const current = await getCurrentSpec.execute(
      { context: { tenantId: context.tenantId, interfaceId: context.interfaceId }, runtimeContext } as any
    );

    const spec_json = current.spec_json ?? {};
    const design_tokens = current.design_tokens ?? {};

    // Handle reorder separately (applySpecPatch does NOT support reorder)
    const reorderAction = context.actions.find((a) => a.type === "reorder_widgets") as
      | Extract<z.infer<typeof EditAction>, { type: "reorder_widgets" }>
      | undefined;

    let nextSpec = spec_json;
    let nextTokens = design_tokens;

    if (reorderAction) {
      const reordered = await reorderComponents.execute(
        {
          context: {
            spec_json: nextSpec,
            orderedIds: reorderAction.orderedIds,
          },
          runtimeContext,
        } as any
      );

      nextSpec = reordered.spec_json;
    }

    // Build patch ops for applySpecPatch
    const ops: Array<{
      op: "setDesignToken" | "updateComponentProps";
      componentId?: string;
      propsPatch?: Record<string, any>;
      tokenPath?: string;
      tokenValue?: any;
    }> = [];

    for (const a of context.actions) {
      if (a.type === "toggle_widget") {
        ops.push({
          op: "updateComponentProps",
          componentId: a.widgetId,
          propsPatch: { hidden: !a.enabled },
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
          propsPatch: chartTypeToPropsPatch(a.chartType),
        });
        continue;
      }

      if (a.type === "set_density") {
        ops.push({
          op: "setDesignToken",
          tokenPath: "theme.spacing.base",
          tokenValue: densityToSpacingBase(a.density),
        });
        continue;
      }

      // Palette is translated to setDesignToken ops by the router (keeps this tool deterministic).
      if (a.type === "set_palette") {
        continue;
      }

      if (a.type === "reorder_widgets") {
        continue;
      }
    }

    // Apply patch ops if present
    if (ops.length > 0) {
      const patched = await applySpecPatch.execute(
        {
          context: {
            spec_json: nextSpec,
            design_tokens: nextTokens,
            operations: ops as any,
          },
          runtimeContext,
        } as any
      );

      nextSpec = patched.spec_json;
      nextTokens = patched.design_tokens;
    }

    const validation = await validateSpec.execute(
      { context: { spec_json: nextSpec }, runtimeContext } as any
    );

    if (!validation.valid || validation.score < 0.8) {
      throw new Error("INTERACTIVE_EDIT_VALIDATION_FAILED");
    }

    const saved = await savePreviewVersion.execute(
      {
        context: {
          tenantId: context.tenantId,
          userId: context.userId,
          interfaceId: context.interfaceId,
          spec_json: nextSpec,
          design_tokens: nextTokens,
          platformType: context.platformType,
        },
        runtimeContext,
      } as any
    );

    return { previewUrl: saved.previewUrl, previewVersionId: saved.versionId };
  },
});

