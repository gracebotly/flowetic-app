"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Search,
  Check,
  Phone,
  GitBranch,
  Bot,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@tremor/react";
import { motion, AnimatePresence } from "framer-motion";

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────

export interface EntityItem {
  id: string;
  source_id: string;
  display_name: string;
  entity_kind: string;
  external_id: string;
  platform_type: string;
  source_name: string;
  last_seen_at: string | null;
}

export interface SelectedEntity {
  id: string;
  sourceId: string;
  platform: string;
  displayName: string;
  entityKind: string;
  externalId: string;
}

interface AgentPickerProps {
  entities: EntityItem[];
  loading: boolean;
  selected: SelectedEntity[];
  onSelectionChange: (selected: SelectedEntity[]) => void;
  onContinue: () => void;
}

// ────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────

const PLATFORM_FILTERS = [
  { value: "all", label: "All" },
  { value: "vapi", label: "Vapi" },
  { value: "retell", label: "Retell" },
  { value: "n8n", label: "n8n" },
  { value: "make", label: "Make" },
] as const;

const PLATFORM_COLORS: Record<string, string> = {
  vapi: "blue",
  retell: "red",
  n8n: "orange",
  make: "violet",
};

const KIND_ICONS: Record<string, typeof Phone> = {
  assistant: Phone,
  agent: Phone,
  workflow: GitBranch,
  scenario: Bot,
};

// ────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────

