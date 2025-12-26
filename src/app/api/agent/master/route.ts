import { NextRequest } from "next/server";
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";

export const runtime = "nodejs";

/**
 * Master Agent (MVP)
 * NOTE: This is a placeholder "agent" endpoint. We will later replace internals with Mastra.
 * For now: takes { messages } and streams assistant output.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const messages = body?.messages ?? [];

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system:
      "You are GetFlowetic's Master Agent. Be concise. Help the user build and edit dashboards. Ask only the minimum questions needed to move toward a preview.",
    messages,
  });

  return result.toDataStreamResponse();
}