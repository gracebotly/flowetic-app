
import { z } from "zod";

export type DensityPreset = "compact" | "comfortable" | "spacious";

export type ChartType = "line" | "area" | "bar";

// Generic edit actions emitted from Tool UI
export const EditActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("toggle_widget"), widgetId: z.string(), enabled: z.boolean() }),
  z.object({ type: z.literal("rename_widget"), widgetId: z.string(), title: z.string() }),
  z.object({ type: z.literal("reorder_widgets"), orderedIds: z.array(z.string()) }),
  z.object({ type: z.literal("switch_chart_type"), widgetId: z.string(), chartType: z.enum(["line", "area", "bar"]) }),
  z.object({ type: z.literal("set_density"), density: z.enum(["compact", "comfortable", "spacious"]) }),
  z.object({ type: z.literal("set_palette"), paletteId: z.string() }),
]);

export type EditAction = z.infer<typeof EditActionSchema>;

