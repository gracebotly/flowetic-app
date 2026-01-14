


"use client";

import { useMemo } from "react";

type StyleBundle = {
  id: string;
  name: string;
  description: string;
  previewImageUrl: string;
  palette: { name: string; swatches: { name: string; hex: string }[] };
  tags: string[];
};

export function StyleBundleCards({
  title,
  bundles,
  onSelect,
}: {
  title: string;
  bundles: StyleBundle[];
  onSelect: (bundleId: string) => void;
}) {
  const rows = useMemo(() => {
    const a: StyleBundle[][] = [];
    for (let i = 0; i < bundles.length; i += 2) a.push(bundles.slice(i, i + 2));
    return a;
  }, [bundles]);

  return (
    <div className="w-full">
      <div className="mb-3 text-sm font-semibold text-gray-900">{title}</div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {bundles.map((b) => (
          <div
            key={b.id}
            className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md"
          >
            <div className="h-40 w-full bg-gray-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={b.previewImageUrl}
                alt={b.name}
                className="h-40 w-full object-cover"
              />
            </div>
            <div className="p-4">
              <div className="text-base font-semibold text-gray-900">{b.name}</div>
              <div className="mt-1 text-sm text-gray-600">{b.description}</div>

              <div className="mt-3 flex items-center gap-2">
                {b.palette.swatches.slice(0, 5).map((s) => (
                  <div
                    key={s.name}
                    className="h-6 w-6 rounded-full border border-white shadow"
                    style={{ backgroundColor: s.hex }}
                    title={`${s.name}: ${s.hex}`}
                  />
                ))}
                <div className="ml-1 text-xs text-gray-500">{b.palette.name}</div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1">
                {b.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-gray-100 px-2 py-1 text-[11px] text-gray-700"
                  >
                    {t}
                  </span>
                ))}
              </div>

              <button
                type="button"
                onClick={() => onSelect(b.id)}
                className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Select this style
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


