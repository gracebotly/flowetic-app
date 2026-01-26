
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  // Minimal runtime info for CopilotKit client sync.
  // We register agents in /api/copilotkit POST route; client only needs to know agent ids exist.
  return NextResponse.json({
    ok: true,
    agents: [
      { id: "default" },
      { id: "vibe" },
    ],
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
