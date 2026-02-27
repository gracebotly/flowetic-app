// src/lib/actions/actionHandlers.ts
//
// Level 3: Pure action handler functions.
// Each receives ActionContext and returns Promise<ActionResult>.

import type { ActionId, ActionContext, ActionResult } from "./actionRegistry";

async function handleExportCSV(ctx: ActionContext): Promise<ActionResult> {
  const events = ctx.filteredEvents.length > 0 ? ctx.filteredEvents : ctx.events;
  if (events.length === 0) {
    return { success: false, message: "No data to export" };
  }

  const headers = Object.keys(events[0]);
  const csvRows = [
    headers.join(","),
    ...events.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          const str = val == null ? "" : String(val);
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(",")
    ),
  ];

  const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = new Date().toISOString().split("T")[0];
  const title = ctx.componentTitle || ctx.dashboardTitle || "dashboard";
  link.href = url;
  link.download = `${title.replace(/\s+/g, "-").toLowerCase()}-${date}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return { success: true, message: `Exported ${events.length} rows` };
}

async function handleExportPDF(ctx: ActionContext): Promise<ActionResult> {
  const root = ctx.dashboardRootEl ?? document.querySelector("[data-dashboard-root]");
  if (!root) {
    return { success: false, message: "Dashboard element not found" };
  }

  try {
    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);

    const canvas = await html2canvas(root as HTMLElement, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: null,
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "px",
      format: [canvas.width / 2, canvas.height / 2],
    });

    pdf.addImage(imgData, "PNG", 0, 0, canvas.width / 2, canvas.height / 2);
    const date = new Date().toISOString().split("T")[0];
    const title = ctx.dashboardTitle || "dashboard";
    pdf.save(`${title.replace(/\s+/g, "-").toLowerCase()}-${date}.pdf`);

    return { success: true, message: "PDF downloaded" };
  } catch (err) {
    console.error("[actionHandlers] PDF export failed:", err);
    return { success: false, message: "PDF export failed" };
  }
}

async function handleDrillDown(ctx: ActionContext): Promise<ActionResult> {
  const { filterKey, filterValue, events } = ctx;

  if (!filterKey) {
    return {
      success: true,
      message: `Showing all ${events.length} events`,
      filteredEvents: events,
    };
  }

  if (!filterValue) {
    const filtered = events.filter((e) => e[filterKey] != null);
    return {
      success: true,
      message: `Showing ${filtered.length} events with ${filterKey}`,
      filteredEvents: filtered,
      appliedFilter: { key: filterKey, value: "(exists)" },
    };
  }

  const filtered = events.filter((e) => String(e[filterKey]) === String(filterValue));

  return {
    success: true,
    message: `Filtered to ${filtered.length} events where ${filterKey} = ${filterValue}`,
    filteredEvents: filtered,
    appliedFilter: { key: filterKey, value: filterValue },
  };
}

async function handleShareLink(): Promise<ActionResult> {
  const url = window.location.href;
  try {
    await navigator.clipboard.writeText(url);
    return { success: true, message: "Link copied to clipboard" };
  } catch {
    return { success: false, message: "Failed to copy link" };
  }
}

async function handleCopyValue(ctx: ActionContext): Promise<ActionResult> {
  const { componentType, componentProps, events } = ctx;
  let value: string | number = "";

  if ((componentType === "MetricCard" || componentType === "InsightCard") && componentProps?.valueField) {
    const valueField = componentProps.valueField;
    const aggregation = componentProps.aggregation || "count";
    const values = events.map((e) => e[valueField]).filter((v) => v != null);

    switch (aggregation) {
      case "count":
        value = values.length;
        break;
      case "sum":
        value = values.reduce((a: number, b: any) => a + Number(b), 0);
        break;
      case "avg":
      case "average": {
        const nums = values.map(Number).filter((n) => !isNaN(n));
        value = nums.length > 0 ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100 : "—";
        break;
      }
      case "min": {
        const nums = values.map(Number).filter((n) => !isNaN(n));
        value = nums.length > 0 ? Math.min(...nums) : "—";
        break;
      }
      case "max": {
        const nums = values.map(Number).filter((n) => !isNaN(n));
        value = nums.length > 0 ? Math.max(...nums) : "—";
        break;
      }
      case "latest":
      case "last":
        value = values.length > 0 ? String(values[values.length - 1]) : "—";
        break;
      default:
        value = values.length;
    }
  } else if (componentProps?.computedValue != null) {
    value = componentProps.computedValue;
  } else {
    value = `${events.length} events`;
  }

  const displayValue = String(value);
  try {
    await navigator.clipboard.writeText(displayValue);
    return { success: true, message: `Copied: ${displayValue.slice(0, 60)}` };
  } catch {
    return { success: false, message: "Failed to copy" };
  }
}

async function handleFilterByValue(ctx: ActionContext): Promise<ActionResult> {
  if (!ctx.filterKey || !ctx.filterValue) {
    return { success: false, message: "No filter criteria specified" };
  }
  const filtered = ctx.events.filter((e) => String(e[ctx.filterKey!]) === String(ctx.filterValue));
  return {
    success: true,
    message: `Filtered ${filtered.length} events by ${ctx.filterKey} = ${ctx.filterValue}`,
    filteredEvents: filtered,
    appliedFilter: { key: ctx.filterKey, value: ctx.filterValue },
  };
}

async function handleRefreshData(): Promise<ActionResult> {
  return { success: true, message: "Refreshing data..." };
}

async function handleTriggerWorkflow(): Promise<ActionResult> {
  return { success: false, message: "Workflow execution coming in Level 4" };
}

async function handleNavigate(): Promise<ActionResult> {
  return { success: false, message: "Navigation coming in Level 4" };
}

async function handleSelectPlan(): Promise<ActionResult> {
  return { success: false, message: "Plan selection coming in Level 4" };
}

const HANDLERS: Record<ActionId, (ctx: ActionContext, params?: any) => Promise<ActionResult>> = {
  "export-csv": handleExportCSV,
  "export-pdf": handleExportPDF,
  "drill-down": handleDrillDown,
  "share-link": handleShareLink,
  "copy-value": handleCopyValue,
  "filter-by-value": handleFilterByValue,
  "refresh-data": handleRefreshData,
  "trigger-workflow": handleTriggerWorkflow,
  navigate: handleNavigate,
  "select-plan": handleSelectPlan,
};

export async function executeAction(
  actionId: ActionId,
  context: ActionContext,
  params?: Record<string, any>
): Promise<ActionResult> {
  const handler = HANDLERS[actionId];
  if (!handler) {
    return { success: false, message: `Unknown action: ${actionId}` };
  }
  return handler(context, params);
}
