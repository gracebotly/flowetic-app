
"use client";

import { useEffect, useMemo, useState } from "react";
import type { PreviewComponent } from "./preview-inspector";

function kindFromType(type: string): "metric" | "chart" | "table" | "other" {
  const t = type.toLowerCase();
  if (t.includes("chart")) return "chart";
  if (t.includes("table")) return "table";
  if (t.includes("metric")) return "metric";
  return "other";
}

export function WidgetPropertiesDrawer({
  open,
  onClose,
  component,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  component: PreviewComponent | null;
  onApply: (actions: any[]) => Promise<void>;
}) {
  const kind = useMemo(() => (component ? kindFromType(component.type) : "other"), [component]);

  const [title, setTitle] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [chartType, setChartType] = useState<"line" | "area" | "bar">("line");

  useEffect(() => {
    if (!component) return;
    const t =
      typeof component.props?.title === "string" && component.props.title.trim()
        ? component.props.title
        : component.id;
    setTitle(t);
    setEnabled(!(component.props?.hidden === true));
    const ct = component.props?.chartType;
    if (ct === "line" || ct === "area" || ct === "bar") setChartType(ct);
    else setChartType("line");
  }, [component]);

  if (!open) return null;

  return (
    <div className="absolute right-0 top-0 z-20 h-full w-[420px] max-w-[92vw] border-l border-gray-200 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-gray-900">Widget properties</div>
          <div className="truncate text-xs text-gray-500">
            {component?.id ?? ""} • {kind}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Close
        </button>
      </div>

      <div className="space-y-4 p-4">
        <div>
          <div className="mb-1 text-xs font-semibold text-gray-700">Title</div>
          <input
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Widget title"
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <div>
            <div className="text-sm font-semibold text-gray-900">Visible</div>
            <div className="text-xs text-gray-500">Toggle widget on/off</div>
          </div>
          <button
            type="button"
            onClick={() => setEnabled((v) => !v)}
            className={
              "rounded-md px-3 py-1.5 text-sm font-semibold " +
              (enabled ? "bg-green-600 text-white hover:bg-green-700" : "bg-gray-300 text-gray-800 hover:bg-gray-400")
            }
          >
            {enabled ? "On" : "Off"}
          </button>
        </div>

        {kind === "chart" ? (
          <div>
            <div className="mb-1 text-xs font-semibold text-gray-700">Chart type</div>
            <select
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              value={chartType}
              onChange={(e) => setChartType(e.target.value as any)}
            >
              <option value="line">line</option>
              <option value="area">area</option>
              <option value="bar">bar</option>
            </select>
            <div className="mt-1 text-xs text-gray-500">
              This updates the widget's chart rendering style.
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={async () => {
            if (!component) return;
            const actions: any[] = [
              { type: "rename_widget", widgetId: component.id, title: title.trim() || component.id },
              { type: "toggle_widget", widgetId: component.id, enabled },
            ];
            if (kind === "chart") {
              actions.push({ type: "switch_chart_type", widgetId: component.id, chartType });
            }
            await onApply(actions);
          }}
          className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Apply changes
        </button>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          Tip: You can also reorder and bulk-edit widgets in the "Refine your dashboard" panel.
        </div>
      </div>
    </div>
  );
}

