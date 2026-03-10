"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DateRangePicker } from "@/components/activity/DateRangePicker";
import { ExportButton } from "@/components/activity/ExportButton";
import { RetentionBadge } from "@/components/activity/RetentionBadge";
import type { ActivityFilters } from "@/lib/activity/filterHelpers";
import { getDateRangePreset, hasActiveFilters } from "@/lib/activity/filterHelpers";

interface FilterBarProps {
  filters: ActivityFilters;
  onFiltersChange: (filters: ActivityFilters) => void;
}

const CATEGORIES = [
  { value: "", label: "All Categories" },
  { value: "connection", label: "Connections" },
  { value: "portal", label: "Client Portals" },
  { value: "client", label: "Clients" },
  { value: "execution", label: "Executions" },
  { value: "access", label: "Access" },
  { value: "team", label: "Team" },
  { value: "settings", label: "Settings" },
  { value: "billing", label: "Billing" },
];

const STATUSES = [
  { value: "", label: "All Status" },
  { value: "success", label: "Success" },
  { value: "warning", label: "Warning" },
  { value: "error", label: "Error" },
  { value: "info", label: "Info" },
];

interface DropdownOption {
  id: string;
  name: string;
}

export function FilterBar({ filters, onFiltersChange }: FilterBarProps) {
  const [clients, setClients] = useState<DropdownOption[]>([]);
  const [offerings, setOfferings] = useState<DropdownOption[]>([]);
  const [searchInput, setSearchInput] = useState(filters.search ?? "");
  const [datePreset, setDatePreset] = useState<string | null>(null);

  // ── Load clients + offerings for dropdowns ────────────────
  useEffect(() => {
    async function loadOptions() {
      try {
        // Fetch clients via API (matches existing pattern)
        const clientRes = await fetch("/api/clients");
        if (clientRes.ok) {
          const clientJson = await clientRes.json();
          if (clientJson.ok && clientJson.clients) {
            setClients(
              clientJson.clients.map((c: { id: string; name: string }) => ({
                id: c.id,
                name: c.name,
              })),
            );
          }
        }

        // Fetch offerings via Supabase client (matches offerings page pattern)
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;

        const { data: membership } = await supabase
          .from("memberships")
          .select("tenant_id")
          .eq("user_id", session.user.id)
          .single();

        if (!membership) return;

        const { data: offeringRows } = await supabase
          .from("client_portals")
          .select("id, name")
          .eq("tenant_id", membership.tenant_id)
          .neq("status", "archived")
          .order("name", { ascending: true });

        setOfferings(
          (offeringRows ?? []).map((o: { id: string; name: string }) => ({
            id: o.id,
            name: o.name,
          })),
        );
      } catch {
        // Non-critical — filters still work without dropdown options
      }
    }
    loadOptions();
  }, []);

  // ── Helpers ───────────────────────────────────────────────
  const update = (partial: Partial<ActivityFilters>) => {
    onFiltersChange({ ...filters, ...partial });
  };

  const handleSearchSubmit = () => {
    update({ search: searchInput.trim() || null });
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearchSubmit();
  };

  const handlePresetSelect = (preset: "1h" | "24h" | "7d" | "30d" | "90d") => {
    const range = getDateRangePreset(preset);
    setDatePreset(preset);
    update({ from: range.from, to: range.to });
  };

  const handleCustomRange = (from: string, to: string) => {
    setDatePreset(null);
    update({ from, to });
  };

  const handleClearDateRange = () => {
    setDatePreset(null);
    update({ from: null, to: null });
  };

  const handleClearAll = () => {
    setSearchInput("");
    setDatePreset(null);
    onFiltersChange({
      category: null,
      status: null,
      clientId: null,
      offeringId: null,
      from: null,
      to: null,
      search: null,
    });
  };

  const isActive = hasActiveFilters(filters);

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white px-5 py-4">
      {/* Row 1: Dropdowns */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Category */}
        <select
          value={filters.category ?? ""}
          onChange={(e) => update({ category: e.target.value || null })}
          className="rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-200"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>

        {/* Status */}
        <select
          value={filters.status ?? ""}
          onChange={(e) => update({ status: e.target.value || null })}
          className="rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-200"
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        {/* Client */}
        <select
          value={filters.clientId ?? ""}
          onChange={(e) => update({ clientId: e.target.value || null })}
          className="rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-200"
        >
          <option value="">All Clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {/* Offering */}
        <select
          value={filters.offeringId ?? ""}
          onChange={(e) => update({ offeringId: e.target.value || null })}
          className="rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-200"
        >
          <option value="">All Client Portals</option>
          {offerings.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>

        {/* Search */}
        <div className="relative flex items-center">
          <Search className="absolute left-2.5 h-3 w-3 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            onBlur={handleSearchSubmit}
            placeholder="Search events..."
            className="rounded-md border border-gray-200 bg-gray-50 py-1.5 pl-7 pr-3 text-xs text-gray-700 outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-200"
            style={{ width: 160 }}
          />
          {searchInput && (
            <button
              onClick={() => {
                setSearchInput("");
                update({ search: null });
              }}
              className="absolute right-2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Clear all */}
        {isActive && (
          <button
            onClick={handleClearAll}
            className="rounded-md px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 transition"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Row 2: Date range + Retention badge + Export */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <DateRangePicker
            from={filters.from}
            to={filters.to}
            activePreset={datePreset}
            onPresetSelect={handlePresetSelect}
            onCustomRange={handleCustomRange}
            onClear={handleClearDateRange}
          />
          <RetentionBadge />
        </div>

        <ExportButton filters={filters} />
      </div>
    </div>
  );
}
