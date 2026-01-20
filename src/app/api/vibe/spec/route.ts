

import { NextRequest, NextResponse } from "next/server";
import { RequestContext } from "@mastra/core/request-context";
import { getCurrentSpec } from "@/mastra/tools/specEditor";
import { executeToolOrThrow } from "@/mastra/lib/executeToolOrThrow";

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

    const requestContext = new RequestContext();
    requestContext.set("userId", userId);
    requestContext.set("tenantId", tenantId);

    const current = await executeToolOrThrow(
      getCurrentSpec,
      { interfaceId }, // inputData - tenantId removed as it's not needed
      { requestContext } // context
    );

    return NextResponse.json({
      spec_json: current.spec_json ?? null,
      design_tokens: current.design_tokens ?? null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "SPEC_FETCH_FAILED" }, { status: 500 });
  }
}


