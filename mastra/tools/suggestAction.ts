
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * Client-side tool that renders as an interactive button in chat UI.
 * The agent calls this tool to present clickable actions to user.
 * 
 * This tool has NO execute function - it's purely for UI rendering.
 * The chat-workspace.tsx renders tool-suggestAction parts as buttons.
 */
export const suggestAction = createTool({
  id: "suggestAction",
  description: `Present a clickable action button to user in the chat interface. 
Use this tool instead of outputting __ACTION__ text tokens.
The button will be rendered in UI and trigger the specified action when clicked.
Common actions: "generate-preview", "select-style", "confirm-selection", "show-alternatives"`,
  inputSchema: z.object({
    label: z.string().describe("Button label text shown to user, e.g. 'Generate Dashboard Preview'"),
    actionId: z.string().describe("Action identifier for handling, e.g. 'generate-preview', 'select-style'"),
    payload: z.record(z.any()).optional().describe("Optional data to pass when action is triggered"),
  }),
  // No execute function - this is a client-side rendering tool
});
