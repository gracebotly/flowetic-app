"use client";

import { useEffect } from "react";
import { initControlPanelWebMcp } from "@/lib/webmcp/init-control-panel";

export function ControlPanelWebMcp() {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ENABLE_WEBMCP !== "true") return;

    // Fire-and-forget; init is internally guarded to run once
    void initControlPanelWebMcp();
  }, []);

  return null;
}
