import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withApiHandler } from "@/lib/api/withApiHandler";

export const runtime = "nodejs";

export const POST = withApiHandler(async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return NextResponse.json(
      { ok: false, reason: "not_authenticated" },
      { status: 401 }
    );
  }

  if (user.email_confirmed_at) {
    return NextResponse.json({ ok: true, reason: "already_confirmed" });
  }

  const { error } = await supabase.auth.resend({
    type: "signup",
    email: user.email,
  });

  if (error) {
    console.error("[resend-confirmation]", error.message);
    return NextResponse.json(
      { ok: false, reason: error.message },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, reason: "sent" });
});