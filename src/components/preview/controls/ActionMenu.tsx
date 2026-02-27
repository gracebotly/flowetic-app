"use client";

import React, { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as LucideIcons from "lucide-react";
import { getActionsForComponent, hasActions, getDrillDownContext } from "@/lib/actions/actionRegistry";
import { executeAction } from "@/lib/actions/actionHandlers";
import type { ActionId, ActionContext, ActionResult } from "@/lib/actions/actionRegistry";

interface ActionMenuProps {
  componentId: string;
  componentType: string;
  componentTitle?: string;
  componentProps?: Record<string, any>;
  events: any[];
  filteredEvents: any[];
  dashboardTitle?: string;
  onDrillDown?: (result: ActionResult) => void;
  onRefresh?: () => void;
  onToast?: (message: string, success: boolean) => void;
}

export function ActionMenu({
  componentId,
  componentType,
  componentTitle,
  componentProps,
  events,
  filteredEvents,
  dashboardTitle,
  onDrillDown,
  onRefresh,
  onToast,
}: ActionMenuProps) {
  const [loadingAction, setLoadingAction] = useState<ActionId | null>(null);

  if (!hasActions(componentType)) return null;

  const actions = getActionsForComponent(componentType);

  async function handleAction(actionId: ActionId) {
    setLoadingAction(actionId);

    if (actionId === "refresh-data" && onRefresh) {
      onRefresh();
      onToast?.("Refreshing...", true);
      setLoadingAction(null);
      return;
    }

    const drillCtx = componentProps ? getDrillDownContext(componentType, componentProps) : {};

    const context: ActionContext = {
      componentId,
      componentType,
      componentTitle,
      componentProps,
      events,
      filteredEvents,
      dashboardTitle,
      dashboardRootEl: document.querySelector("[data-dashboard-root]") as HTMLElement | null,
      filterKey: drillCtx.filterKey,
      filterValue: drillCtx.filterValue,
    };

    const result = await executeAction(actionId, context);
    setLoadingAction(null);

    if (actionId === "drill-down" && onDrillDown) {
      onDrillDown(result);
      return;
    }

    if (actionId === "filter-by-value" && onDrillDown && result.filteredEvents) {
      onDrillDown(result);
      return;
    }

    onToast?.(result.message, result.success);
  }

  return (
    <div className="absolute top-1.5 right-1.5 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            className="p-1.5 rounded-md transition-all duration-150 hover:scale-105"
            style={{
              backgroundColor: "var(--gf-surface, #ffffff)",
              border: "1px solid var(--gf-border, #e5e7eb)",
              color: "var(--gf-muted, #6b7280)",
              boxShadow: "var(--gf-shadow, 0 1px 3px rgba(0,0,0,0.08))",
            }}
            aria-label="Component actions"
          >
            <LucideIcons.MoreHorizontal size={14} />
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="min-w-[160px] rounded-lg py-1 shadow-xl z-50"
            style={{
              backgroundColor: "var(--gf-surface, #ffffff)",
              border: "1px solid var(--gf-border, #e5e7eb)",
            }}
            sideOffset={4}
            align="end"
          >
            {actions.map((action) => {
              const IconComponent = (LucideIcons as any)[action.icon] || LucideIcons.Zap;
              const isLoading = loadingAction === action.id;

              return (
                <DropdownMenu.Item
                  key={action.id}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs cursor-pointer outline-none transition-colors duration-75"
                  style={{ color: "var(--gf-text, #111827)" }}
                  onSelect={(e) => {
                    if (isLoading) {
                      e.preventDefault();
                      return;
                    }
                    handleAction(action.id);
                  }}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <LucideIcons.Loader2 size={13} className="animate-spin shrink-0" style={{ color: "var(--gf-muted, #6b7280)" }} />
                  ) : (
                    <IconComponent size={13} className="shrink-0" style={{ color: "var(--gf-muted, #6b7280)" }} />
                  )}
                  <span className="flex-1">{action.label}</span>
                  {action.shortcut && (
                    <span className="text-[10px] ml-2" style={{ color: "var(--gf-muted, #6b7280)" }}>
                      {action.shortcut}
                    </span>
                  )}
                </DropdownMenu.Item>
              );
            })}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}
