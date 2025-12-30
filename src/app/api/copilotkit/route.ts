/**
 * CopilotKit API Route - Correct Implementation
 * Based on official CopilotKit integration pattern for custom agents
 */

import { CopilotRuntime } from "@copilotkit/runtime";
import { copilotRuntimeHandler } from "@copilotkit/runtime/nextjs";
import { AbstractAgent } from "@ag-ui/client";
import { platformMappingAgent } from "@/mastra/agents/platformMappingAgent";

/**
 * Mastra Agent Adapter
 * Wraps the Mastra platformMappingAgent in AbstractAgent interface
 */
class MastraAgentAdapter extends AbstractAgent {
  private mastraAgent: typeof platformMappingAgent;

  constructor(mastraAgent: typeof platformMappingAgent) {
    super({
      agentId: "default",
      description: "Platform mapping agent for dashboard generation with Mastra workflows and tools",
    });
    this.mastraAgent = mastraAgent;
  }

  protected async run(input: any): Promise<any> {
    try {
      const messages = input.messages ?? [];
      const userMessages = messages.filter((m: any) => m.role === "user");
      const lastMessage = userMessages[userMessages.length - 1]?.content || "";

      // Emit RUN_STARTED event
      this.events$.next({ type: "RUN_STARTED" });

      // Call Mastra agent
      const result = await this.mastraAgent.generate(lastMessage, {
        messages: messages.map((m: any) => ({
          role: m.role,
          content: m.content,
        })),
      });

      const answerText = result.text || String(result);

      // Emit message events
      this.events$.next({ type: "TEXT_MESSAGE_START", payload: {} });
      this.events$.next({ type: "TEXT_MESSAGE_CONTENT", delta: answerText });
      this.events$.next({ type: "TEXT_MESSAGE_END" });
      this.events$.next({ type: "RUN_FINISHED" });

      return { result: answerText, newMessages: [] };
    } catch (error) {
      console.error("MastraAgentAdapter error:", error);
      this.events$.next({
        type: "TEXT_MESSAGE_CONTENT",
        delta: "Sorry, I encountered an error. Please try again.",
      });
      this.events$.next({ type: "RUN_FINISHED" });
      return { result: "Error occurred", newMessages: [] };
    }
  }

  protected detachActiveRun(): void {
    // Cleanup if needed
  }
}

const defaultAgent = new MastraAgentAdapter(platformMappingAgent);

const runtime = new CopilotRuntime({
  agents: { default: defaultAgent },
});

export const { GET, POST } = copilotRuntimeHandler(runtime);