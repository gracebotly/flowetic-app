





import "dotenv/config";
import { mastra } from "./index";

async function main() {
  const agent = mastra.getAgent("platformMappingMaster");
  if (!agent) throw new Error("platformMappingMaster not found");

  const tenantId = process.env.TEST_TENANT_ID!;
  const threadId = process.env.TEST_THREAD_ID!;
  const platformType = process.env.TEST_PLATFORM_TYPE || "n8n";
  const sourceId = process.env.TEST_SOURCE_ID || "";

  // RequestContext keys used by instructions
  // Note: journey.getSession is the source of truth for schemaReady.
  const result = await agent.network(
    "We connected the platform. Please prepare mapping and tell me the next step.",
    {
      requestContext: (() => {
        const { RequestContext } = require("@mastra/core/request-context");
        const rc = new RequestContext();
        rc.set("tenantId", tenantId);
        rc.set("threadId", threadId);
        rc.set("platformType", platformType);
        if (sourceId) rc.set("sourceId", sourceId);
        return rc;
      })(),
      memory: {
        resource: tenantId,
        thread: threadId,
      },
    } as any,
  );

  for await (const chunk of result) {
    if (chunk?.type) console.log(chunk.type);
    if (chunk.type === "network-execution-event-step-finish") {
      console.log("RESULT:", chunk.payload?.result);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});




