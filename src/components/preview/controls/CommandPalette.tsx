"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import * as LucideIcons from "lucide-react";
import { getActionsForComponent, getDrillDownContext } from "@/lib/actions/actionRegistry";
import { executeAction } from "@/lib/actions/actionHandlers";
import type { ActionId, ActionContext, ActionResult } from "@/lib/actions/actionRegistry";

interface CommandItem {
  id: string;
  label: string;
  description: string;
  icon: string;
  category: string;
  shortcut?: string;
  execute: () => Promise<void>;
}

interface CommandPaletteProps {
  components: Array<{ id: string; type: string; props?: Record<string, any> }>;
  events: any[];
  filteredEvents: any[];
  dashboardTitle?: string;
  onDrillDown?: (result: ActionResult) => void;
  onRefresh?: () => void;
  onToast?: (message: string, success: boolean) => void;
}

export function CommandPalette({
  components,
  events,
  filteredEvents,
  dashboardTitle,
  onDrillDown,
  onRefresh,
  onToast,
}: CommandPaletteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands: CommandItem[] = useMemo(() => {
    const items: CommandItem[] = [];

    for (const comp of components) {
      const actions = getActionsForComponent(comp.type);
      const title = comp.props?.title || comp.props?.label || comp.type;
      const drillCtx = comp.props ? getDrillDownContext(comp.type, comp.props) : {};

      for (const action of actions) {
        items.push({
          id: `${comp.id}-${action.id}`,
          label: `${action.label}: ${title}`,
          description: `${comp.type} → ${action.label}`,
          icon: action.icon,
          category: action.category,
          shortcut: action.shortcut,
          execute: async () => {
            const context: ActionContext = {
              componentId: comp.id,
              componentType: comp.type,
              componentTitle: title,
              componentProps: comp.props,
              events,
              filteredEvents,
              dashboardTitle,
              dashboardRootEl: document.querySelector("[data-dashboard-root]") as HTMLElement | null,
              filterKey: drillCtx.filterKey,
              filterValue: drillCtx.filterValue,
            };

            if (action.id === "refresh-data" && onRefresh) {
              onRefresh();
              onToast?.("Refreshing...", true);
              return;
            }

            const result = await executeAction(action.id as ActionId, context);

            if ((action.id === "drill-down" || action.id === "filter-by-value") && onDrillDown) {
              onDrillDown(result);
              return;
            }

            onToast?.(result.message, result.success);
          },
        });
      }
    }

    items.push({
      id: "global-export-pdf",
      label: "Export Dashboard as PDF",
      description: "Full dashboard → PDF",
      icon: "FileText",
      category: "data",
      execute: async () => {
        const context: ActionContext = {
          componentId: "dashboard",
          componentType: "Dashboard",
          dashboardTitle,
          events,
          filteredEvents,
          dashboardRootEl: document.querySelector("[data-dashboard-root]") as HTMLElement | null,
        };
        const result = await executeAction("export-pdf", context);
        onToast?.(result.message, result.success);
      },
    });

    items.push({
      id: "global-share-link",
      label: "Copy Dashboard Link",
      description: "Copy URL to clipboard",
      icon: "Link",
      category: "share",
      shortcut: "⌘L",
      execute: async () => {
        const context: ActionContext = {
          componentId: "dashboard",
          componentType: "Dashboard",
          dashboardTitle,
          events,
          filteredEvents,
        };
        const result = await executeAction("share-link", context);
        onToast?.(result.message, result.success);
      },
    });

    return items;
  }, [components, events, filteredEvents, dashboardTitle, onDrillDown, onRefresh, onToast]);

  const filtered = useMemo(() => {
    if (!search.trim()) return commands;
    const q = search.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(q) ||
        cmd.description.toLowerCase().includes(q) ||
        cmd.category.toLowerCase().includes(q)
    );
  }, [commands, search]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        setSearch("");
        setSelectedIndex(0);
      }
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && filtered[selectedIndex]) {
        e.preventDefault();
        filtered[selectedIndex].execute();
        setIsOpen(false);
      }
    },
    [filtered, selectedIndex]
  );

  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={() => setIsOpen(false)}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-lg rounded-xl overflow-hidden shadow-2xl"
        style={{
          backgroundColor: "var(--gf-surface, #ffffff)",
          border: "1px solid var(--gf-border, #e5e7eb)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--gf-border, #e5e7eb)" }}>
          <LucideIcons.Search size={16} style={{ color: "var(--gf-muted, #6b7280)" }} />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search actions..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:opacity-50"
            style={{ color: "var(--gf-text, #111827)", fontFamily: "var(--gf-font-body, inherit)" }}
          />
          <kbd
            className="text-[10px] px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: "var(--gf-background, #f9fafb)",
              border: "1px solid var(--gf-border, #e5e7eb)",
              color: "var(--gf-muted, #6b7280)",
            }}
          >
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="max-h-72 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--gf-muted, #6b7280)" }}>
              No actions found
            </div>
          ) : (
            filtered.map((cmd, idx) => {
              const IconComponent = (LucideIcons as any)[cmd.icon] || LucideIcons.Zap;
              const isSelected = idx === selectedIndex;

              return (
                <button
                  key={cmd.id}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-75"
                  style={{
                    backgroundColor: isSelected ? "var(--gf-primary, #3b82f6)" : "transparent",
                    color: isSelected ? "#ffffff" : "var(--gf-text, #111827)",
                  }}
                  onClick={() => {
                    cmd.execute();
                    setIsOpen(false);
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <IconComponent
                    size={14}
                    style={{ color: isSelected ? "#ffffff" : "var(--gf-muted, #6b7280)" }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{cmd.label}</div>
                    <div
                      className="text-xs truncate"
                      style={{ color: isSelected ? "rgba(255,255,255,0.7)" : "var(--gf-muted, #6b7280)" }}
                    >
                      {cmd.description}
                    </div>
                  </div>
                  {cmd.shortcut && (
                    <kbd
                      className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
                      style={{
                        backgroundColor: isSelected ? "rgba(255,255,255,0.2)" : "var(--gf-background, #f9fafb)",
                        border: isSelected ? "1px solid rgba(255,255,255,0.3)" : "1px solid var(--gf-border, #e5e7eb)",
                        color: isSelected ? "#ffffff" : "var(--gf-muted, #6b7280)",
                      }}
                    >
                      {cmd.shortcut}
                    </kbd>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div
          className="flex items-center justify-between px-4 py-2 text-[10px]"
          style={{ borderTop: "1px solid var(--gf-border, #e5e7eb)", color: "var(--gf-muted, #6b7280)" }}
        >
          <span>↑↓ Navigate &nbsp;·&nbsp; ↵ Execute &nbsp;·&nbsp; ESC Close</span>
          <span>
            {filtered.length} action{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
