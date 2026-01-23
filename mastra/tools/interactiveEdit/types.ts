
import { z } from "zod";

export const DensityPresetSchema = z.enum(["compact", "comfortable", "spacious"]);
export type DensityPreset = z.infer<typeof DensityPresetSchema>;

export const EditActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("toggle_widget"),
    widgetId: z.string(),
    enabled: z.boolean(),
  }),
  z.object({
    type: z.literal("rename_widget"),
    widgetId: z.string(),
    title: z.string(),
  }),
  z.object({
    type: z.literal("reorder_widgets"),
    orderedIds: z.array(z.string()).min(1),
  }),
  z.object({
    type: z.literal("switch_chart_type"),
    widgetId: z.string(),
    chartType: z.enum(["line", "area", "bar"]),
  }),
  z.object({
    type: z.literal("set_density"),
    density: DensityPresetSchema,
  }),
  z.object({
    type: z.literal("set_palette"),
    paletteId: z.string(),
  }),
]);

export type EditAction = z.infer<typeof EditActionSchema>;

