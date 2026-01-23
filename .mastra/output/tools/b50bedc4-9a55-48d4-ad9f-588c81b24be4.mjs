import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { validateSpec } from './8f8fbf39-d697-4727-9f57-93eed5df67ea.mjs';
import { EditAction } from './b6f57339-5321-423a-b71b-5e556faee6b4.mjs';
import { reorderComponents } from './71a5c419-b5ff-4dbc-8b03-154d3d4f66d5.mjs';
import { getCurrentSpec } from './22a82169-bcc4-4704-8c07-646802f3136f.mjs';
import { applySpecPatch } from './62c15984-69dd-428e-8bef-b2843e58c020.mjs';
import { savePreviewVersion } from './83cb9653-4043-4ed3-93ed-b62d3019c72f.mjs';
import '../supabase.mjs';
import '@supabase/supabase-js';
import './2afe9f7b-3baa-40e6-b81f-d049ec3a95c3.mjs';

function densityToSpacingBase(d) {
  if (d === "compact") return 8;
  if (d === "spacious") return 14;
  return 10;
}
const applyInteractiveEdits = createTool({
  id: "interactive.applyEdits",
  description: "Apply interactive edit actions (toggle/rename/switch chart type + density) to current preview spec and persist a new preview version.",
  inputSchema: z.object({
    tenantId: z.string().uuid(),
    userId: z.string().uuid(),
    interfaceId: z.string().uuid(),
    platformType: z.string().min(1),
    actions: z.array(EditAction).min(1).max(30)
  }),
  outputSchema: z.object({
    previewUrl: z.string().url(),
    previewVersionId: z.string().uuid()
  }),
  execute: async ({ context, runtimeContext }) => {
    const current = await getCurrentSpec.execute(
      { context: { tenantId: inputData.tenantId, interfaceId: inputData.interfaceId }, runtimeContext }
    );
    let nextSpec = current.spec_json ?? {};
    let nextTokens = current.design_tokens ?? {};
    const reorderAction = inputData.actions.find((a) => a.type === "reorder_widgets");
    if (reorderAction?.orderedIds?.length) {
      const reordered = await reorderComponents.execute(
        { context: { spec_json: nextSpec, orderedIds: reorderAction.orderedIds }, runtimeContext }
      );
      nextSpec = reordered.spec_json;
    }
    const ops = [];
    for (const a of inputData.actions) {
      if (a.type === "toggle_widget") {
        ops.push({
          op: "updateComponentProps",
          componentId: a.widgetId,
          propsPatch: { hidden: !a.enabled }
        });
      } else if (a.type === "rename_widget") {
        ops.push({
          op: "updateComponentProps",
          componentId: a.widgetId,
          propsPatch: { title: a.title }
        });
      } else if (a.type === "switch_chart_type") {
        ops.push({
          op: "updateComponentProps",
          componentId: a.widgetId,
          propsPatch: { chartType: a.chartType }
        });
      } else if (a.type === "set_density") {
        ops.push({
          op: "setDesignToken",
          tokenPath: "theme.spacing.base",
          tokenValue: densityToSpacingBase(a.density)
        });
      }
    }
    if (ops.length) {
      const patched = await applySpecPatch.execute(
        { context: { spec_json: nextSpec, design_tokens: nextTokens, operations: ops }, runtimeContext }
      );
      nextSpec = patched.spec_json;
      nextTokens = patched.design_tokens;
    }
    const validation = await validateSpec.execute(
      { context: { spec_json: nextSpec }, runtimeContext }
    );
    if (!validation.valid || validation.score < 0.8) throw new Error("INTERACTIVE_EDIT_VALIDATION_FAILED");
    const saved = await savePreviewVersion.execute(
      {
        context: {
          tenantId: inputData.tenantId,
          userId: inputData.userId,
          interfaceId: inputData.interfaceId,
          spec_json: nextSpec,
          design_tokens: nextTokens,
          platformType: inputData.platformType
        },
        runtimeContext
      }
    );
    return { previewUrl: saved.previewUrl, previewVersionId: saved.versionId };
  }
});

export { applyInteractiveEdits };
