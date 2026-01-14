


"use client";

import { useMemo, useState } from "react";

type Widget = {
  id: string;
  title: string;
  kind: "metric" | "chart" | "table" | "other";
  enabled: boolean;
};

type PaletteOption = {
  id: string;
  name: string;
  swatches: { name: string; hex: string }[];
};

export function InteractiveEditPanel({
  title,
  interfaceId,
  widgets,
  palettes,
  density,
  onApply,
}: {
  title: string;
  interfaceId: string;
  widgets: Widget[];
  palettes: PaletteOption[];
  density: "compact" | "comfortable" | "spacious";
  onApply: (payload: { interfaceId: string; actions: any[] }) => Promise<void>;
}) {
  const [localWidgets, setLocalWidgets] = useState<Widget[]>(widgets);
  const [localDensity, setLocalDensity] = useState(density);
  const [selectedPaletteId, setSelectedPaletteId] = useState<string | null>(null);

  const orderedIds = useMemo(() => localWidgets.map((w) => w.id), [localWidgets]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 text-sm font-semibold text-gray-900">{title}</div>

      <div className="space-y-4">
        {/* Density */}
        <div>
          <div className="mb-2 text-xs font-medium text-gray-700">Density</div>
          <div className="inline-flex items-center gap-2 rounded-lg bg-gray-50 p-1">
            {(["compact", "comfortable", "spacious"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setLocalDensity(d)}
                className={
                  localDensity === d
                    ? "rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white"
                    : "rounded-md px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-white"
                }
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Palette */}
        <div>
          <div className="mb-2 text-xs font-medium text-gray-700">Palette</div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {palettes.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPaletteId(p.id)}
                className={
                  "rounded-lg border p-3 text-left transition " +
                  (selectedPaletteId === p.id ? "border-blue-600 ring-2 ring-blue-100" : "border-gray-200 hover:bg-gray-50")
                }
              >
                <div className="text-sm font-semibold text-gray-900">{p.name}</div>
                <div className="mt-2 flex items-center gap-2">
                  {p.swatches.slice(0, 5).map((s) => (
                    <div
                      key={s.name}
                      className="h-5 w-5 rounded-full border border-white shadow"
                      style={{ backgroundColor: s.hex }}
                      title={`${s.name}: ${s.hex}`}
                    />
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Widgets */}
        <div>
          <div className="mb-2 text-xs font-medium text-gray-700">Widgets</div>
          <div className="space-y-2">
            {localWidgets.map((w, idx) => (
              <div key={w.id} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <button
                  type="button"
                  className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                  disabled={idx === 0}
                  onClick={() => {
                    if (idx === 0) return;
                    const next = [...localWidgets];
                    const tmp = next[idx - 1]!;
                    next[idx - 1] = next[idx]!;
                    next[idx] = tmp;
                    setLocalWidgets(next);
                  }}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                  disabled={idx === localWidgets.length - 1}
                  onClick={() => {
                    if (idx === localWidgets.length - 1) return;
                    const next = [...localWidgets];
                    const tmp = next[idx + 1]!;
                    next[idx + 1] = next[idx]!;
                    next[idx] = tmp;
                    setLocalWidgets(next);
                  }}
                >
                  ↓
                </button>

                <input
                  className="flex-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-sm"
                  value={w.title}
                  onChange={(e) => {
                    const next = localWidgets.map((x) => (x.id === w.id ? { ...x, title: e.target.value } : x));
                    setLocalWidgets(next);
                  }}
                />

                <select
                  className="rounded-md border border-gray-200 bg-white px-2 py-1 text-sm"
                  defaultValue={w.kind === "chart" ? "line" : ""}
                  onChange={(e) => {
                    // handled on apply
                  }}
                  disabled={w.kind !== "chart"}
                  title={w.kind === "chart" ? "Chart type" : "Not a chart"}
                >
                  <option value="line">line</option>
                  <option value="area">area</option>
                  <option value="bar">bar</option>
                </select>

                <button
                  type="button"
                  onClick={() => {
                    const next = localWidgets.map((x) => (x.id === w.id ? { ...x, enabled: !x.enabled } : x));
                    setLocalWidgets(next);
                  }}
                  className={
                    "rounded-md px-3 py-1 text-xs font-semibold " +
                    (w.enabled ? "bg-green-600 text-white hover:bg-green-700" : "bg-gray-300 text-gray-800 hover:bg-gray-400")
                  }
                >
                  {w.enabled ? "On" : "Off"}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Apply */}
        <button
          type="button"
          onClick={async () => {
            const actions: any[] = [];

            // reorder
            actions.push({ type: "reorder_widgets", orderedIds });

            // toggle + rename
            for (const w of localWidgets) {
              actions.push({ type: "toggle_widget", widgetId: w.id, enabled: w.enabled });
              actions.push({ type: "rename_widget", widgetId: w.id, title: w.title });
            }

            // density
            actions.push({ type: "set_density", density: localDensity });

            // palette
            if (selectedPaletteId) actions.push({ type: "set_palette", paletteId: selectedPaletteId });

            await onApply({ interfaceId, actions });
          }}
          className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Apply changes
        </button>
      </div>
    </div>
  );
}




