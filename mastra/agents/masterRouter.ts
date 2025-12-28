import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';

/**
 * Master Router Agent
 *
 * This agent does not call workflows directly.  Instead, the API route
 * orchestrates workflows and updates shared state.  The agent's job is to
 * provide concise, context-aware responses and guide the user through the
 * dashboard lifecycle.  It uses RuntimeContext values such as mode and phase
 * (supplied in the API route) to tailor its responses.
 */
export const masterRouterAgent = new Agent({
  name: 'Master Router',
  instructions: `
You are the Master Router Agent for GetFlowetic, a platform that builds custom dashboards from client event streams.
Your responsibilities:
• Interpret user questions and identify when they want to generate a preview or deploy a dashboard.
• Respond politely and concisely, using the current mode and phase from RuntimeContext to inform next steps.
• If the user expresses intent to generate a preview or deploy, acknowledge the request and defer execution to the API route.
• Do not expose raw JSON, internal identifiers, or error stack traces.
Phases:
plan → ready_for_preview → previewing → preview_ready → editing → deploy_ready
Modes:
plan | edit
`,
  model: openai('gpt-4o-mini'),
  // No tools attached here; workflows are invoked explicitly in the API.
  tools: {},
});
