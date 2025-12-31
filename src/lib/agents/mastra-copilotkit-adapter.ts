
import { AbstractAgent } from "@ag-ui/client";
import { mastra } from "@/mastra";
import { createClient } from "@/lib/supabase/server";
import { RuntimeContext } from "@mastra/core/runtime-context";

interface RunAgentInput {
  messages: Array<{ role: string; content: string }>;
  context?: any;
}

interface RunAgentResult {
  result: string;
  newMessages: Array<any>;
}

export class MastraPlatformMappingAdapter extends AbstractAgent {
  constructor() {
    super({
      agentId: "default",
      description: "Mastra Platform Mapping Agent for dashboard generation",
    });
  }

  protected async run(input: RunAgentInput): Promise<RunAgentResult> {
    try {
      // Get the Mastra agent
      const agent = mastra.getAgent("platformMappingMaster");

      // Get auth context from Supabase
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      let runtimeContext: RuntimeContext | undefined;

      if (user) {
        const { data: membership } = await supabase
          .from("memberships")
          .select("tenant_id, role")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

        if (membership?.tenant_id) {
          const { data: source } = await supabase
            .from("sources")
            .select("id, type")
            .eq("tenant_id", membership.tenant_id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          // Create RuntimeContext
          runtimeContext = new RuntimeContext();
          runtimeContext.set("tenantId", membership.tenant_id);
          runtimeContext.set("userId", user.id);
          runtimeContext.set("userRole", membership.role || "admin");
          if (source?.id) {
            runtimeContext.set("sourceId", source.id);
          }
          runtimeContext.set("platformType", source?.type || "other");
        }
      }

      // Extract user messages
      const userMessages = input.messages || [];

      // Emit run started event
      this.events$.next({ type: "RUN_STARTED" });
      this.events$.next({ type: "TEXT_MESSAGE_START", payload: {} });

      // Call Mastra agent with RuntimeContext
      const result = await agent.generate(userMessages, {
        runtimeContext,
      });

      // Get the response text
      const responseText =
        typeof result === "string" ? result : result.text || String(result);

      // Emit the response
      this.events$.next({
        type: "TEXT_MESSAGE_CONTENT",
        delta: responseText,
      });

      this.events$.next({ type: "TEXT_MESSAGE_END" });
      this.events$.next({ type: "RUN_FINISHED" });

      return {
        result: responseText,
        newMessages: [],
      };
    } catch (error) {
      console.error("Mastra adapter error:", error);

      this.events$.next({
        type: "TEXT_MESSAGE_CONTENT",
        delta: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      });

      this.events$.next({ type: "RUN_FINISHED" });

      return {
        result: "An error occurred while processing your request.",
        newMessages: [],
      };
    }
  }

  // Stub method to satisfy TypeScript interface
  protected detachActiveRun(): void {
    // No-op: cleanup if needed
  }
}

