import { NextResponse } from "next/server";
import { getTenantAdmin } from "@/lib/settings/getTenantAdmin";

export const runtime = "nodejs";

function json(status: number, data: Record<string, unknown>) {
  return NextResponse.json(data, { status });
}

// ── POST /api/settings/branding/logo ────────────────────────
// Uploads logo to Supabase Storage, updates tenants.logo_url. Admin only.
export async function POST(req: Request) {
  const auth = await getTenantAdmin({ requireAdmin: true });
  if (!auth.ok) return json(auth.status, { ok: false, code: auth.code });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return json(400, { ok: false, code: "NO_FILE" });
  }

  // Validate MIME type
  const allowedTypes = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    return json(400, { ok: false, code: "INVALID_FILE_TYPE" });
  }

  // Validate size (2MB)
  if (file.size > 2 * 1024 * 1024) {
    return json(400, { ok: false, code: "FILE_TOO_LARGE" });
  }

  // Determine extension from MIME
  const extMap: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/svg+xml": "svg",
    "image/webp": "webp",
  };
  const ext = extMap[file.type] || "png";
  const storagePath = `${auth.tenantId}/logo.${ext}`;

  // Upload to Supabase Storage (upsert to overwrite existing)
  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  const { error: uploadError } = await auth.supabase.storage
    .from("logos")
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    console.error("[POST /api/settings/branding/logo] Upload failed:", uploadError);
    return json(500, { ok: false, code: "UPLOAD_FAILED" });
  }

  // Get the public URL
  const { data: urlData } = auth.supabase.storage
    .from("logos")
    .getPublicUrl(storagePath);

  const logoUrl = urlData.publicUrl;

  // Update tenants.logo_url
  const { error: updateError } = await auth.supabase
    .from("tenants")
    .update({ logo_url: logoUrl, updated_at: new Date().toISOString() })
    .eq("id", auth.tenantId);

  if (updateError) {
    console.error("[POST /api/settings/branding/logo] DB update failed:", updateError);
    return json(500, { ok: false, code: "DB_UPDATE_FAILED" });
  }

  return json(200, { ok: true, logo_url: logoUrl });
}

// ── DELETE /api/settings/branding/logo ──────────────────────
// Removes logo from storage and nulls tenants.logo_url. Admin only.
export async function DELETE() {
  const auth = await getTenantAdmin({ requireAdmin: true });
  if (!auth.ok) return json(auth.status, { ok: false, code: auth.code });

  // List files in the tenant's logo folder to find the current logo
  const { data: files } = await auth.supabase.storage
    .from("logos")
    .list(auth.tenantId);

  if (files && files.length > 0) {
    const filePaths = files.map((f) => `${auth.tenantId}/${f.name}`);
    await auth.supabase.storage.from("logos").remove(filePaths);
  }

  // Null out logo_url
  const { error } = await auth.supabase
    .from("tenants")
    .update({ logo_url: null, updated_at: new Date().toISOString() })
    .eq("id", auth.tenantId);

  if (error) {
    console.error("[DELETE /api/settings/branding/logo] DB update failed:", error);
    return json(500, { ok: false, code: "DELETE_FAILED" });
  }

  return json(200, { ok: true });
}
