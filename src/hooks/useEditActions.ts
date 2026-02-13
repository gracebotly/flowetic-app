"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type {
  EditAction,
  ChartType,
  Density,
  UseEditActionsOptions,
  UseEditActionsReturn,
} from "@/components/vibe/editor";

const DEBOUNCE_MS = 500;

export function useEditActions({
  tenantId,
  userId,
  interfaceId,
  platformType,
  onSuccess,
  onError,
}: UseEditActionsOptions): UseEditActionsReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [pendingActions, setPendingActions] = useState<EditAction[]>([]);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Execute pending actions via API
  const executePendingActions = useCallback(
    async (actions: EditAction[]) => {
      if (actions.length === 0) return;

      setIsLoading(true);
      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            toolCall: {
              toolName: "applyInteractiveEdits",
              args: {
                tenantId,
                userId,
                interfaceId,
                platformType,
                actions,
              },
            },
          }),
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const result = await response.json();

        if (result.previewUrl) {
          onSuccess?.({
            previewUrl: result.previewUrl,
            previewVersionId: result.previewVersionId,
          });
        }
      } catch (error) {
        console.error("[useEditActions] Error executing actions:", error);
        onError?.(error instanceof Error ? error : new Error(String(error)));
      } finally {
        setIsLoading(false);
      }
    },
    [tenantId, userId, interfaceId, platformType, onSuccess, onError]
  );

  // Debounced batch execution
  const scheduleBatch = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setPendingActions((current) => {
        if (current.length > 0) {
          executePendingActions(current);
        }
        return [];
      });
    }, DEBOUNCE_MS);
  }, [executePendingActions]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Add action to pending queue
  const addAction = useCallback(
    (action: EditAction) => {
      setPendingActions((current) => {
        // Dedupe: Replace existing action of same type for same widget
        const filtered = current.filter(
          (a) =>
            !(a.type === action.type && a.widgetId === action.widgetId)
        );
        return [...filtered, action];
      });
      scheduleBatch();
    },
    [scheduleBatch]
  );

  // Action methods
  const toggleWidget = useCallback(
    (widgetId: string) => {
      addAction({ type: "toggle_widget", widgetId });
    },
    [addAction]
  );

  const renameWidget = useCallback(
    (widgetId: string, title: string) => {
      addAction({ type: "rename_widget", widgetId, title });
    },
    [addAction]
  );

  const changeChartType = useCallback(
    (widgetId: string, chartType: ChartType) => {
      addAction({ type: "switch_chart_type", widgetId, chartType });
    },
    [addAction]
  );

  const setDensity = useCallback(
    (density: Density) => {
      addAction({ type: "set_density", density });
    },
    [addAction]
  );

  const setPalette = useCallback(
    (paletteId: string) => {
      addAction({ type: "set_palette", paletteId });
    },
    [addAction]
  );

  const reorderWidgets = useCallback(
    (order: string[]) => {
      addAction({ type: "reorder_widgets", order });
    },
    [addAction]
  );

  // Immediately flush all pending actions
  const flushPendingActions = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const actions = pendingActions;
    setPendingActions([]);
    await executePendingActions(actions);
  }, [pendingActions, executePendingActions]);

  return {
    toggleWidget,
    renameWidget,
    changeChartType,
    setDensity,
    setPalette,
    reorderWidgets,
    isLoading,
    pendingActions,
    flushPendingActions,
  };
}
