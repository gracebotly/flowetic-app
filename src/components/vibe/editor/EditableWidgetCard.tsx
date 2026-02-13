"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { GripVertical, Eye, EyeOff, Pencil, Check, X, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
import type { WidgetConfig, WidgetKind, ChartType } from "./types";

interface EditableWidgetCardProps {
  widget: WidgetConfig;
  onToggle: (widgetId: string) => void;
  onRename: (widgetId: string, title: string) => void;
  onChartTypeChange?: (widgetId: string, chartType: ChartType) => void;
  isDragging?: boolean;
}

const WIDGET_ICONS: Record<WidgetKind, React.ReactNode> = {
  metric: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  ),
  chart: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3v18h18" />
      <path d="M7 16l4-4 4 4 5-6" />
    </svg>
  ),
  table: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    </svg>
  ),
  other: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
    </svg>
  ),
};

const CHART_TYPES: { value: ChartType; label: string }[] = [
  { value: "line", label: "Line" },
  { value: "bar", label: "Bar" },
  { value: "area", label: "Area" },
  { value: "pie", label: "Pie" },
  { value: "donut", label: "Donut" },
];

export function EditableWidgetCard({
  widget,
  onToggle,
  onRename,
  onChartTypeChange,
  isDragging = false,
}: EditableWidgetCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(widget.title);
  const [showChartMenu, setShowChartMenu] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Close chart menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowChartMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSave = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== widget.title) {
      onRename(widget.id, trimmed);
    } else {
      setEditValue(widget.title);
    }
    setIsEditing(false);
  }, [editValue, widget.id, widget.title, onRename]);

  const handleCancel = useCallback(() => {
    setEditValue(widget.title);
    setIsEditing(false);
  }, [widget.title]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSave();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      }
    },
    [handleSave, handleCancel]
  );

  return (
    <motion.div
      layout
      className={`
        group flex items-center gap-3 p-3 rounded-lg border
        transition-colors duration-200
        ${isDragging ? "bg-blue-50 border-blue-300 shadow-lg" : "bg-white border-gray-200 hover:border-gray-300"}
        ${!widget.enabled ? "opacity-60" : ""}
      `}
      style={{ minHeight: "56px" }}
    >
      {/* Drag Handle */}
      <div
        className="flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-5 h-5" />
      </div>

      {/* Widget Icon */}
      <div
        className={`
          flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center
          ${widget.enabled ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-400"}
          transition-colors duration-200
        `}
      >
        {WIDGET_ICONS[widget.kind]}
      </div>

      {/* Title / Edit Input */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleSave}
              className="flex-1 px-2 py-1 text-sm font-medium text-gray-900 bg-white border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Widget title"
            />
            <button
              type="button"
              onClick={handleSave}
              className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
              aria-label="Save"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="p-1 text-gray-500 hover:bg-gray-100 rounded transition-colors"
              aria-label="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 truncate">
              {widget.title}
            </span>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded opacity-0 group-hover:opacity-100 transition-all"
              aria-label="Edit title"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Chart Type Dropdown (only for chart widgets) */}
      {widget.kind === "chart" && onChartTypeChange && (
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setShowChartMenu(!showChartMenu)}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
            aria-label="Change chart type"
            aria-expanded={showChartMenu}
          >
            {widget.chartType || "line"}
            <ChevronDown className={`w-3 h-3 transition-transform ${showChartMenu ? "rotate-180" : ""}`} />
          </button>
          {showChartMenu && (
            <div className="absolute right-0 top-full mt-1 w-28 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1">
              {CHART_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => {
                    onChartTypeChange(widget.id, type.value);
                    setShowChartMenu(false);
                  }}
                  className={`
                    w-full px-3 py-1.5 text-left text-sm cursor-pointer
                    ${widget.chartType === type.value ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700 hover:bg-gray-50"}
                    transition-colors
                  `}
                >
                  {type.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Toggle Switch */}
      <button
        type="button"
        onClick={() => onToggle(widget.id)}
        className={`
          relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent
          transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          ${widget.enabled ? "bg-blue-600" : "bg-gray-200"}
        `}
        role="switch"
        aria-checked={widget.enabled}
        aria-label={`Toggle ${widget.title} visibility`}
      >
        <span
          className={`
            pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0
            transition duration-200 ease-in-out
            ${widget.enabled ? "translate-x-5" : "translate-x-0"}
          `}
        >
          {widget.enabled ? (
            <Eye className="w-3 h-3 m-1 text-blue-600" />
          ) : (
            <EyeOff className="w-3 h-3 m-1 text-gray-400" />
          )}
        </span>
      </button>
    </motion.div>
  );
}
