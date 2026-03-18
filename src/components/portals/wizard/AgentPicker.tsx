"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  Search,
  Check,
  Phone,
  GitBranch,
  Loader2,
  ChevronRight,
  Cpu,
  Zap,
  Workflow,
  X,
  AlertTriangle,
  Ban,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PlatformBadge,
  getPlatformLabel,
} from "@/components/shared/PlatformBadge";

export interface EntityItem {
  id: string;
  source_id: string;
  display_name: string;
  entity_kind: string;
  external_id: string;
  platform_type: string;
  source_name: string;
  last_seen_at: string | null;
  healthStatus?: 'healthy' | 'degraded' | 'critical' | 'no-data';
  hasEvents?: boolean;
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
  onContinue?: () => void;
}

const VOICE = new Set(["vapi", "retell"]);
const WORKFLOW = new Set(["n8n", "make"]);
const MAX_SELECTION = 5;

const PLATFORM_FILTERS = [
  { value: "vapi", label: "Vapi" },
  { value: "retell", label: "Retell" },
  { value: "n8n", label: "n8n" },
  { value: "make", label: "Make" },
] as const;

const KIND_ICONS: Record<string, typeof Phone> = {
  assistant: Phone,
  agent: Phone,
  workflow: Workflow,
  scenario: Zap,
  flow: GitBranch,
  squad: Cpu,
};

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

function cleanDisplayName(name: string): string {
  return name.replace(/^\d+-/, "").replace(/[_-]/g, " ").trim();
}

function getCategory(platform: string): "voice" | "workflow" | "unknown" {
  if (VOICE.has(platform)) return "voice";
  if (WORKFLOW.has(platform)) return "workflow";
  return "unknown";
}

function EntityRow({
  entity,
  isSelected,
  isDisabled,
  disabledReason,
  onToggle,
}: {
  entity: EntityItem;
  isSelected: boolean;
  isDisabled: boolean;
  disabledReason: string;
  onToggle: () => void;
}) {
  const KindIcon = KIND_ICONS[entity.entity_kind] ?? GitBranch;

  return (
    <div
      onClick={isDisabled ? undefined : onToggle}
      role="checkbox"
      aria-checked={isSelected}
      aria-disabled={isDisabled}
      tabIndex={isDisabled ? -1 : 0}
      onKeyDown={(e) => {
        if (!isDisabled && (e.key === " " || e.key === "Enter")) {
          e.preventDefault();
          onToggle();
        }
      }}
      title={isDisabled ? disabledReason : undefined}
      className={`
        group flex items-center gap-3 px-4 py-3
        transition-colors duration-150
        ${
          isDisabled
            ? "cursor-not-allowed opacity-40"
            : isSelected
            ? "cursor-pointer bg-blue-50/70 border-l-2 border-l-blue-500"
            : "cursor-pointer border-l-2 border-l-transparent hover:bg-gray-50"
        }
        ${!isDisabled && !isSelected ? "border-l-2 border-l-transparent" : ""}
      `}
    >
      <div
        className={`
          flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded
          transition-all duration-150
          ${
            isDisabled
              ? "border border-gray-200 bg-gray-100"
              : isSelected
              ? "bg-blue-600 text-white"
              : "border border-gray-300 bg-white group-hover:border-gray-400"
          }
        `}
      >
        {isSelected && <Check className="h-3 w-3" strokeWidth={3} />}
        {isDisabled && !isSelected && (
          <Ban className="h-3 w-3 text-gray-400" />
        )}
      </div>

      <PlatformBadge platform={entity.platform_type} size={32} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-gray-900">
            {cleanDisplayName(entity.display_name)}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
          <KindIcon className="h-3 w-3 flex-shrink-0" />
          <span className="capitalize">{entity.entity_kind}</span>
          <span className="text-gray-300">·</span>
          <span>{getPlatformLabel(entity.platform_type)}</span>
        </div>
      </div>

      <div className="hidden flex-shrink-0 text-right sm:block">
        <span className="text-xs text-gray-400">
          {formatLastSeen(entity.last_seen_at)}
        </span>
        {entity.hasEvents === false && entity.healthStatus !== 'no-data' && entity.healthStatus !== 'critical' && (
          <span className="block text-xs text-amber-500">
            Limited detail
          </span>
        )}
      </div>
    </div>
  );
}

