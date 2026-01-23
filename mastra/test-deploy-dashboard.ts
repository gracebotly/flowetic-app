
import "dotenv/config";
import { mastra } from "./index";
import { RequestContext } from "@mastra/core/request-context";

async function main() {
  const wf = mastra.getWorkflow("deployDashboard");
  if (!wf) throw new Error("deployDashboard workflow not found");

  const tenantId = process.env.TEST_TENANT_ID || "";
  const userId = process.env.TEST_USER_ID || "";
  const threadId = process.env.TEST_THREAD_ID || "";
  const previewVersionId = process.env.TEST_PREVIEW_VERSION_ID || "";

  if (!tenantId || !userId || !threadId || !previewVersionId) {
    throw new Error("Missing TEST_TENANT_ID/TEST_USER_ID/TEST_THREAD_ID/TEST_PREVIEW_VERSION_ID");
  }

  const rc = new RequestContext();
  rc.set("tenantId", tenantId);
  rc.set("threadId", threadId);
  rc.set("userId", userId);

  const run = await wf.createRunAsync();
  const result = await run.start({
    inputData: { tenantId, userId, threadId, previewVersionId, confirmed: true },
    requestContext: rc,
  });

  console.log(result);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
