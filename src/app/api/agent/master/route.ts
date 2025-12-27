import { NextRequest } from "next/server";
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";

import { runGeneratePreview, runPublishDashboard } from "@/lib/mastra/run";

export const runtime = "nodejs";

function pickIntent(text: string) {
  const t = text.toLowerCase();
  if (t.includes("preview") || t.includes("generate preview")) return "generate_preview";
  if (t.includes("publish")) return "publish";
  return "chat";
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const messages = body?.messages ?? [];
  const lastUser = [...messages].reverse().find((m: any) => m?.role === "user");
  const lastText = (lastUser?.content ?? "").toString();
  const intent = pickIntent(lastText);

  // TODO: replace these stubs with real auth/session context
  const tenantId = body?.tenantId;
  const userId = body?.userId;
  const userRole = body?.userRole ?? "admin";
  const interfaceId = body?.interfaceId;

  // Generate Preview
  if (intent === "generate_preview") {
    if (!tenantId || !userId || !interfaceId) {
      return new Response("Missing tenantId/userId/interfaceId\n", { status: 400 });
    }

    const out = await runGeneratePreview({
      tenantId,
      userId,
      userRole,
      interfaceId,
      instructions: lastText,
    });

    const text =
      `✓ Preview generated\n` +
      `Preview URL: ${out.previewUrl}\n` +
      `Preview Version: ${out.previewVersionId}\n`;

    return new Response(text, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  }

  // Publish
  if (intent === "publish") {
    if (!tenantId || !userId || !interfaceId) {
      return new Response("Missing tenantId/userId/interfaceId\n", { status: 400 });
    }

    const versionId = body?.versionId;
    const route = body?.route ?? "example.getflowetic.com";
    const confirm = body?.confirm ?? false;

    if (!versionId) return new Response("Missing versionId\n", { status: 400 });

    const out = await runPublishDashboard({
      tenantId,
      userId,
      userRole,
      interfaceId,
      versionId,
      route,
      confirm,
    });

    const text =
      `✓ Published\n` +
      `Deployment ID: ${out.deploymentId}\n` +
      `URL: ${out.publishedUrl}\n`;

    return new Response(text, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  }

  // Default chat (OpenAI)
  const result = streamText({
    model: openai("gpt-4o-mini"),
    system:
      "You are GetFlowetic's Master Agent. Be concise. Help the user build and edit dashboards. When you describe actions, prefer short terminal-friendly steps.",
    messages,
  });

  return new Response(result.textStream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
