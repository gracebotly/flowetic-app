import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withApiHandler } from "@/lib/api/withApiHandler";

const DRAFT_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export const GET = withApiHandler(async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: membership } = await supabase
    .from("memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .single();

  if (!membership) return NextResponse.json({ error: "No tenant" }, { status: 403 });

  const { data: draft } = await supabase
    .from("wizard_drafts")
    .select("*")
    .eq("tenant_id", membership.tenant_id)
    .single();

  if (!draft) return NextResponse.json({ ok: true, draft: null });

  // Check expiry
  const age = Date.now() - new Date(draft.updated_at).getTime();
  if (age > DRAFT_EXPIRY_MS) {
    await supabase
      .from("wizard_drafts")
      .delete()
      .eq("id", draft.id)
      .eq("tenant_id", membership.tenant_id);
    return NextResponse.json({ ok: true, draft: null });
  }

  return NextResponse.json({ ok: true, draft });
});
export const POST = withApiHandler(async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: membership } = await supabase
    .from("memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .single();

  if (!membership) return NextResponse.json({ error: "No tenant" }, { status: 403 });

  const body = await request.json();
  const { wizardState, currentStep, userEditedName } = body;

  if (!wizardState || typeof currentStep !== "number") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Upsert — one draft per tenant (unique on tenant_id)
  const { data: draft, error } = await supabase
    .from("wizard_drafts")
    .upsert(
      {
        tenant_id: membership.tenant_id,
        user_id: user.id,
        wizard_state: wizardState,
        current_step: currentStep,
        user_edited_name: userEditedName ?? false,
        draft_name: wizardState.name?.trim() || "Untitled draft",
        platform_type: wizardState.selectedPlatform || null,
        surface_type: wizardState.surfaceType || "analytics",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id" }
    )
    .select()
    .single();

  if (error) {
    console.error("[POST /api/wizard-drafts] Upsert failed:", error);
    return NextResponse.json({ error: "Failed to save draft" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, draft });
});
export const DELETE = withApiHandler(async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: membership } = await supabase
    .from("memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .single();

  if (!membership) return NextResponse.json({ error: "No tenant" }, { status: 403 });

  await supabase
    .from("wizard_drafts")
    .delete()
    .eq("tenant_id", membership.tenant_id);

  return NextResponse.json({ ok: true });
});