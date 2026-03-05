"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import {
  Search,
  Cpu,
  Bot,
  Workflow,
  Zap,
  GitBranch,
  Phone,
  X,
} from "lucide-react";
import { PlatformBadge, getPlatformLabel } from "@/components/shared/PlatformBadge";

// ────────────────────────────────────────────
// Types (UNCHANGED — preserve exact interface)
// ────────────────────────────────────────────

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

// ────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────

const KIND_ICONS: Record<string, typeof Bot> = {
  agent: Bot,
  assistant: Phone,
  workflow: Workflow,
  scenario: Zap,
  flow: GitBranch,
  squad: Cpu,
};

// ────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────

function cleanDisplayName(name: string): string {
  return name.replace(/^\d+-/, "").replace(/[_-]/g, " ").trim();
}

// ────────────────────────────────────────────
// Component
// ────────────────────────────────────────────

export function WizardStepWorkflow({
  sources,
  entities,
  selectedSourceId,
  selectedEntityUuid,
  onSelect,
}: Props) {
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // Auto-focus search on mount
  useEffect(() => {
    if (entities.length > 0) {
      searchRef.current?.focus();
    }
  }, [entities.length]);

  // Flat filtered list — no accordion grouping, just a clean vertical list
  const filtered = useMemo(() => {
    if (!search.trim()) return entities;
    const q = search.toLowerCase();
    return entities.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.platform.toLowerCase().includes(q) ||
        e.kind.toLowerCase().includes(q) ||
        e.externalId.toLowerCase().includes(q)
    );
  }, [entities, search]);

  // ── Empty state ──
  if (sources.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
          <Cpu className="h-7 w-7 text-gray-400" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-gray-900">No connections yet</h3>
        <p className="mt-2 max-w-xs text-sm text-gray-500">
          Connect a platform first (Vapi, Retell, n8n, or Make) to get started.
        </p>
        <a
          href="/control-panel/connections"
          className="mt-4 text-sm font-medium text-blue-600 transition-colors duration-150 hover:text-blue-700"
        >
          Go to Connections →
        </a>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900">Select an agent or workflow</h2>
      <p className="mt-1 text-sm text-gray-500">
        Pick the connection and agent that will power this portal.
      </p>

      {/* Search bar — always visible for any catalog size */}
      {entities.length > 0 && (
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agents, workflows, scenarios…"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-10 text-sm text-gray-900 outline-none transition-colors duration-150 placeholder:text-gray-400 focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 transition-colors duration-150 hover:text-gray-600 cursor-pointer"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* Entity list — vertical rows */}
      <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="max-h-[55vh] overflow-y-auto divide-y divide-gray-100">
          {filtered.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center px-4">
              <Search className="h-8 w-8 text-gray-300" />
              <p className="mt-3 text-sm font-medium text-gray-500">
                {search ? `No results for "${search}"` : "No entities available"}
              </p>
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="mt-2 cursor-pointer text-xs font-medium text-blue-600 transition-colors duration-150 hover:text-blue-700"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            filtered.map((entity) => {
              const isSelected =
                selectedSourceId === entity.sourceId &&
                selectedEntityUuid === entity.entityUuid;
              const KindIcon = KIND_ICONS[entity.kind] ?? Workflow;

              return (
                <div
                  key={entity.entityUuid}
                  onClick={() => onSelect(entity.sourceId, entity.entityUuid)}
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === " " || e.key === "Enter") {
                      e.preventDefault();
                      onSelect(entity.sourceId, entity.entityUuid);
                    }
                  }}
                  className={`
                    group flex cursor-pointer items-center gap-3 px-4 py-3
                    transition-colors duration-150
                    ${
                      isSelected
                        ? "bg-blue-50/70 border-l-2 border-l-blue-500"
                        : "border-l-2 border-l-transparent hover:bg-gray-50"
                    }
                  `}
                >
                  {/* Radio indicator */}
                  <div
                    className={`
                      flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full
                      transition-all duration-150
                      ${
                        isSelected
                          ? "border-[5px] border-blue-600 bg-white"
                          : "border-2 border-gray-300 bg-white group-hover:border-gray-400"
                      }
                    `}
                  />

                  {/* Platform color badge */}
                  <PlatformBadge platform={entity.platform} size={32} />

                  {/* Name + meta */}
                  <div className="min-w-0 flex-1">
                    <span className="truncate text-sm font-semibold text-gray-900">
                      {cleanDisplayName(entity.name)}
                    </span>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                      <KindIcon className="h-3 w-3 flex-shrink-0" />
                      <span className="capitalize">{entity.kind}</span>
                      <span className="text-gray-300">·</span>
                      <span>{getPlatformLabel(entity.platform)}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Result count */}
      {filtered.length > 0 && (
        <div className="mt-2 text-xs text-gray-400">
          {filtered.length} {filtered.length === 1 ? "result" : "results"}
          {filtered.length !== entities.length && ` of ${entities.length} total`}
        </div>
      )}
    </div>
  );
}
