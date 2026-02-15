"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Layers, Palette, Settings, GripHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import { EditableWidgetCard } from "./EditableWidgetCard";
import { DragDropContainer } from "./DragDropContainer";
import { DensitySelector } from "./DensitySelector";
import { PalettePicker } from "./PalettePicker";
import { StyleTokensPanel } from "./StyleTokensPanel";
import type { WidgetConfig, Palette as PaletteType, Density, ChartType } from "./types";

type Tab = "widgets" | "style" | "layout";

interface InteractiveEditPanelProps {
  // Data
  interfaceId: string;
  widgets: WidgetConfig[];
  palettes: PaletteType[];
  selectedPaletteId: string | null;
  density: Density;
  borderRadius?: number;
  shadowIntensity?: "none" | "subtle" | "medium" | "strong";

  // State
  isOpen: boolean;
  isMobile?: boolean;
  isLoading?: boolean;

  // Callbacks
  onClose: () => void;
  onToggleWidget: (widgetId: string) => void;
  onRenameWidget: (widgetId: string, title: string) => void;
  onChartTypeChange: (widgetId: string, chartType: ChartType) => void;
  onReorderWidgets: (widgets: WidgetConfig[]) => void;
  onDensityChange: (density: Density) => void;
  onPaletteChange: (paletteId: string) => void;
  onBorderRadiusChange?: (value: number) => void;
  onShadowChange?: (value: "none" | "subtle" | "medium" | "strong") => void;
}

const TABS: { value: Tab; label: string; icon: React.ElementType }[] = [
  { value: "widgets", label: "Widgets", icon: Layers },
  { value: "style", label: "Style", icon: Palette },
  { value: "layout", label: "Layout", icon: Settings },
];

// Mobile bottom sheet component
function MobileSheet({
  isOpen,
  onClose,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  // Prevent body scroll when sheet is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-40"
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-2xl max-h-[85vh] flex flex-col"
          >
            {/* Drag handle */}
            <div className="flex justify-center py-3">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 pb-safe">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Desktop side panel component — collapsible
function DesktopPanel({
  isOpen,
  onClose,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  // Reset collapsed state when panel opens
  useEffect(() => {
    if (isOpen) {
      setCollapsed(false);
    }
  }, [isOpen]);
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: "100%", opacity: 0 }}
          animate={{
            x: 0,
            opacity: 1,
            width: collapsed ? 48 : 320,
          }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed top-0 right-0 bottom-0 bg-white border-l border-gray-200 shadow-xl z-40 flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-2 py-3 border-b border-gray-200 min-h-[52px]">
            {!collapsed && (
              <h2 className="text-lg font-semibold text-gray-900 pl-2 truncate">
                Edit Dashboard
              </h2>
            )}
            <div className={`flex items-center gap-1 ${collapsed ? "mx-auto" : ""}`}>
              <button
                type="button"
                onClick={() => setCollapsed((prev) => !prev)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors"
                aria-label={collapsed ? "Expand panel" : "Collapse panel"}
              >
                {collapsed ? (
                  <ChevronLeft className="w-5 h-5" />
                ) : (
                  <ChevronRight className="w-5 h-5" />
                )}
              </button>
              {!collapsed && (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors"
                  aria-label="Close panel"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
          {/* Content — hidden when collapsed */}
          {!collapsed && (
            <div className="flex-1 overflow-y-auto">
              {children}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function InteractiveEditPanel({
  interfaceId,
  widgets,
  palettes,
  selectedPaletteId,
  density,
  borderRadius = 8,
  shadowIntensity = "subtle",
  isOpen,
  isMobile = false,
  isLoading = false,
  onClose,
  onToggleWidget,
  onRenameWidget,
  onChartTypeChange,
  onReorderWidgets,
  onDensityChange,
  onPaletteChange,
  onBorderRadiusChange,
  onShadowChange,
}: InteractiveEditPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("widgets");

  // Reset to widgets tab when panel opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab("widgets");
    }
  }, [isOpen]);

  const handleReorder = (reorderedWidgets: WidgetConfig[]) => {
    onReorderWidgets(reorderedWidgets);
  };

  const panelContent = (
    <>
      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.value;

          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={`
                flex-1 flex items-center justify-center gap-2 px-4 py-3 cursor-pointer
                text-sm font-medium transition-colors relative
                ${isActive ? "text-blue-600" : "text-gray-500 hover:text-gray-700"}
              `}
              aria-selected={isActive}
              role="tab"
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {isActive && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"
                  initial={false}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="p-4">
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
            <div className="flex items-center gap-2 text-gray-600">
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm">Applying changes...</span>
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {activeTab === "widgets" && (
            <motion.div
              key="widgets"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
            >
              <div className="mb-3">
                <p className="text-sm text-gray-500">
                  Drag to reorder, toggle visibility, or rename widgets.
                </p>
              </div>
              {widgets.length === 0 ? (
                <p className="text-sm text-gray-400 italic py-4 text-center">
                  No widgets in this dashboard
                </p>
              ) : (
                <DragDropContainer
                  items={widgets}
                  onReorder={handleReorder}
                  renderItem={(widget, isDragging) => (
                    <EditableWidgetCard
                      widget={widget}
                      onToggle={onToggleWidget}
                      onRename={onRenameWidget}
                      onChartTypeChange={widget.kind === "chart" ? onChartTypeChange : undefined}
                      isDragging={isDragging}
                    />
                  )}
                />
              )}
            </motion.div>
          )}

          {activeTab === "style" && (
            <motion.div
              key="style"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="space-y-6"
            >
              <PalettePicker
                palettes={palettes}
                selectedId={selectedPaletteId}
                onChange={onPaletteChange}
              />
              {onBorderRadiusChange && onShadowChange && (
                <StyleTokensPanel
                  borderRadius={borderRadius}
                  shadowIntensity={shadowIntensity}
                  onBorderRadiusChange={onBorderRadiusChange}
                  onShadowChange={onShadowChange}
                />
              )}
            </motion.div>
          )}

          {activeTab === "layout" && (
            <motion.div
              key="layout"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
            >
              <DensitySelector
                value={density}
                onChange={onDensityChange}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );

  // Render mobile or desktop version
  if (isMobile) {
    return (
      <MobileSheet isOpen={isOpen} onClose={onClose}>
        {panelContent}
      </MobileSheet>
    );
  }

  return (
    <DesktopPanel isOpen={isOpen} onClose={onClose}>
      {panelContent}
    </DesktopPanel>
  );
}
