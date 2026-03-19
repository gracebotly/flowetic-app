import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import crypto from "crypto";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
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
 * GET /api/support/upload?fileName=...&fileType=...&fileSize=...
 *
 * Returns a signed upload URL for direct-to-Supabase uploads.
 * Used for files >4MB to bypass Vercel's 4.5MB body size limit.
 * The client uploads directly to Supabase Storage using this URL.
 */
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json(401, { ok: false, code: "AUTH_REQUIRED" });

  const { searchParams } = new URL(req.url);
  const fileName = searchParams.get("fileName") || "file";
  const fileType = searchParams.get("fileType") || "application/octet-stream";
  const fileSize = parseInt(searchParams.get("fileSize") || "0", 10);

  if (!ALLOWED_TYPES.has(fileType)) {
    return json(400, {
      ok: false,
      code: "INVALID_FILE_TYPE",
      message: `File type "${fileType}" is not allowed. Accepted: images (PNG, JPEG, GIF, WebP) and videos (MP4, WebM, MOV).`,
    });
  }

  if (fileSize > MAX_FILE_SIZE) {
    const sizeMB = (fileSize / (1024 * 1024)).toFixed(1);
    return json(400, {
      ok: false,
      code: "FILE_TOO_LARGE",
      message: `File is ${sizeMB}MB. Maximum allowed is 25MB.`,
    });
  }

  const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
  const uniqueId = crypto.randomBytes(4).toString("hex");
  const storagePath = `${user.id}/${Date.now()}_${uniqueId}_${sanitizedName}`;

  // Create a signed upload URL (valid for 5 minutes)
  const { data: signedUpload, error: signError } = await supabase.storage
    .from("support-attachments")
    .createSignedUploadUrl(storagePath);

  if (signError || !signedUpload) {
    console.error("[GET /api/support/upload] Signed upload URL failed:", signError?.message);
    return json(500, { ok: false, code: "SIGNED_URL_FAILED", message: "Failed to prepare upload. Please try again." });
  }

  return json(200, {
    ok: true,
    signedUrl: signedUpload.signedUrl,
    token: signedUpload.token,
    storagePath,
  });
}

/**
 * POST /api/support/upload
 *
 * Direct upload through the serverless function.
 * Works for files <4MB. For larger files, use the GET endpoint
 * to get a signed URL and upload directly to Supabase.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json(401, { ok: false, code: "AUTH_REQUIRED" });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return json(400, { ok: false, code: "INVALID_FORM_DATA", message: "Expected multipart/form-data." });
  }

  const file = formData.get("file") as File | null;
  if (!file) return json(400, { ok: false, code: "NO_FILE", message: "No file provided." });

  if (!ALLOWED_TYPES.has(file.type)) {
    return json(400, {
      ok: false,
      code: "INVALID_FILE_TYPE",
      message: `File type "${file.type}" is not allowed. Accepted: images (PNG, JPEG, GIF, WebP) and videos (MP4, WebM, MOV).`,
    });
  }

  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return json(400, {
      ok: false,
      code: "FILE_TOO_LARGE",
      message: `File is ${sizeMB}MB. Maximum allowed is 25MB.`,
    });
  }

  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
  const uniqueId = crypto.randomBytes(4).toString("hex");
  const storagePath = `${user.id}/${Date.now()}_${uniqueId}_${sanitizedName}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  const { error: uploadError } = await supabase.storage
    .from("support-attachments")
    .upload(storagePath, buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error("[POST /api/support/upload] Upload failed:", uploadError.message);
    return json(500, { ok: false, code: "UPLOAD_FAILED", message: "Failed to upload file. Please try again." });
  }

  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from("support-attachments")
    .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

  if (signedUrlError || !signedUrlData?.signedUrl) {
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
