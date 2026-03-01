"use client";

import { useMemo, useState } from "react";
import { Search, Cpu, Bot, Workflow, Zap } from "lucide-react";

type SourceOption = {
  id: string;
  type: string;
  name: string;
};

type EntityOption = {
  entityUuid: string;
  name: string;
  platform: string;
  kind: string;
  externalId: string;
  sourceId: string;
};

type Props = {
  sources: SourceOption[];
  entities: EntityOption[];
  selectedSourceId: string | null;
  selectedEntityUuid: string | null;
  onSelect: (sourceId: string, entityUuid: string | null) => void;
};

const PLATFORM_COLORS: Record<string, string> = {
  vapi: "bg-violet-100 text-violet-700 border-violet-200",
  retell: "bg-rose-100 text-rose-700 border-rose-200",
  n8n: "bg-orange-100 text-orange-700 border-orange-200",
  make: "bg-purple-100 text-purple-700 border-purple-200",
};

const KIND_ICONS: Record<string, typeof Bot> = {
  agent: Bot,
  assistant: Bot,
  workflow: Workflow,
  scenario: Zap,
  flow: Workflow,
  squad: Cpu,
};

export function WizardStepWorkflow({
  sources,
  entities,
  selectedSourceId,
  selectedEntityUuid,
  onSelect,
}: Props) {
  const [search, setSearch] = useState("");

  // Group entities by sourceId
  const entitiesBySource = useMemo(() => {
    const map = new Map<string, EntityOption[]>();
    for (const e of entities) {
      const arr = map.get(e.sourceId) ?? [];
      arr.push(e);
      map.set(e.sourceId, arr);
    }
    return map;
  }, [entities]);

  // Filter entities by search
  const filteredEntities = useMemo(() => {
    if (!search.trim()) return entities;
    const q = search.toLowerCase();
    return entities.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.platform.toLowerCase().includes(q) ||
        e.kind.toLowerCase().includes(q)
    );
  }, [entities, search]);

  // Group filtered by source
  const filteredBySource = useMemo(() => {
    const map = new Map<string, EntityOption[]>();
    for (const e of filteredEntities) {
      const arr = map.get(e.sourceId) ?? [];
      arr.push(e);
      map.set(e.sourceId, arr);
    }
    return map;
  }, [filteredEntities]);

  if (sources.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
          <Cpu className="h-7 w-7 text-gray-400" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-gray-900">
          No connections yet
        </h3>
        <p className="mt-2 max-w-xs text-sm text-gray-500">
          Connect a platform first (Vapi, Retell, n8n, or Make) to create an
          offering.
        </p>
        <a
          href="/control-panel/connections"
          className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          Go to Connections →
        </a>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900">
        Which workflow or agent should this be based on?
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        Pick a connected source, then optionally choose a specific entity.
      </p>

      {/* Search */}
      {entities.length > 5 && (
        <div className="relative mt-5">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search workflows, agents, scenarios…"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
          />
        </div>
      )}

      {/* Sources + Entities */}
      <div className="mt-5 space-y-4">
        {sources.map((source) => {
          const sourceEntities = filteredBySource.get(source.id) ?? [];
          const isSourceSelected = selectedSourceId === source.id;
          const colorClass =
            PLATFORM_COLORS[source.type] ?? "bg-gray-100 text-gray-700 border-gray-200";

          return (
            <div key={source.id}>
              {/* Source header — clicking selects entire source (no specific entity) */}
              <button
                type="button"
                onClick={() => onSelect(source.id, null)}
                className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition ${
                  isSourceSelected && !selectedEntityUuid
                    ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100"
                    : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <span
                  className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${colorClass}`}
                >
                  {source.type}
                </span>
                <span className="flex-1 text-sm font-medium text-gray-900">
                  {source.name}
                </span>
                {sourceEntities.length > 0 && (
                  <span className="text-xs text-gray-400">
                    {sourceEntities.length} entit{sourceEntities.length === 1 ? "y" : "ies"}
                  </span>
                )}
              </button>

              {/* Entity sub-list (only show when this source is selected or has matching search) */}
              {(isSourceSelected || search.trim()) && sourceEntities.length > 0 && (
                <div className="ml-6 mt-2 space-y-1.5">
                  {sourceEntities.map((entity) => {
                    const isSelected = selectedEntityUuid === entity.entityUuid;
                    const KindIcon = KIND_ICONS[entity.kind] ?? Workflow;

                    return (
                      <button
                        key={entity.entityUuid}
                        type="button"
                        onClick={() => onSelect(source.id, entity.entityUuid)}
                        className={`flex w-full items-center gap-3 rounded-lg border px-4 py-2.5 text-left transition ${
                          isSelected
                            ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100"
                            : "border-gray-100 bg-gray-50/50 hover:border-gray-200 hover:bg-white"
                        }`}
                      >
                        <KindIcon className="h-4 w-4 flex-shrink-0 text-gray-400" />
                        <span className="flex-1 truncate text-sm text-gray-700">
                          {entity.name}
                        </span>
                        <span className="flex-shrink-0 text-[10px] uppercase tracking-wide text-gray-400">
                          {entity.kind}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
