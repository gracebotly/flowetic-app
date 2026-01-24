




import { NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";
import { embedMany } from "ai";
import { openai } from "@ai-sdk/openai";
import { PgVector } from "@mastra/pg";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

async function listFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === ".git" || e.name === "node_modules") continue;
      out.push(...(await listFiles(full)));
    } else {
      out.push(full);
    }
  }
  return out;
}

function shouldInclude(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  return [".md", ".txt"].includes(ext);
}

function chunkText(text: string, size = 900, overlap = 140) {
  const clean = text.replace(/\r\n/g, "\n");
  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length) {
    const end = Math.min(clean.length, i + size);
    const slice = clean.slice(i, end).trim();
    if (slice) chunks.push(slice);
    if (end >= clean.length) break;
    i = Math.max(0, end - overlap);
  }
  return chunks;
}

export async function POST(req: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { ok: false, code: "AUTH_REQUIRED", message: "Sign in required." },
      { status: 401 },
    );
  }

  // basic "admin-only" guard using memberships.role
  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership || membership.role !== "admin") {
    return NextResponse.json(
      { ok: false, code: "TENANT_ACCESS_DENIED", message: "Admin role required." },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => ({} as any));
  const root =
    (body?.rootDir as string | undefined) ||
    process.env.DESIGN_KB_ROOT ||
    path.join(process.cwd(), "vendor", "ui-ux-pro-max-skill");

  const connectionString = process.env.POSTGRES_CONNECTION_STRING;
  if (!connectionString) {
    return NextResponse.json(
      { ok: false, code: "MISSING_ENV", message: "POSTGRES_CONNECTION_STRING is not set." },
      { status: 400 },
    );
  }

  const indexName = process.env.MASTRA_DESIGN_KB_INDEX_NAME || "design_kb";
  const store = new PgVector({
    connectionString,
    dimensions: 1536,
    indexName,
  });

  // OpenAI text-embedding-3-small is 1536 dims by default
  await store.createIndex({ dimension: 1536 });

  const files = (await listFiles(root)).filter(shouldInclude);
  if (files.length === 0) {
    return NextResponse.json(
      { ok: false, code: "NO_FILES", message: `No .md/.txt files found under ${root}` },
      { status: 400 },
    );
  }

  const vectors: number[][] = [];
  const metadata: Array<{ text: string; source: string; docPath: string; kind: string }> = [];

  for (const filePath of files) {
    const rel = path.relative(root, filePath).replaceAll("\\", "/");
    const text = await fs.readFile(filePath, "utf8").catch(() => "");
    if (!text) continue;

    const chunks = chunkText(text, 900, 140);
    if (chunks.length === 0) continue;

    const { embeddings } = await embedMany({
      model: openai.embedding("text-embedding-3-small"),
      values: chunks,
      maxRetries: 2,
    });

    for (let i = 0; i < chunks.length; i++) {
      vectors.push(embeddings[i]!);
      metadata.push({
        text: chunks[i]!,
        source: "ui-ux-pro-max-skill",
        docPath: rel,
        kind: "ui-ux-pro-max-skill",
      });
    }
  }

  await store.upsert({
    vectors,
    metadata,
  });

  return NextResponse.json({
    ok: true,
    indexName,
    files: files.length,
    chunks: metadata.length,
  });
}



