// Core types for the interactive editor system
export type DeviceMode = "mobile" | "tablet" | "desktop";
export type WidgetKind = "metric" | "chart" | "table" | "other";
export type ChartType = "line" | "bar" | "area" | "pie" | "donut";
export type Density = "compact" | "comfortable" | "spacious";

export interface WidgetConfig {
  id: string;
  title: string;
  kind: WidgetKind;
  enabled: boolean;
  chartType?: ChartType;
}

export interface ColorSwatch {
  name: string;
  hex: string;
}

export interface Palette {
  id: string;
  name: string;
  swatches: ColorSwatch[];
}

export interface EditAction {
  type: "toggle_widget" | "rename_widget" | "switch_chart_type" | "set_density" | "set_palette" | "reorder_widgets";
  widgetId?: string;
  title?: string;
  chartType?: ChartType;
  density?: Density;
  paletteId?: string;
  order?: string[];
}

export interface UseEditActionsOptions {
  tenantId: string;
  userId: string;
  interfaceId: string;
  platformType: string;
  onSuccess?: (result: { previewUrl: string; previewVersionId: string }) => void;
  onError?: (error: Error) => void;
}

export interface UseEditActionsReturn {
  // Actions
  toggleWidget: (widgetId: string) => void;
  renameWidget: (widgetId: string, title: string) => void;
  changeChartType: (widgetId: string, chartType: ChartType) => void;
  setDensity: (density: Density) => void;
  setPalette: (paletteId: string) => void;
  reorderWidgets: (order: string[]) => void;

  // State
  isLoading: boolean;
  pendingActions: EditAction[];

  // Utils
  flushPendingActions: () => Promise<void>;
}
