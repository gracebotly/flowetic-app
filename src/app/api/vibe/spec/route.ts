

import { NextRequest, NextResponse } from "next/server";
// import { createRuntimeContext, type RuntimeContextLike } from "@/mastra/lib/runtimeContext"; // Removed runtimeContext shim
import { getCurrentSpec } from "@/mastra/tools/specEditor";
import { callTool } from "@/mastra/lib/callTool";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, tenantId, interfaceId } = body as {
      userId: string;
      tenantId: string;
      interfaceId: string;
    };

    if (!userId || !tenantId || !interfaceId) {
      return NextResponse.json({ error: "MISSING_REQUIRED_FIELDS" }, { status: 400 });
    }

    const runtimeContext = { get: (key: string) => ({ userId, tenantId } as any)[key] } as any;
    const current = await callTool(
      getCurrentSpec,
      { interfaceId }, // inputData - tenantId removed as it's not needed
      { requestContext: runtimeContext } // context
    );

    return NextResponse.json({
      spec_json: current.spec_json ?? null,
      design_tokens: current.design_tokens ?? null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "SPEC_FETCH_FAILED" }, { status: 500 });
  }
}