function formatLastSeen(dateStr: string | null): string {
  if (!dateStr) return "No activity";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Active today";
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function shortId(externalId: string): string {
  if (!externalId) return "";
  return externalId.slice(-6);
}

function cleanDisplayName(name: string): string {
  // Strip leading number prefixes like "1-", "23-", "100-"
  return name.replace(/^\d+-/, "").replace(/[_-]/g, " ").trim();
}

// ────────────────────────────────────────────
// EntityCard
// ────────────────────────────────────────────

function EntityCard({
  entity,
  isSelected,
  onToggle,
}: {
  entity: EntityItem;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const Icon = KIND_ICONS[entity.entity_kind] || GitBranch;
  const platformColor = PLATFORM_COLORS[entity.platform_type] || "gray";

  return (
    <div
      onClick={onToggle}
      role="checkbox"
      aria-checked={isSelected}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          onToggle();
        }
      }}
      className={`
        group relative cursor-pointer rounded-xl border p-4
        transition-all duration-200
        ${
          isSelected
            ? "border-tremor-brand bg-tremor-brand/5 dark:border-dark-tremor-brand dark:bg-dark-tremor-brand/10 ring-1 ring-tremor-brand/20"
            : "border-tremor-border dark:border-dark-tremor-border hover:border-tremor-brand/50 dark:hover:border-dark-tremor-brand/50 hover:shadow-sm"
        }
      `}
    >
      {/* Checkbox indicator */}
      <div
        className={`
          absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded
          transition-all duration-200
          ${
            isSelected
              ? "bg-tremor-brand text-white"
              : "border border-tremor-border dark:border-dark-tremor-border group-hover:border-tremor-brand/50"
          }
        `}
      >
        {isSelected && <Check className="h-3 w-3" strokeWidth={3} />}
      </div>

      {/* Platform badge + Kind */}
      <div className="flex items-center gap-2 pr-6">
        <Badge size="xs" color={platformColor}>
          {entity.source_name}
        </Badge>
        <span className="text-[11px] font-medium uppercase tracking-wide text-tremor-content dark:text-dark-tremor-content">
          {entity.entity_kind}
        </span>
      </div>

      {/* Name */}
      <div className="mt-2.5 flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-tremor-content dark:text-dark-tremor-content" />
        <h3 className="text-sm font-semibold leading-tight text-tremor-content-strong dark:text-dark-tremor-content-strong line-clamp-2">
          {cleanDisplayName(entity.display_name)}
        </h3>
      </div>

      {/* Meta row */}
      <div className="mt-3 flex items-center justify-between text-[11px] text-tremor-content dark:text-dark-tremor-content">
        <span className="font-mono opacity-60">ID: {shortId(entity.external_id)}</span>
        <span>{formatLastSeen(entity.last_seen_at)}</span>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────

export default function AgentPicker({
  entities,
  loading,
  selected,
  onSelectionChange,
  onContinue,
}: AgentPickerProps) {
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");

  // ── Filter entities ──
  const filtered = useMemo(() => {
    let result = entities;

    if (platformFilter !== "all") {
      result = result.filter((e) => e.platform_type === platformFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.display_name.toLowerCase().includes(q) ||
          e.external_id.toLowerCase().includes(q) ||
          e.entity_kind.toLowerCase().includes(q)
      );
    }

    return result;
  }, [entities, platformFilter, search]);

  // ── Platform counts for filter chips ──
  const platformCounts = useMemo(() => {
    const counts: Record<string, number> = { all: entities.length };
    for (const e of entities) {
      counts[e.platform_type] = (counts[e.platform_type] || 0) + 1;
    }
    return counts;
  }, [entities]);

  // ── Selection toggle ──
  const selectedIds = useMemo(() => new Set(selected.map((s) => s.id)), [selected]);

  const toggleEntity = useCallback(
    (entity: EntityItem) => {
      if (selectedIds.has(entity.id)) {
        onSelectionChange(selected.filter((s) => s.id !== entity.id));
      } else {
        onSelectionChange([
          ...selected,
          {
            id: entity.id,
            sourceId: entity.source_id,
            platform: entity.platform_type,
            displayName: entity.display_name,
            entityKind: entity.entity_kind,
            externalId: entity.external_id,
          },
        ]);
      }
    },
    [selected, selectedIds, onSelectionChange]
  );

  // ── Select all visible ──
  const selectAllVisible = useCallback(() => {
    const newSelected = [...selected];
    for (const entity of filtered) {
      if (!selectedIds.has(entity.id)) {
        newSelected.push({
          id: entity.id,
          sourceId: entity.source_id,
          platform: entity.platform_type,
          displayName: entity.display_name,
          entityKind: entity.entity_kind,
          externalId: entity.external_id,
        });
      }
    }
    onSelectionChange(newSelected);
  }, [filtered, selected, selectedIds, onSelectionChange]);

  const clearSelection = useCallback(() => {
    onSelectionChange([]);
  }, [onSelectionChange]);

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-tremor-content" />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="mb-5">
        <h2 className="text-lg font-bold text-tremor-content-strong dark:text-dark-tremor-content-strong">
          Select agents and workflows
        </h2>
        <p className="mt-1 text-sm text-tremor-content dark:text-dark-tremor-content">
          Pick one or more to create portals for. Same configuration applies to all.
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tremor-content dark:text-dark-tremor-content" />
        <input
          type="text"
          placeholder="Search by name, ID, or type..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-tremor-default border border-tremor-border bg-tremor-background py-2.5 pl-10 pr-4 text-sm text-tremor-content-strong placeholder:text-tremor-content focus:border-tremor-brand focus:outline-none focus:ring-1 focus:ring-tremor-brand dark:border-dark-tremor-border dark:bg-dark-tremor-background dark:text-dark-tremor-content-strong dark:placeholder:text-dark-tremor-content dark:focus:border-dark-tremor-brand dark:focus:ring-dark-tremor-brand"
        />
      </div>

      {/* Platform filter chips */}
      <div className="mb-4 flex flex-wrap gap-2">
        {PLATFORM_FILTERS.map((pf) => {
          const count = platformCounts[pf.value] || 0;
          if (pf.value !== "all" && count === 0) return null;
          const isActive = platformFilter === pf.value;
          return (
            <button
              key={pf.value}
              onClick={() => setPlatformFilter(pf.value)}
              className={`
                cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium
                transition-colors duration-200
                ${
                  isActive
                    ? "bg-tremor-brand text-white"
                    : "bg-tremor-background-subtle text-tremor-content hover:bg-tremor-background-emphasis dark:bg-dark-tremor-background-subtle dark:text-dark-tremor-content dark:hover:bg-dark-tremor-background-emphasis"
                }
              `}
            >
              {pf.label}
              <span className="ml-1.5 opacity-70">{count}</span>
            </button>
          );
        })}

        {/* Select all / Clear */}
        <div className="ml-auto flex items-center gap-2">
          {selected.length > 0 && (
            <button
              onClick={clearSelection}
              className="cursor-pointer text-xs font-medium text-tremor-content hover:text-red-600 dark:text-dark-tremor-content dark:hover:text-red-400 transition-colors duration-200"
            >
              Clear ({selected.length})
            </button>
          )}
          {filtered.length > 0 && filtered.length <= 20 && (
            <button
              onClick={selectAllVisible}
              className="cursor-pointer text-xs font-medium text-tremor-brand hover:text-tremor-brand-emphasis dark:text-dark-tremor-brand dark:hover:text-dark-tremor-brand-emphasis transition-colors duration-200"
            >
              Select all visible
            </button>
          )}
        </div>
      </div>

      {/* Card grid — scrollable */}
      <div className="overflow-y-auto max-h-[55vh] pr-1 -mr-1">
        {filtered.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center">
            <Search className="h-8 w-8 text-tremor-content dark:text-dark-tremor-content opacity-40" />
            <p className="mt-3 text-sm text-tremor-content dark:text-dark-tremor-content">
              {search ? `No results for "${search}"` : "No entities found for this platform"}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((entity) => (
              <EntityCard
                key={entity.id}
                entity={entity}
                isSelected={selectedIds.has(entity.id)}
                onToggle={() => toggleEntity(entity)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Selection summary bar — sticky bottom */}
      <AnimatePresence>
        {selected.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.2 }}
            className="mt-4 flex items-center justify-between rounded-xl border border-tremor-brand/20 bg-tremor-brand/5 dark:border-dark-tremor-brand/20 dark:bg-dark-tremor-brand/10 px-4 py-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-tremor-content-strong dark:text-dark-tremor-content-strong">
                {selected.length} selected
              </p>
              <p className="truncate text-xs text-tremor-content dark:text-dark-tremor-content">
                {selected
                  .slice(0, 3)
                  .map((s) => cleanDisplayName(s.displayName))
                  .join(", ")}
                {selected.length > 3 && ` +${selected.length - 3} more`}
              </p>
            </div>
            <button
              onClick={onContinue}
              className="cursor-pointer flex items-center gap-1.5 rounded-tremor-default bg-tremor-brand px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-tremor-brand-emphasis"
            >
              Continue
              <ChevronRight className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
