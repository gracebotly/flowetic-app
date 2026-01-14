

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getCurrentSpec, applySpecPatch, savePreviewVersion } from "@/mastra/tools/specEditor";
import { validateSpec } from "@/mastra/tools/validateSpec";
import { EditAction, DensityPreset } from "./types";

function densityToSpacingBase(d: z.infer<typeof DensityPreset>) {
  if (d === "compact") return 8;
  if (d === "spacious") return 14;
  return 10;
}

export const applyInteractiveEdits = createTool({
  id: "interactive.applyEdits",
  description:
    "Apply interactive edit actions (toggle/reorder/rename/switch chart type + palette + density) to the current preview spec, validate, and persist a new preview version.",
  inputSchema: z.object({
    tenantId: z.string().uuid(),
    userId: z.string().uuid(),
    interfaceId: z.string().uuid(),
    platformType: z.string().min(1),
    actions: z.array(z.any()).min(1).max(30),
  }),
  outputSchema: z.object({
    previewUrl: z.string().url(),
    previewVersionId: z.string().uuid().optional(),
  }),
  execute: async ({ context, runtimeContext }) => {
    const current = await getCurrentSpec.execute(
      { context: { tenantId: context.tenantId, interfaceId: context.interfaceId }, runtimeContext } as any
    );

    // Patch model: we assume spec_json has a top-level `components` array with `id` per component.
    // If your spec schema differs, adjust applySpecPatch operations accordingly.
    const ops: Array<any> = [];

    for (const a of context.actions) {
      if (a.type === "toggle_widget") {
        ops.push({
          op: "setComponentProp",
          componentId: a.widgetId,
          key: "hidden",
          value: !a.enabled,
        });
      }

      if (a.type === "rename_widget") {
        ops.push({
          op: "setComponentProp",
          componentId: a.widgetId,
          key: "title",
          value: a.title,
        });
      }

      if (a.type === "reorder_widgets") {
        ops.push({
          op: "reorderComponents",
          orderedIds: a.orderedIds,
        });
      }

      if (a.type === "switch_chart_type") {
        ops.push({
          op: "setComponentProp",
          componentId: a.widgetId,
          key: "variant",
          value: a.chartType,
        });
      }

      if (a.type === "set_density") {
        ops.push({
          op: "setDesignToken",
          path: "theme.spacing.base",
          value: densityToSpacingBase(a.density),
        });
      }

      if (a.type === "set_palette") {
        // Palette ids map to token presets on the frontend for MVP.
        // Router will translate paletteId -> actual token values and call setDesignToken.
        // This tool expects the router to convert palette selection to token ops.
      }
    }

    const patched = await applySpecPatch.execute(
      { context: { tenantId: context.tenantId, interfaceId: context.interfaceId, operations: ops }, runtimeContext } as any
    );

    const validation = await validateSpec.execute(
      { context: { spec_json: patched.spec_json }, runtimeContext } as any
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
          spec_json: patched.spec_json,
          design_tokens: patched.design_tokens,
          platformType: context.platformType,
        },
        runtimeContext,
      } as any
    );

    return { previewUrl: saved.previewUrl, previewVersionId: saved.versionId };
  },
});

