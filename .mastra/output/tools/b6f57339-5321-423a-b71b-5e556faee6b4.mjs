import { z } from 'zod';

const DensityPreset = z.enum(["compact", "comfortable", "spacious"]);
const ChartType = z.enum(["line", "area", "bar"]);
const EditAction = z.discriminatedUnion("type", [
  z.object({ type: z.literal("toggle_widget"), widgetId: z.string(), enabled: z.boolean() }),
  z.object({ type: z.literal("rename_widget"), widgetId: z.string(), title: z.string().min(1).max(80) }),
  z.object({ type: z.literal("reorder_widgets"), orderedIds: z.array(z.string()).min(2).max(50) }),
  z.object({ type: z.literal("switch_chart_type"), widgetId: z.string(), chartType: ChartType }),
  z.object({ type: z.literal("set_density"), density: DensityPreset }),
  z.object({ type: z.literal("set_palette"), paletteId: z.string() })
]);

export { ChartType, DensityPreset, EditAction };
