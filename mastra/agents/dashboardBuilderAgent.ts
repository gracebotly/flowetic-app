import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
// import { RequestContext } from "@mastra/core/request-context"; // Removed - invalid import
import {
  getCurrentSpec,
  applySpecPatch,
  savePreviewVersion,
} from "../tools/specEditor";
import { validateSpec } from "../tools/validateSpec";
import { todoAdd, todoList, todoUpdate, todoComplete } from "../tools/todo";
import { getStyleBundles } from "../tools/design";

export const dashboardBuilderAgent = new Agent({
  id: "dashboard-builder-agent",
  name: "dashboardBuilderAgent",
  description:
    "Dashboard Builder Agent: applies safe, incremental edits to an existing dashboard spec and persists validated preview versions.",
  instructions: async ({ runtimeContext, mastra }: { runtimeContext: any; mastra?: any }) => {
    const mode = (runtimeContext.get ? runtimeContext.get("mode") : undefined) ?? "edit";
    const phase = (runtimeContext.get ? runtimeContext.get("phase") : undefined) ?? "editing";
    const platformType = (runtimeContext.get ? runtimeContext.get("platformType") : undefined) ?? "make";

    return [
      {
        role: "system",
        content:
          "You are the Dashboard Builder Agent (Spec Editor) for GetFlowetic. " +
          "You own the dashboard spec language and all incremental 'vibe coding' edits. " +
          "CRITICAL RULES: Never ask the user for tenantId, sourceId, interfaceId, threadId, versionId, or any UUID. Never mention internal IDs. " +
          "Always use tools to read/modify/persist specs. Never hand-edit JSON in your reply. " +
          "Never show raw spec JSON unless the user explicitly asks. " +
          "Always validate before saving. If validation fails, explain the issue in 1–2 sentences and propose the next best edit attempt.\n\n" +
          "Deterministic editing workflow:\n" +
          "1) Call getCurrentSpec to load the latest spec/version.\n" +
          "2) Call applySpecPatch with a minimal patch (operations array) to implement the user request.\n" +
          "3) Call validateSpec with spec_json from applySpecPatch.\n" +
          "4) If valid and score >= 0.8, call savePreviewVersion to persist and return previewUrl.\n\n" +
          "Patch operation constraints:\n" +
          "- Prefer small edits: update component props, add/remove one component, adjust layout, adjust design_tokens.\n" +
          "- Do not change templateId/platformType unless explicitly requested.\n" +
          "- Keep component ids stable; when adding a component, create a short deterministic id (kebab-case).\n",
      },
      { role: "system", content: `Mode: ${mode}, Phase: ${phase}, platformType: ${platformType}` },
      {
        role: "system",
        content:
          "Tools available:\n" +
          "- getCurrentSpec: load current spec and design tokens\n" +
          "- applySpecPatch: apply validated operations to spec/design tokens\n" +
          "- validateSpec: validate spec_json structure and constraints\n" +
          "- savePreviewVersion: persist validated spec/design tokens (preview) and return previewUrl\n",
      },
    ];
  },
  model: openai("gpt-4o"),
  tools: {
    getCurrentSpec,
    applySpecPatch,
    validateSpec,
    savePreviewVersion,
    getStyleBundles,
    todoAdd,
    todoList,
    todoUpdate,
    todoComplete,
  },
});