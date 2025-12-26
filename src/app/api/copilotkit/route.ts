import { CopilotRuntime } from "@copilotkit/runtime";
import { copilotRuntimeHandler } from "@copilotkit/runtime/nextjs";

export const runtime = "nodejs";

const copilotRuntime = new CopilotRuntime({});

export const { GET, POST } = copilotRuntimeHandler(copilotRuntime);
