import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json({
    ok: true,
    message: "CopilotKit runtime disabled. Chat uses /api/agent/master directly.",
  });
}