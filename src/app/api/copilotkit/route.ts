import { NextRequest } from "next/server";
import { CopilotRuntime, copilotRuntimeNextJSAppRouterEndpoint } from "@copilotkit/runtime";
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";

export const runtime = "nodejs";

// You can add CopilotKit actions later (and later swap the model call to Mastra).
const copilotRuntime = new CopilotRuntime({});

export async function POST(req: NextRequest) {
  return copilotRuntimeNextJSAppRouterEndpoint({
    runtime: copilotRuntime,
    req,
    handler: async ({ messages }) => {
      const result = streamText({
        model: openai("gpt-4o-mini"),
        messages,
        system: "You are Flowetic's assistant. Help the user build and edit dashboards and interface specs.",
      });

      return result.toDataStreamResponse();
    },
  });
}
