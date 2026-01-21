
import { z } from "zod";

export type DensityPreset = "compact" | "comfortable" | "spacious";

export type ChartType = "line" | "area" | "bar";

// Generic edit actions emitted from Tool UI
export type EditAction = 
  | { type: "toggle_widget"; widgetId: string; enabled: boolean }
  | { type: "rename_widget"; widgetId: string; title: string }
  | { type: "reorder_widgets"; orderedIds: string[] }
  | { type: "switch_chart_type"; widgetId: string; chartType: ChartType }
  | { type: "set_density"; density: DensityPreset }
  | { type: "set_palette"; paletteId: string };