export default function AgentPicker({
  entities,
  loading,
  selected,
  onSelectionChange,
  onContinue,
}: AgentPickerProps) {
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && entities.length > 0) {
      searchRef.current?.focus();
    }
  }, [loading, entities.length]);

  const filtered = useMemo(() => {
    let result = entities;
    if (platformFilter !== "") {
      result = result.filter((e) => e.platform_type === platformFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((e) =>
        e.display_name.toLowerCase().includes(q)
      );
    }
    return result;
  }, [entities, platformFilter, search]);

  const platformCounts = useMemo(() => {
    const counts: Record<string, number> = { all: entities.length };
    for (const e of entities) {
      counts[e.platform_type] = (counts[e.platform_type] || 0) + 1;
    }
    return counts;
  }, [entities]);

  const visibleFilters = useMemo(
    () =>
      PLATFORM_FILTERS.filter(
        (pf) => (platformCounts[pf.value] ?? 0) > 0
      ),
    [platformCounts]
  );

  const selectedIds = useMemo(
    () => new Set(selected.map((s) => s.id)),
    [selected]
  );

  const selectedCategory = useMemo((): "voice" | "workflow" | null => {
    if (selected.length === 0) return null;
    const hasVoice = selected.some((e) => VOICE.has(e.platform));
    const hasWorkflow = selected.some((e) => WORKFLOW.has(e.platform));
    if (hasVoice) return "voice";
    if (hasWorkflow) return "workflow";
    return null;
  }, [selected]);

  // The platform of the first selected entity — all subsequent selections must match.
  const selectedPlatform = useMemo((): string | null => {
    if (selected.length === 0) return null;
    return selected[0].platform;
  }, [selected]);

  const isAtCap = selected.length >= MAX_SELECTION;
  const isNearCap = selected.length === MAX_SELECTION - 1;

  const getDisabledReason = useCallback(
    (entity: EntityItem): string => {
      if (selectedIds.has(entity.id)) return "";
      if (entity.healthStatus === 'no-data') {
        return "No activity data yet. Run this agent or workflow first, then create a portal.";
      }
      if (entity.healthStatus === 'critical') {
        return "All executions are failing. Fix issues in the Connections tab before creating a portal.";
      }
      const entityCat = getCategory(entity.platform_type);
      // Block voice+workflow cross-category mixing
      if (selectedCategory !== null && entityCat !== selectedCategory) {
        return `You cannot mix voice agents and workflows in one portal. Deselect your current ${selectedCategory} selection first.`;
      }
      // Block cross-platform mixing within voice (Vapi+Retell) or workflow (n8n+Make)
      if (selectedPlatform !== null && entity.platform_type !== selectedPlatform) {
        const platformName = selectedPlatform.charAt(0).toUpperCase() + selectedPlatform.slice(1);
        return `All agents in a portal must use the same platform. This portal is locked to ${platformName}.`;
      }
      if (isAtCap) {
        return `Maximum ${MAX_SELECTION} agents per portal. Create a second portal for additional agents.`;
      }
      return "";
    },
    [selectedIds, selectedCategory, selectedPlatform, isAtCap]
  );

  const isEntityDisabled = useCallback(
    (entity: EntityItem): boolean => {
      if (selectedIds.has(entity.id)) return false;
      return getDisabledReason(entity) !== "";
    },
    [selectedIds, getDisabledReason]
  );

  const toggleEntity = useCallback(
    (entity: EntityItem) => {
      if (isEntityDisabled(entity)) return;
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
    [selected, selectedIds, onSelectionChange, isEntityDisabled]
  );

  const selectAllVisible = useCallback(() => {
    const newSelected = [...selected];
    let count = selected.length;
    for (const entity of filtered) {
      if (count >= MAX_SELECTION) break;
      if (selectedIds.has(entity.id)) continue;
      if (isEntityDisabled(entity)) continue;
      newSelected.push({
        id: entity.id,
        sourceId: entity.source_id,
        platform: entity.platform_type,
        displayName: entity.display_name,
        entityKind: entity.entity_kind,
        externalId: entity.external_id,
      });
      count++;
    }
    onSelectionChange(newSelected);
  }, [filtered, selected, selectedIds, onSelectionChange, isEntityDisabled]);

  const clearSelection = useCallback(() => {
    onSelectionChange([]);
  }, [onSelectionChange]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-slate-900">
          Select agents or workflows
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Pick one for a single dashboard, or select up to{" "}
          {MAX_SELECTION} from the same category for a combined portal.
          Voice agents and workflows cannot be mixed.
        </p>
      </div>

      <AnimatePresence>
        {isNearCap && !isAtCap && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3 overflow-hidden"
          >
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
              <p className="text-xs text-amber-800">
                <span className="font-semibold">Almost at limit:</span>{" "}
                You can add 1 more {selectedCategory ?? "agent"} to this portal (max {MAX_SELECTION}).
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAtCap && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3 overflow-hidden"
          >
            <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <Ban className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
              <p className="text-xs text-red-800">
                <span className="font-semibold">
                  {MAX_SELECTION} agent maximum reached.
                </span>{" "}
                Create a second portal to include additional agents.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          ref={searchRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name…"
          className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-10 text-sm text-gray-900 outline-none transition-colors duration-150 placeholder:text-gray-400 focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer rounded p-0.5 text-gray-400 transition-colors duration-150 hover:text-gray-600"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {visibleFilters.map((pf) => {
          const count = platformCounts[pf.value] ?? 0;
          const isActive = platformFilter === pf.value;
          return (
            <button
              key={pf.value}
              onClick={() => setPlatformFilter(pf.value)}
              className={`
                cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium
                transition-colors duration-150
                ${
                  isActive
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }
              `}
            >
              {pf.label}
              <span className="ml-1 opacity-70">{count}</span>
            </button>
          );
        })}

        <div className="ml-auto flex items-center gap-3">
          {selected.length > 0 && (
            <button
              onClick={clearSelection}
              className="cursor-pointer text-xs font-medium text-gray-500 transition-colors duration-150 hover:text-red-600"
            >
              Clear ({selected.length})
            </button>
          )}
          {filtered.length > 0 && filtered.length <= 50 && !isAtCap && (
            <button
              onClick={selectAllVisible}
              className="cursor-pointer text-xs font-medium text-blue-600 transition-colors duration-150 hover:text-blue-700"
            >
              Select all visible
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="max-h-[55vh] divide-y divide-gray-100 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center px-4">
              <Search className="h-8 w-8 text-gray-300" />
              <p className="mt-3 text-sm font-medium text-gray-500">
                {search
                  ? `No results for "${search}"`
                  : "No entities found for this platform"}
              </p>
              {search && (
                <button
                  onClick={() => {
                    setSearch("");
                    setPlatformFilter("");
                  }}
                  className="mt-2 cursor-pointer text-xs font-medium text-blue-600 transition-colors duration-150 hover:text-blue-700"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            filtered.map((entity) => {
              const disabled = isEntityDisabled(entity);
              const reason = disabled ? getDisabledReason(entity) : "";
              return (
                <EntityRow
                  key={entity.id}
                  entity={entity}
                  isSelected={selectedIds.has(entity.id)}
                  isDisabled={disabled}
                  disabledReason={reason}
                  onToggle={() => toggleEntity(entity)}
                />
              );
            })
          )}
        </div>
      </div>

      {filtered.length > 0 && (
        <div className="mt-2 text-xs text-gray-400">
          {filtered.length} {filtered.length === 1 ? "result" : "results"}
          {filtered.length !== entities.length &&
            ` of ${entities.length} total`}
        </div>
      )}

      <AnimatePresence>
        {selected.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.15 }}
            className="mt-4 flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">
                {selected.length === 1
                  ? "1 agent selected"
                  : `${selected.length} agents selected — 1 combined portal`}
              </p>
              <p className="truncate text-xs text-gray-500">
                {selected
                  .slice(0, 3)
                  .map((s) => cleanDisplayName(s.displayName))
                  .join(", ")}
                {selected.length > 3 && ` +${selected.length - 3} more`}
              </p>
            </div>
            {onContinue && (
              <button
                onClick={onContinue}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-blue-700"
              >
                Continue
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
