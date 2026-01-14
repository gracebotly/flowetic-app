"use client";

import { useMemo } from "react";

export type PreviewComponent = {
  id: string;
  type: string;
  props: Record<string, any>;
  layout: { col: number; row: number; w: number; h: number };
};

function kindFromType(type: string): "metric" | "chart" | "table" | "other" {
  const t = type.toLowerCase();
  if (t.includes("chart")) return "chart";
  if (t.includes("table")) return "table";
  if (t.includes("metric")) return "metric";
  return "other";
}

export function PreviewInspector({
  components,
  selectedId,
  onSelect,
}: {
  components: PreviewComponent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const sorted = useMemo(() => {
    return [...components].sort((a, b) => {
      const ar = (a.layout?.row ?? 0) - (b.layout?.row ?? 0);
      if (ar !== 0) return ar;
      return (a.layout?.col ?? 0) - (b.layout?.col ?? 0);
    });
  }, [components]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <div className="mb-2 text-xs font-semibold text-gray-900">Click to edit a widget</div>
      <div className="space-y-2">
        {sorted.map((c) => {
          const title =
            typeof c.props?.title === "string" && c.props.title.trim()
              ? c.props.title
              : c.id;

          const kind = kindFromType(c.type);
          const hidden = c.props?.hidden === true;

          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              className={
                "w-full rounded-lg border px-3 py-2 text-left transition " +
                (selectedId === c.id
                  ? "border-blue-600 ring-2 ring-blue-100"
                  : "border-gray-200 hover:bg-gray-50")
              }
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-gray-900">
                    {title}
                  </div>
                  <div className="mt-0.5 text-[11px] text-gray-500">
                    {kind} • id: {c.id}
                    {hidden ? " • hidden" : ""}
                  </div>
                </div>

                <span
                  className={
                    "shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold " +
                    (kind === "chart"
                      ? "bg-violet-100 text-violet-700"
                      : kind === "metric"
                      ? "bg-emerald-100 text-emerald-700"
                      : kind === "table"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-gray-100 text-gray-700")
                  }
                >
                  {kind}
                </span>
              </div>
            </button>
          );
        })}
        {sorted.length === 0 ? (
          <div className="text-sm text-gray-500">No widgets found in spec.</div>
        ) : null}
      </div>
    </div>
  );
}
