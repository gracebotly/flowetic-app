import { NextResponse } from "next/server";
import { serverDb } from "@/server-db/client";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const sourceId = String(body?.sourceId ?? "").trim();

    if (!sourceId) {
      return NextResponse.json(
        { ok: false, message: "Missing sourceId." },
        { status: 400 },
      );
    }

    // Delete the connection source (credentials live server-side; do not return them)
    await serverDb.source.delete({
      where: { id: sourceId },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    // If id doesn't exist, Prisma throws; keep response safe
    return NextResponse.json(
      { ok: false, message: err?.message ?? "Failed to delete connection." },
      { status: 500 },
    );
  }
}
