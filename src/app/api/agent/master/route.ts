import { NextRequest } from "next/server";
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const messages = body?.messages ?? [];

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system:
      "You are GetFlowetic's Master Agent. Be concise. Help the user build and edit dashboards. When you describe actions, prefer short terminal-friendly steps.",
    messages,
  });

  // Return plain text so the UI doesn't show protocol chunks.
  // This is an SSE-style streaming response.
  return new Response(result.textStream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}