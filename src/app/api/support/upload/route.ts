import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import crypto from "crypto";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const MAX_FILES = 3;
const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

function json(status: number, data: Record<string, unknown>) {
  return NextResponse.json(data, { status });
}

/**
 * POST /api/support/upload
 * Uploads a single file to the support-attachments bucket.
 * Returns a signed URL valid for 7 days.
 *
 * Accepts multipart/form-data with a single "file" field.
 * Files are stored under: {user_id}/{timestamp}_{random}_{filename}
 */
export async function POST(req: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return json(401, { ok: false, code: "AUTH_REQUIRED" });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return json(400, { ok: false, code: "INVALID_FORM_DATA", message: "Expected multipart/form-data." });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return json(400, { ok: false, code: "NO_FILE", message: "No file provided." });
  }

  // Validate MIME type
  if (!ALLOWED_TYPES.has(file.type)) {
    return json(400, {
      ok: false,
      code: "INVALID_FILE_TYPE",
      message: `File type "${file.type}" is not allowed. Accepted: images (PNG, JPEG, GIF, WebP) and videos (MP4, WebM, MOV).`,
    });
  }

  // Validate size
  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return json(400, {
      ok: false,
      code: "FILE_TOO_LARGE",
      message: `File is ${sizeMB}MB. Maximum allowed is 25MB.`,
    });
  }

  // Build storage path: {user_id}/{timestamp}_{random}_{sanitized_filename}
  const sanitizedName = file.name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 100);
  const uniqueId = crypto.randomBytes(4).toString("hex");
  const storagePath = `${user.id}/${Date.now()}_${uniqueId}_${sanitizedName}`;

  // Upload to Supabase Storage
  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  const { error: uploadError } = await supabase.storage
    .from("support-attachments")
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error("[POST /api/support/upload] Upload failed:", uploadError.message);
    return json(500, { ok: false, code: "UPLOAD_FAILED", message: "Failed to upload file. Please try again." });
  }

  // Generate a signed URL valid for 7 days
  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from("support-attachments")
    .createSignedUrl(storagePath, 60 * 60 * 24 * 7); // 7 days

  if (signedUrlError || !signedUrlData?.signedUrl) {
    console.error("[POST /api/support/upload] Signed URL failed:", signedUrlError?.message);
    // File was uploaded successfully, just can't get a URL — return the path instead
    return json(200, {
      ok: true,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      storagePath,
      signedUrl: null,
    });
  }

  return json(200, {
    ok: true,
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    storagePath,
    signedUrl: signedUrlData.signedUrl,
  });
}
