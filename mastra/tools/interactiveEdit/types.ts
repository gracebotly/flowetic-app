
import { z } from "zod";

export const DensityPresetSchema = z.enum(["compact", "comfortable", "spacious"]);
export type DensityPreset = z.infer<typeof DensityPresetSchema>;

export const EditActionSchema = z.object({
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
  chartType: z.enum(["line", "bar", "area", "pie", "donut"]).optional(),
  density: DensityPresetSchema.optional(),
  paletteId: z.string().optional(),
  order: z.array(z.string()).optional(),
});

export type EditAction = z.infer<typeof EditActionSchema>;
