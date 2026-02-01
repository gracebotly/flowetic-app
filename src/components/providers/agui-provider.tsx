

"use client";

import { createChatClient } from "@ag-ui/client";
import { CopilotKit } from "@copilotkit/react-core";
import { ReactNode } from "react";

const chatClient = createChatClient({
  runtimeUrl: "/api/copilotkit",
});

export function AGUIProvider({ children }: { children: ReactNode }) {
  return (
    <CopilotKit
      runtimeUrl="/api/copilotkit"
      agent="vibeRouterAgent"
      chatClient={chatClient}
    >
      {children}
    </CopilotKit>
  );
}

