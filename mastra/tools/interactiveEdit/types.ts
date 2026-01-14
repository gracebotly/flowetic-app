
import { z } from "zod";

export const DensityPreset = z.enum(["compact", "comfortable", "spacious"]);
export type DensityPreset = z.infer<typeof DensityPreset>;

export const ChartType = z.enum(["line", "area", "bar"]);
export type ChartType = z.infer<typeof ChartType>;

// Generic edit actions emitted from Tool UI
export const EditAction = z.discriminatedUnion("type", [
  z.object({ type: z.literal("toggle_widget"), widgetId: z.string(), enabled: z.boolean() }),
  z.object({ type: z.literal("rename_widget"), widgetId: z.string(), title: z.string().min(1).max(80) }),
  z.object({ type: z.literal("reorder_widgets"), orderedIds: z.array(z.string()).min(2).max(50) }),
  z.object({ type: z.literal("switch_chart_type"), widgetId: z.string(), chartType: ChartType }),
  z.object({ type: z.literal("set_density"), density: DensityPreset }),
  z.object({ type: z.literal("set_palette"), paletteId: z.string() }),
]);

export type EditAction = z.infer<typeof EditAction>;

