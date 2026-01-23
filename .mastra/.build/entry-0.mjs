import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { openai } from '@ai-sdk/openai';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { createClient as createClient$1 } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import { createVectorQueryTool } from '@mastra/rag';
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { RequestContext } from '@mastra/core/request-context';

"use strict";
async function loadSkill(platformType) {
  const safePlatform = platformType || "make";
  const skillPath = path.join(process.cwd(), ".mastra", "output", "skills", safePlatform, "Skill.md");
  try {
    return await fs.readFile(skillPath, "utf8");
  } catch {
    const makePath = path.join(process.cwd(), ".mastra", "output", "skills", "make", "Skill.md");
    try {
      return await fs.readFile(makePath, "utf8");
    } catch {
      console.warn(`[loadSkill] Could not find skill for platform: ${safePlatform}`);
      return "";
    }
  }
}
async function loadNamedSkillMarkdown(skillKey) {
  const safeKey = String(skillKey || "").trim();
  if (!safeKey) return "";
  const skillPath = path.join(process.cwd(), ".mastra", "output", "skills", safeKey, "Skill.md");
  try {
    return await fs.readFile(skillPath, "utf8");
  } catch {
    console.warn(`[loadNamedSkillMarkdown] Could not find skill: ${safeKey}`);
    return "";
  }
}
const loadSkillMarkdown = loadSkill;

"use strict";
function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase environment variables. Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set."
    );
  }
  return createClient$1(supabaseUrl, supabaseAnonKey);
}

"use strict";
const TodoStatus = z.enum(["pending", "in_progress", "completed"]);
const TodoPriority = z.enum(["low", "medium", "high"]);
const TodoItem = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  thread_id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: TodoStatus,
  priority: TodoPriority,
  tags: z.array(z.string()),
  parent_id: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string()
});

"use strict";
const todoAdd = createTool({
  id: "todo.add",
  description: "Create a new todo item for the current thread. Use for planning and progress tracking.",
  inputSchema: z.object({
    tenantId: z.string().uuid(),
    threadId: z.string().min(1),
    title: z.string().min(1).max(160),
    description: z.string().max(2e3).optional(),
    priority: TodoPriority.optional().default("medium"),
    tags: z.array(z.string()).optional().default([]),
    parentId: z.string().uuid().optional().nullable()
  }),
  outputSchema: z.object({
    todo: TodoItem
  }),
  execute: async (inputData, context) => {
    const supabase = createClient();
    const { tenantId, threadId, title, description, priority, tags, parentId } = inputData;
    const { data, error } = await supabase.from("todos").insert({
      tenant_id: tenantId,
      thread_id: threadId,
      title,
      description: description ?? null,
      status: "pending",
      priority,
      tags,
      parent_id: parentId ?? null
    }).select("*").single();
    if (error || !data) throw new Error(error?.message ?? "TODO_ADD_FAILED");
    return { todo: data };
  }
});

"use strict";
const todoList = createTool({
  id: "todo.list",
  description: "List todos for the current thread, filtered by status.",
  inputSchema: z.object({
    tenantId: z.string().uuid(),
    threadId: z.string().min(1),
    status: z.union([TodoStatus, z.literal("all")]).default("all")
  }),
  outputSchema: z.object({
    todos: z.array(TodoItem)
  }),
  execute: async (inputData, context) => {
    const supabase = createClient();
    const { tenantId, threadId, status } = inputData;
    let q = supabase.from("todos").select("*").eq("tenant_id", tenantId).eq("thread_id", threadId).order("created_at", { ascending: true });
    if (status !== "all") q = q.eq("status", status);
    const { data, error } = await q;
    if (error || !data) throw new Error(error?.message ?? "TODO_LIST_FAILED");
    return { todos: data };
  }
});

"use strict";
const todoUpdate = createTool({
  id: "todo.update",
  description: "Update a todo item (status/title/description/priority/tags).",
  inputSchema: z.object({
    tenantId: z.string().uuid(),
    threadId: z.string().min(1),
    todoId: z.string().uuid(),
    status: TodoStatus.optional(),
    title: z.string().min(1).max(160).optional(),
    description: z.string().max(2e3).optional().nullable(),
    priority: TodoPriority.optional(),
    tags: z.array(z.string()).optional()
  }),
  outputSchema: z.object({
    todo: TodoItem
  }),
  execute: async (inputData, context) => {
    const supabase = createClient();
    const { tenantId, threadId, todoId, ...patch } = inputData;
    const { data, error } = await supabase.from("todos").update({
      ...patch,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("tenant_id", tenantId).eq("thread_id", threadId).eq("id", todoId).select("*").single();
    if (error || !data) throw new Error(error?.message ?? "TODO_UPDATE_FAILED");
    return { todo: data };
  }
});

"use strict";
const todoComplete = createTool({
  id: "todo.complete",
  description: "Mark a todo as completed.",
  inputSchema: z.object({
    tenantId: z.string().uuid(),
    threadId: z.string().min(1),
    todoId: z.string().uuid()
  }),
  outputSchema: z.object({
    todo: TodoItem
  }),
  execute: async (inputData, context) => {
    const supabase = createClient();
    const { tenantId, threadId, todoId } = inputData;
    const { data, error } = await supabase.from("todos").update({ status: "completed", updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("tenant_id", tenantId).eq("thread_id", threadId).eq("id", todoId).select("*").single();
    if (error || !data) throw new Error(error?.message ?? "TODO_COMPLETE_FAILED");
    return { todo: data };
  }
});

"use strict";

"use strict";
const KEY_B64 = process.env.SOURCE_SECRET_ENCRYPTION_KEY_B64 || "";
const KEY = KEY_B64 ? Buffer.from(KEY_B64, "base64") : null;
function encryptSecret(plaintext) {
  if (!KEY || KEY.length !== 32) {
    throw new Error("Missing/invalid SOURCE_SECRET_ENCRYPTION_KEY_B64 (must be 32 bytes base64).");
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = {
    v: 1,
    alg: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: enc.toString("base64")
  };
  return JSON.stringify(payload);
}
function decryptSecret(ciphertext) {
  if (!KEY || KEY.length !== 32) {
    throw new Error("Missing/invalid SOURCE_SECRET_ENCRYPTION_KEY_B64 (must be 32 bytes base64).");
  }
  const payload = JSON.parse(ciphertext);
  if (payload?.v !== 1 || payload.alg !== "aes-256-gcm") {
    throw new Error("Unsupported secret envelope.");
  }
  const iv = Buffer.from(payload.iv, "base64");
  const tag = Buffer.from(payload.tag, "base64");
  const data = Buffer.from(payload.data, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString("utf8");
}

"use strict";
const SourcePlatformType = z.enum(["vapi", "retell", "n8n", "make", "activepieces", "mastra", "crewai", "other"]).describe("Supported connection platform types.");
const SourceMethod = z.enum(["api", "webhook"]).describe("Connection method (API key vs webhook).");
const SourceStatus = z.enum(["active", "inactive", "error"]).describe("High-level connection health/status.");
const SourcePublic = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  type: SourcePlatformType,
  name: z.string(),
  method: SourceMethod,
  status: SourceStatus,
  createdAt: z.string()
});

"use strict";
const createSource = createTool({
  id: "sources.create",
  description: "Create (connect) a new source for a tenant. Stores credentials in sources.secret_hash (encrypted). Never returns secrets.",
  inputSchema: z.object({
    tenantId: z.string().uuid(),
    type: SourcePlatformType,
    method: SourceMethod.default("api"),
    name: z.string().min(1).max(120).optional(),
    // Store arbitrary credential payload into secret_hash (encrypted).
    credentials: z.record(z.any()).optional().default({}),
    // Optional override for status on creation; default active.
    status: SourceStatus.optional().default("active")
  }),
  outputSchema: z.object({
    source: SourcePublic,
    message: z.string()
  }),
  execute: async (inputData, context) => {
    const supabase = await createClient();
    const tenantId = inputData.tenantId;
    const type = inputData.type;
    const method = inputData.method;
    const status = inputData.status;
    const name = inputData.name && inputData.name.trim() || `${type} (${method})`;
    const secretPayload = {
      ...inputData.credentials,
      platformType: type,
      method
    };
    const secret_hash = encryptSecret(JSON.stringify(secretPayload));
    const { data, error } = await supabase.from("sources").insert({
      tenant_id: tenantId,
      type,
      name,
      status,
      method,
      secret_hash
    }).select("id, tenant_id, type, name, method, status, created_at").single();
    if (error || !data) throw new Error(`SOURCE_CREATE_FAILED: ${error?.message ?? "NO_DATA"}`);
    return {
      source: {
        id: String(data.id),
        tenantId: String(data.tenant_id),
        type: SourcePlatformType.parse(String(data.type)),
        name: String(data.name),
        method: SourceMethod.parse(String(data.method ?? "api")),
        status: SourceStatus.parse(String(data.status ?? "active")),
        createdAt: String(data.created_at)
      },
      message: `Connected ${String(data.type)} successfully.`
    };
  }
});

"use strict";
const listSources = createTool({
  id: "sources.list",
  description: "List all sources (platform connections) for the given tenant.",
  inputSchema: z.object({
    tenantId: z.string().uuid()
  }),
  outputSchema: z.object({
    sources: z.array(SourcePublic)
  }),
  execute: async (inputData, context) => {
    const supabase = await createClient();
    const { tenantId } = inputData;
    const { data, error } = await supabase.from("sources").select("id, tenant_id, type, name, method, status, created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false });
    if (error) throw new Error(`SOURCES_LIST_FAILED: ${error.message}`);
    const rows = (data ?? []).map((s) => ({
      id: String(s.id),
      tenantId: String(s.tenant_id),
      type: SourcePlatformType.parse(String(s.type ?? "other")),
      name: String(s.name ?? s.type ?? "connection"),
      method: SourceMethod.parse(String(s.method ?? "api")),
      status: SourceStatus.parse(String(s.status ?? "active")),
      createdAt: String(s.created_at)
    }));
    return { sources: rows };
  }
});

"use strict";
const updateSource = createTool({
  id: "sources.update",
  description: "Update an existing source. Supports updating name/status and optionally merging new credential fields into encrypted secret_hash. Never returns secrets.",
  inputSchema: z.object({
    tenantId: z.string().uuid(),
    sourceId: z.string().uuid(),
    name: z.string().min(1).max(120).optional(),
    status: SourceStatus.optional(),
    // Optional: merge into decrypted secret payload and re-encrypt.
    credentials: z.record(z.any()).optional()
  }),
  outputSchema: z.object({
    source: SourcePublic,
    message: z.string()
  }),
  execute: async (inputData, context) => {
    const supabase = await createClient();
    const { tenantId, sourceId } = inputData;
    const { data: existing, error: exErr } = await supabase.from("sources").select("id, tenant_id, type, name, method, status, secret_hash, created_at").eq("id", sourceId).eq("tenant_id", tenantId).maybeSingle();
    if (exErr) throw new Error(`SOURCE_LOOKUP_FAILED: ${exErr.message}`);
    if (!existing) throw new Error("SOURCE_NOT_FOUND");
    const updates = {};
    if (typeof inputData.name === "string") updates.name = inputData.name;
    if (typeof inputData.status === "string") updates.status = inputData.status;
    if (inputData.credentials && typeof inputData.credentials === "object") {
      let prior = {};
      if (existing.secret_hash) {
        try {
          prior = JSON.parse(decryptSecret(String(existing.secret_hash)));
        } catch {
          prior = {};
        }
      }
      const merged = {
        ...prior,
        ...inputData.credentials,
        platformType: String(existing.type ?? "other"),
        method: String(existing.method ?? "api")
      };
      updates.secret_hash = encryptSecret(JSON.stringify(merged));
    }
    if (Object.keys(updates).length === 0) {
      throw new Error("NO_FIELDS_TO_UPDATE");
    }
    const { data, error } = await supabase.from("sources").update(updates).eq("id", sourceId).eq("tenant_id", tenantId).select("id, tenant_id, type, name, method, status, created_at").single();
    if (error || !data) throw new Error(`SOURCE_UPDATE_FAILED: ${error?.message ?? "NO_DATA"}`);
    return {
      source: {
        id: String(data.id),
        tenantId: String(data.tenant_id),
        type: SourcePlatformType.parse(String(data.type ?? "other")),
        name: String(data.name ?? "connection"),
        method: SourceMethod.parse(String(data.method ?? "api")),
        status: SourceStatus.parse(String(data.status ?? "active")),
        createdAt: String(data.created_at)
      },
      message: "Source updated successfully."
    };
  }
});

"use strict";
const deleteSource = createTool({
  id: "sources.delete",
  description: "Delete (disconnect) a source by ID for a tenant.",
  inputSchema: z.object({
    tenantId: z.string().uuid(),
    sourceId: z.string().uuid()
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string()
  }),
  execute: async (inputData, context) => {
    const supabase = await createClient();
    const { tenantId, sourceId } = inputData;
    const { data: existing, error: exErr } = await supabase.from("sources").select("id").eq("id", sourceId).eq("tenant_id", tenantId).maybeSingle();
    if (exErr) throw new Error(`SOURCE_LOOKUP_FAILED: ${exErr.message}`);
    if (!existing) throw new Error("SOURCE_NOT_FOUND");
    const { error } = await supabase.from("sources").delete().eq("id", sourceId).eq("tenant_id", tenantId);
    if (error) throw new Error(`SOURCE_DELETE_FAILED: ${error.message}`);
    return { success: true, message: "Source deleted successfully." };
  }
});

"use strict";

"use strict";
const ProjectType = z.enum(["analytics", "tool", "form"]);
const ProjectStatus = z.enum(["draft", "live"]);
const ProjectPublic = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string(),
  type: ProjectType,
  status: ProjectStatus,
  description: z.string().nullable(),
  publicEnabled: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string()
});

"use strict";
const createProject = createTool({
  id: "projects.create",
  description: "Create a new project for a tenant.",
  inputSchema: z.object({
    tenantId: z.string().uuid(),
    name: z.string().min(1).max(120),
    type: ProjectType,
    description: z.string().max(2e3).optional(),
    publicEnabled: z.boolean().optional().default(false)
  }),
  outputSchema: z.object({
    project: ProjectPublic,
    message: z.string()
  }),
  execute: async (inputData, context) => {
    const supabase = createClient();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const { data, error } = await supabase.from("projects").insert({
      tenant_id: inputData.tenantId,
      name: inputData.name,
      type: inputData.type,
      status: "draft",
      description: inputData.description ?? null,
      public_enabled: inputData.publicEnabled ?? false,
      created_at: now,
      updated_at: now
    }).select("id, tenant_id, name, type, status, description, public_enabled, created_at, updated_at").single();
    if (error || !data) throw new Error(`PROJECT_CREATE_FAILED: ${error?.message ?? "NO_DATA"}`);
    return {
      project: {
        id: String(data.id),
        tenantId: String(data.tenant_id),
        name: String(data.name),
        type: ProjectType.parse(String(data.type)),
        status: ProjectStatus.parse(String(data.status)),
        description: data.description === null || data.description === void 0 ? null : String(data.description),
        publicEnabled: !!data.public_enabled,
        createdAt: String(data.created_at),
        updatedAt: String(data.updated_at)
      },
      message: `Project "${String(data.name)}" created.`
    };
  }
});

"use strict";
const listProjects = createTool({
  id: "projects.list",
  description: "List projects for a tenant.",
  inputSchema: z.object({
    tenantId: z.string().uuid(),
    type: ProjectType.optional(),
    status: ProjectStatus.optional(),
    limit: z.number().int().min(1).max(200).optional().default(50)
  }),
  outputSchema: z.object({
    projects: z.array(ProjectPublic)
  }),
  execute: async (inputData, context) => {
    const supabase = await createClient();
    const { tenantId, type, status, limit } = inputData;
    let q = supabase.from("projects").select("id, tenant_id, name, type, status, description, public_enabled, created_at, updated_at").eq("tenant_id", tenantId).order("updated_at", { ascending: false }).limit(limit);
    if (type) q = q.eq("type", type);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) throw new Error(`PROJECTS_LIST_FAILED: ${error.message}`);
    return {
      projects: (data ?? []).map((p) => ({
        id: String(p.id),
        tenantId: String(p.tenant_id),
        name: String(p.name),
        type: ProjectType.parse(String(p.type)),
        status: ProjectStatus.parse(String(p.status)),
        description: p.description === null || p.description === void 0 ? null : String(p.description),
        publicEnabled: !!p.public_enabled,
        createdAt: String(p.created_at),
        updatedAt: String(p.updated_at)
      }))
    };
  }
});

"use strict";
const updateProject = createTool({
  id: "projects.update",
  description: "Update a project (name/type/status/description/publicEnabled) for a tenant.",
  inputSchema: z.object({
    tenantId: z.string().uuid(),
    projectId: z.string().uuid(),
    name: z.string().min(1).max(120).optional(),
    type: ProjectType.optional(),
    status: ProjectStatus.optional(),
    description: z.string().max(2e3).nullable().optional(),
    publicEnabled: z.boolean().optional()
  }),
  outputSchema: z.object({
    project: ProjectPublic,
    message: z.string()
  }),
  execute: async (inputData, context) => {
    const supabase = await createClient();
    const updates = {};
    if (inputData.name !== void 0) updates.name = inputData.name;
    if (inputData.type !== void 0) updates.type = inputData.type;
    if (inputData.status !== void 0) updates.status = inputData.status;
    if (inputData.description !== void 0) updates.description = inputData.description;
    if (inputData.publicEnabled !== void 0) updates.public_enabled = inputData.publicEnabled;
    if (Object.keys(updates).length === 0) throw new Error("NO_FIELDS_TO_UPDATE");
    updates.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    const { data, error } = await supabase.from("projects").update(updates).eq("id", inputData.projectId).eq("tenant_id", inputData.tenantId).select("id, tenant_id, name, type, status, description, public_enabled, created_at, updated_at").single();
    if (error || !data) throw new Error(`PROJECT_UPDATE_FAILED: ${error?.message ?? "NO_DATA"}`);
    return {
      project: {
        id: String(data.id),
        tenantId: String(data.tenant_id),
        name: String(data.name),
        type: ProjectType.parse(String(data.type)),
        status: ProjectStatus.parse(String(data.status)),
        description: data.description === null || data.description === void 0 ? null : String(data.description),
        publicEnabled: !!data.public_enabled,
        createdAt: String(data.created_at),
        updatedAt: String(data.updated_at)
      },
      message: "Project updated successfully."
    };
  }
});

"use strict";
const deleteProject = createTool({
  id: "projects.delete",
  description: "Delete a project by ID for a tenant.",
  inputSchema: z.object({
    tenantId: z.string().uuid(),
    projectId: z.string().uuid()
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string()
  }),
  execute: async (inputData, context) => {
    const supabase = await createClient();
    const { tenantId, projectId } = inputData;
    const { data: existing, error: exErr } = await supabase.from("projects").select("id").eq("id", projectId).eq("tenant_id", tenantId).maybeSingle();
    if (exErr) throw new Error(`PROJECT_LOOKUP_FAILED: ${exErr.message}`);
    if (!existing) throw new Error("PROJECT_NOT_FOUND");
    const { error } = await supabase.from("projects").delete().eq("id", projectId).eq("tenant_id", tenantId);
    if (error) throw new Error(`PROJECT_DELETE_FAILED: ${error.message}`);
    return { success: true, message: "Project deleted successfully." };
  }
});

"use strict";

"use strict";
const Page = z.enum([
  "home",
  "connections",
  "chat",
  "projects",
  "clients",
  "activity",
  "settings",
  "project_detail"
]);
const navigateTo = createTool({
  id: "navigation.navigateTo",
  description: "Return a URL for the app to navigate to. Use for moving the user to a page after an action.",
  inputSchema: z.object({
    page: Page,
    resourceId: z.string().uuid().optional().describe("Optional id for detail pages"),
    params: z.record(z.string()).optional().describe("Optional query params")
  }),
  outputSchema: z.object({
    url: z.string(),
    message: z.string()
  }),
  execute: async (inputData, context) => {
    const { page, resourceId, params } = inputData;
    let url = "/";
    switch (page) {
      case "home":
        url = "/";
        break;
      case "connections":
        url = "/control-panel/connections";
        break;
      case "chat":
        url = "/control-panel/chat";
        break;
      case "projects":
        url = "/control-panel/projects";
        break;
      case "project_detail":
        if (!resourceId) throw new Error("MISSING_RESOURCE_ID");
        url = `/control-panel/projects/${resourceId}`;
        break;
      case "clients":
        url = "/control-panel/clients";
        break;
      case "activity":
        url = "/control-panel/activity";
        break;
      case "settings":
        url = "/control-panel/settings";
        break;
      default:
        url = "/";
    }
    if (params && Object.keys(params).length > 0) {
      const qs = new URLSearchParams(params).toString();
      url = `${url}?${qs}`;
    }
    return {
      url,
      message: `Navigate to ${page}`
    };
  }
});

"use strict";

"use strict";
const searchDesignKB = createVectorQueryTool({
  id: "searchDesignKB",
  description: "Search GetFlowetic's UI/UX design knowledge base (ui-ux-pro-max-skill + internal rules). Use this to ground design advice and reduce hallucinations.",
  vectorStoreName: process.env.MASTRA_VECTOR_STORE_NAME || "pgVector",
  indexName: process.env.MASTRA_DESIGN_KB_INDEX_NAME || "design_kb",
  model: openai.embedding("text-embedding-3-small"),
  enableFilter: true
});

"use strict";
async function listFiles(dir) {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === ".git" || e.name === "node_modules") continue;
      out.push(...await listFiles(full));
    } else {
      out.push(full);
    }
  }
  return out;
}
function isSupported(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ext === ".md" || ext === ".txt";
}
async function loadDesignKBFiles() {
  const root = process.env.DESIGN_KB_ROOT || path.join(process.cwd(), "vendor", "ui-ux-pro-max-skill");
  const files = (await listFiles(root)).filter(isSupported);
  const results = [];
  for (const filePath of files) {
    const content = await fs.readFile(filePath, "utf8").catch(() => "");
    if (!content) continue;
    results.push({
      path: path.relative(root, filePath).replaceAll("\\", "/"),
      content
    });
  }
  return results;
}

"use strict";
const searchDesignKBLocal = createTool({
  id: "searchDesignKBLocal",
  description: "Fallback local design KB search (no vector DB). Returns a combined relevantContext string plus lightweight sources. Use when vector search is unavailable or returns empty.",
  inputSchema: z.object({
    queryText: z.string().min(1),
    maxChars: z.number().int().min(500).max(12e3).default(6e3)
  }),
  outputSchema: z.object({
    relevantContext: z.string(),
    sources: z.array(
      z.object({
        docPath: z.string(),
        score: z.number(),
        excerpt: z.string()
      })
    )
  }),
  execute: async (inputData, context) => {
    const { queryText, maxChars } = inputData;
    const q = queryText.toLowerCase();
    const terms = q.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t.length >= 3).slice(0, 30);
    const files = await loadDesignKBFiles();
    const scored = [];
    for (const f of files) {
      const lower = f.content.toLowerCase();
      let score = 0;
      for (const t of terms) {
        const idx = lower.indexOf(t);
        if (idx >= 0) score += 3;
      }
      if (score > 0) scored.push({ docPath: f.path, score, content: f.content });
    }
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 5);
    const sources = [];
    const parts = [];
    for (const t of top) {
      const lower = t.content.toLowerCase();
      const firstIdx = terms.length ? lower.indexOf(terms[0]) : -1;
      const start = Math.max(0, firstIdx >= 0 ? firstIdx - 200 : 0);
      const end = Math.min(t.content.length, start + 1400);
      const excerpt = t.content.slice(start, end).trim();
      sources.push({ docPath: t.docPath, score: t.score, excerpt });
      parts.push(`SOURCE: ${t.docPath}
${excerpt}`.trim());
    }
    const relevantContext = parts.join("\n\n---\n\n").slice(0, maxChars);
    return { relevantContext, sources };
  }
});

"use strict";

"use strict";
const Swatch = z.object({ name: z.string(), hex: z.string() });
const StyleBundle = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  previewImageUrl: z.string(),
  palette: z.object({
    name: z.string(),
    swatches: z.array(Swatch).min(5).max(8)
  }),
  densityPreset: z.enum(["compact", "comfortable", "spacious"]),
  tags: z.array(z.string()).max(8),
  // Tokens that Design Advisor / spec editor will apply
  designTokens: z.record(z.any())
});
function stableId(input) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 64);
}
function fallbackBundles() {
  return [
    {
      id: "agency-premium-glass",
      name: "Agency Premium (Glass)",
      description: "High-end, client-ready, soft depth and clean charts",
      previewImageUrl: "/style-previews/glassmorphism.png",
      palette: {
        name: "Premium Neutral",
        swatches: [
          { name: "Primary", hex: "#2563EB" },
          { name: "Accent", hex: "#22C55E" },
          { name: "Background", hex: "#F8FAFC" },
          { name: "Surface", hex: "#FFFFFF" },
          { name: "Text", hex: "#0F172A" }
        ]
      },
      densityPreset: "comfortable",
      tags: ["Client-facing", "Premium", "Clean"],
      designTokens: {
        "theme.radius.md": 14,
        "theme.shadow.card": "soft",
        "theme.spacing.base": 10,
        "theme.color.primary": "#2563EB",
        "theme.color.accent": "#22C55E",
        "theme.color.background": "#F8FAFC",
        "theme.color.surface": "#FFFFFF",
        "theme.color.text": "#0F172A"
      }
    },
    {
      id: "modern-dark-saas",
      name: "Modern SaaS (Dark)",
      description: "Sleek, high contrast, great for ops + reliability",
      previewImageUrl: "/style-previews/dark-mode.png",
      palette: {
        name: "Dark SaaS",
        swatches: [
          { name: "Primary", hex: "#60A5FA" },
          { name: "Accent", hex: "#F472B6" },
          { name: "Background", hex: "#0B1220" },
          { name: "Surface", hex: "#111827" },
          { name: "Text", hex: "#E5E7EB" }
        ]
      },
      densityPreset: "comfortable",
      tags: ["Ops", "Modern", "High contrast"],
      designTokens: {
        "theme.radius.md": 12,
        "theme.shadow.card": "medium",
        "theme.spacing.base": 10,
        "theme.color.primary": "#60A5FA",
        "theme.color.accent": "#F472B6",
        "theme.color.background": "#0B1220",
        "theme.color.surface": "#111827",
        "theme.color.text": "#E5E7EB"
      }
    },
    {
      id: "minimal-report",
      name: "Minimal Report",
      description: "Executive report feel, low noise, strong hierarchy",
      previewImageUrl: "/style-previews/minimalism.png",
      palette: {
        name: "Slate Minimal",
        swatches: [
          { name: "Primary", hex: "#334155" },
          { name: "Accent", hex: "#0EA5E9" },
          { name: "Background", hex: "#F9FAFB" },
          { name: "Surface", hex: "#FFFFFF" },
          { name: "Text", hex: "#111827" }
        ]
      },
      densityPreset: "comfortable",
      tags: ["Client-facing", "Report", "Minimal"],
      designTokens: {
        "theme.radius.md": 10,
        "theme.shadow.card": "none",
        "theme.spacing.base": 12,
        "theme.color.primary": "#334155",
        "theme.color.accent": "#0EA5E9",
        "theme.color.background": "#F9FAFB",
        "theme.color.surface": "#FFFFFF",
        "theme.color.text": "#111827"
      }
    },
    {
      id: "bold-startup",
      name: "Bold Startup",
      description: "Punchy, high energy, looks like a real SaaS product",
      previewImageUrl: "/style-previews/brutalism.png",
      palette: {
        name: "Startup Bold",
        swatches: [
          { name: "Primary", hex: "#F97316" },
          { name: "Accent", hex: "#A78BFA" },
          { name: "Background", hex: "#0B0F19" },
          { name: "Surface", hex: "#111827" },
          { name: "Text", hex: "#F9FAFB" }
        ]
      },
      densityPreset: "comfortable",
      tags: ["SaaS", "Bold", "High energy"],
      designTokens: {
        "theme.radius.md": 8,
        "theme.shadow.card": "hard",
        "theme.spacing.base": 10,
        "theme.color.primary": "#F97316",
        "theme.color.accent": "#A78BFA",
        "theme.color.background": "#0B0F19",
        "theme.color.surface": "#111827",
        "theme.color.text": "#F9FAFB"
      }
    }
  ];
}
function parseBundlesFromText(text) {
  const lines = text.split("\n").map((l) => l.trim());
  const hexes = text.match(/#[0-9a-fA-F]{6}/g) ?? [];
  if (hexes.length < 8) return null;
  const bundles = [];
  const names = [
    { name: "Agency Premium (Glass)", preview: "/style-previews/glassmorphism.png", tags: ["Client-facing", "Premium", "Clean"] },
    { name: "Modern SaaS (Dark)", preview: "/style-previews/dark-mode.png", tags: ["Ops", "Modern", "High contrast"] },
    { name: "Minimal Report", preview: "/style-previews/minimalism.png", tags: ["Client-facing", "Report", "Minimal"] },
    { name: "Bold Startup", preview: "/style-previews/brutalism.png", tags: ["SaaS", "Bold", "High energy"] }
  ];
  for (let i = 0; i < 4; i++) {
    const paletteHex = hexes.slice(i * 5, i * 5 + 5);
    if (paletteHex.length < 5) break;
    const bundleName = names[i].name;
    bundles.push({
      id: stableId(bundleName),
      name: bundleName,
      description: "RAG-recommended bundle based on your dashboard goals.",
      previewImageUrl: names[i].preview,
      palette: {
        name: "RAG Palette",
        swatches: [
          { name: "Primary", hex: paletteHex[0] },
          { name: "Accent", hex: paletteHex[1] },
          { name: "Background", hex: paletteHex[2] },
          { name: "Surface", hex: paletteHex[3] },
          { name: "Text", hex: paletteHex[4] }
        ]
      },
      densityPreset: "comfortable",
      tags: names[i].tags,
      designTokens: {
        "theme.color.primary": paletteHex[0],
        "theme.color.accent": paletteHex[1],
        "theme.color.background": paletteHex[2],
        "theme.color.surface": paletteHex[3],
        "theme.color.text": paletteHex[4],
        "theme.spacing.base": 10,
        "theme.radius.md": 12,
        "theme.shadow.card": "soft"
      }
    });
  }
  return bundles.length === 4 ? bundles : null;
}
const getStyleBundles = createTool({
  id: "design.getStyleBundles",
  description: "Return 4 style+palette bundles (visual-card ready) grounded in UI/UX Pro Max catalog. Used during Phase 3 (required style selection).",
  inputSchema: z.object({
    platformType: z.string().min(1),
    outcome: z.enum(["dashboard", "product"]),
    audience: z.enum(["client", "ops"]).default("client"),
    dashboardKind: z.string().default("workflow-activity"),
    notes: z.string().optional()
  }),
  outputSchema: z.object({
    bundles: z.array(StyleBundle).length(4),
    sources: z.array(z.object({ kind: z.string(), note: z.string() })).default([])
  }),
  execute: async ({ context, runtimeContext }) => {
    const queryText = `Return 4 style+palette bundles for a ${inputData.dashboardKind} ${inputData.outcome} UI, audience=${inputData.audience}, platform=${inputData.platformType}. Each bundle must include: name, brief description, and a 5-color palette (hex). Prefer premium client-ready styles. Notes: ${inputData.notes ?? ""}`;
    let relevantText = "";
    const sources = [];
    const kb = searchDesignKB;
    const exec = kb?.execute;
    if (exec) {
      try {
        const rag = await exec({
          context: {
            query: queryText,
            topK: 8,
            filter: {}
          },
          runtimeContext
        });
        relevantText = JSON.stringify(rag).slice(0, 12e3);
        sources.push({ kind: "vector", note: "searchDesignKB" });
      } catch {
      }
    }
    if (!relevantText) {
      const local = await searchDesignKBLocal.execute({
        context: { queryText, maxChars: 8e3 },
        runtimeContext
      });
      relevantText = local.relevantContext || "";
      sources.push({ kind: "local", note: "searchDesignKBLocal" });
    }
    const parsed = parseBundlesFromText(relevantText);
    const bundles = parsed ?? fallbackBundles();
    const validated = z.array(StyleBundle).length(4).parse(bundles);
    return { bundles: validated, sources };
  }
});

"use strict";

"use strict";
const designAdvisorAgent = new Agent({
  name: "designAdvisorAgent",
  description: "Design Advisor Agent (RAG): Frontend-design powered UI/UX guidance. Generates style bundles (Phase 3), applies interactive edits (Phase 5), follows frontend-design principles for distinctive dashboards.",
  instructions: async ({ requestContext }) => {
    const mode = requestContext.get("mode") ?? "edit";
    const phase = requestContext.get("phase") ?? "editing";
    const platformType = requestContext.get("platformType") ?? "make";
    const frontendDesignSkill = await loadNamedSkillMarkdown("frontend-design");
    return [
      {
        role: "system",
        content: `Frontend-Design Skill.md:

${frontendDesignSkill}`
      },
      {
        role: "system",
        content: "You are the Design Advisor Agent (RAG) for GetFlowetic.\n\nGoal: Make the dashboard look polished, modern, and appropriate for the user's brand (e.g., law firm, healthcare, startup) while staying consistent with the GetFlowetic component system.\n\nCRITICAL RULES:\n- Never ask the user for tenantId, sourceId, interfaceId, threadId, versionId, or any UUID. Never mention internal identifiers.\n- Use RAG retrieval before giving design recommendations: call searchDesignKB with the user's style request.\nIf searchDesignKB fails or returns empty context, fall back to searchDesignKBLocal (keyword-based) and proceed with conservative recommendations.\n- Never invent a design system. If retrieval is empty or low-quality, give conservative, broadly safe guidance and say it's a best-practice default.\n- Prefer concrete edits: design tokens (colors, radius, spacing, typography), component prop defaults, and light layout tweaks.\n- Do not show raw spec JSON unless explicitly requested.\n\nPHASE GATING:\n- Phase 3: Generate 4 style bundles using getStyleBundles tool\n- Phase 5: Apply minimal token/layout tweaks (getCurrentSpec \u2192 applySpecPatch \u2192 validateSpec \u2192 savePreviewVersion)\n- Never change template/platform without router direction\n- Never produce raw JSON unless asked\n\nWhen the user asks to 'make it look more premium' or similar:\n1) Call searchDesignKB to retrieve relevant guidance.\n2) Summarize recommendations in 5\u201310 bullets max.\n3) If the user wants changes applied (or they say 'apply it' / 'do it'), then:\n   a) Call getCurrentSpec\n   b) Call applySpecPatch with minimal operations targeting design_tokens and small layout/props changes\n   c) Call validateSpec with spec_json\n   d) If valid and score >= 0.8, call savePreviewVersion and return previewUrl.\n\nToken conventions:\n- Use dot-paths in setDesignToken, e.g. 'theme.color.primary', 'theme.color.background', 'theme.radius.md', 'theme.shadow.card', 'theme.typography.fontFamily', 'theme.spacing.base'.\n- Keep changes minimal and reversible.\n"
      },
      { role: "system", content: `Mode: ${mode}, Phase: ${phase}, platformType: ${platformType}` },
      {
        role: "system",
        content: "Tools:\n- searchDesignKB: RAG search for grounded UI/UX guidance\n- getCurrentSpec/applySpecPatch/validateSpec/savePreviewVersion: deterministic spec editing pipeline\n"
      }
    ];
  },
  model: openai("gpt-4o"),
  memory: new Memory({
    options: {
      lastMessages: 20
    }
  }),
  tools: {
    searchDesignKB,
    searchDesignKBLocal,
    getStyleBundles,
    todoAdd,
    todoList,
    todoUpdate,
    todoComplete
  }
});

"use strict";
const getCurrentSpec = createTool({
  id: "getCurrentSpec",
  description: "Fetch the latest dashboard UI spec and design tokens for the current interface (dashboard). Uses runtimeContext.interfaceId if provided; otherwise finds most recent interface for tenant.",
  inputSchema: z.object({
    interfaceId: z.string().uuid().optional()
  }),
  outputSchema: z.object({
    interfaceId: z.string().uuid(),
    versionId: z.string().uuid().nullable(),
    spec_json: z.record(z.any()),
    design_tokens: z.record(z.any())
  }),
  execute: async ({ context, runtimeContext }) => {
    const supabase = await createClient();
    const tenantId = runtimeContext?.get("tenantId");
    if (!tenantId) throw new Error("AUTH_REQUIRED");
    const explicitInterfaceId = inputData.interfaceId ?? runtimeContext?.get("interfaceId");
    let interfaceId = explicitInterfaceId;
    if (!interfaceId) {
      const { data: iface, error: ifaceErr } = await supabase.from("interfaces").select("id").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (ifaceErr) throw new Error(ifaceErr.message);
      interfaceId = iface?.id ?? void 0;
    }
    if (!interfaceId) {
      return {
        interfaceId: runtimeContext?.get("interfaceId") || "00000000-0000-0000-0000-000000000000",
        versionId: null,
        spec_json: {
          version: "1.0",
          templateId: "general-analytics",
          platformType: runtimeContext?.get("platformType") ?? "make",
          layout: { type: "grid", columns: 12, gap: 4 },
          components: []
        },
        design_tokens: {}
      };
    }
    const { data: version, error: versionErr } = await supabase.from("interface_versions").select("id,spec_json,design_tokens,created_at").eq("interface_id", interfaceId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (versionErr) throw new Error(versionErr.message);
    return {
      interfaceId,
      versionId: version?.id ?? null,
      spec_json: version?.spec_json ?? {
        version: "1.0",
        templateId: "general-analytics",
        platformType: runtimeContext?.get("platformType") ?? "make",
        layout: { type: "grid", columns: 12, gap: 4 },
        components: []
      },
      design_tokens: version?.design_tokens ?? {}
    };
  }
});

"use strict";
const LayoutSchema$1 = z.object({
  col: z.number().int().min(0),
  row: z.number().int().min(0),
  w: z.number().int().min(1),
  h: z.number().int().min(1)
});
const ComponentSchema$1 = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  props: z.record(z.any()),
  layout: LayoutSchema$1
});
const UISpecSchemaLoose$1 = z.object({
  version: z.string(),
  templateId: z.string(),
  platformType: z.string(),
  layout: z.object({
    type: z.string(),
    columns: z.number(),
    gap: z.number()
  }),
  components: z.array(ComponentSchema$1)
});
const PatchOpSchema = z.object({
  op: z.enum(["setDesignToken", "setLayout", "addComponent", "removeComponent", "updateComponentProps", "moveComponent"]),
  componentId: z.string().optional(),
  component: ComponentSchema$1.optional(),
  propsPatch: z.record(z.any()).optional(),
  layout: LayoutSchema$1.optional(),
  tokenPath: z.string().optional(),
  tokenValue: z.any().optional()
});
function deepClone$1(v) {
  return JSON.parse(JSON.stringify(v));
}
function setByPath(obj, path, value) {
  const parts = path.split(".").filter(Boolean);
  if (parts.length === 0) return;
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (typeof cur[key] !== "object" || cur[key] === null) cur[key] = {};
    cur = cur[key];
  }
  cur[parts[parts.length - 1]] = value;
}
const applySpecPatch = createTool({
  id: "applySpecPatch",
  description: "Apply a small, deterministic patch to a dashboard UI spec and/or design tokens. Returns updated spec_json + design_tokens.",
  inputSchema: z.object({
    spec_json: z.record(z.any()),
    design_tokens: z.record(z.any()).default({}),
    operations: z.array(PatchOpSchema).min(1).max(20)
  }),
  outputSchema: z.object({
    spec_json: z.record(z.any()),
    design_tokens: z.record(z.any()),
    applied: z.array(z.string())
  }),
  execute: async (inputData, context) => {
    const spec = deepClone$1(inputData.spec_json);
    const tokens = deepClone$1(inputData.design_tokens ?? {});
    const applied = [];
    const parsed = UISpecSchemaLoose$1.safeParse(spec);
    if (!parsed.success) {
      throw new Error("SPEC_VALIDATION_FAILED");
    }
    const ensureComponentsArray = () => {
      if (!Array.isArray(spec.components)) spec.components = [];
    };
    for (const op of inputData.operations) {
      if (op.op === "setDesignToken") {
        if (!op.tokenPath) throw new Error("PATCH_INVALID_TOKEN_PATH");
        setByPath(tokens, op.tokenPath, op.tokenValue);
        applied.push(`setDesignToken:${op.tokenPath}`);
        continue;
      }
      if (op.op === "setLayout") {
        if (!op.layout) throw new Error("PATCH_INVALID_LAYOUT");
        spec.layout = { ...spec.layout, ...op.layout };
        applied.push("setLayout");
        continue;
      }
      if (op.op === "addComponent") {
        ensureComponentsArray();
        if (!op.component) throw new Error("PATCH_INVALID_COMPONENT");
        const exists = spec.components.some((c) => c?.id === op.component.id);
        if (exists) throw new Error(`DUPLICATE_COMPONENT_ID:${op.component.id}`);
        spec.components.push(op.component);
        applied.push(`addComponent:${op.component.id}`);
        continue;
      }
      if (op.op === "removeComponent") {
        ensureComponentsArray();
        if (!op.componentId) throw new Error("PATCH_MISSING_COMPONENT_ID");
        spec.components = spec.components.filter((c) => c?.id !== op.componentId);
        applied.push(`removeComponent:${op.componentId}`);
        continue;
      }
      if (op.op === "updateComponentProps") {
        ensureComponentsArray();
        if (!op.componentId) throw new Error("PATCH_MISSING_COMPONENT_ID");
        if (!op.propsPatch) throw new Error("PATCH_MISSING_PROPS_PATCH");
        const idx = spec.components.findIndex((c) => c?.id === op.componentId);
        if (idx < 0) throw new Error(`COMPONENT_NOT_FOUND:${op.componentId}`);
        spec.components[idx] = {
          ...spec.components[idx],
          props: { ...spec.components[idx]?.props ?? {}, ...op.propsPatch }
        };
        applied.push(`updateComponentProps:${op.componentId}`);
        continue;
      }
      if (op.op === "moveComponent") {
        ensureComponentsArray();
        if (!op.componentId) throw new Error("PATCH_MISSING_COMPONENT_ID");
        if (!op.layout) throw new Error("PATCH_INVALID_LAYOUT");
        const idx = spec.components.findIndex((c) => c?.id === op.componentId);
        if (idx < 0) throw new Error(`COMPONENT_NOT_FOUND:${op.componentId}`);
        spec.components[idx] = {
          ...spec.components[idx],
          layout: { ...spec.components[idx].layout, ...op.layout }
        };
        applied.push(`moveComponent:${op.componentId}`);
        continue;
      }
      const _exhaustive = op.op;
      throw new Error(`UNKNOWN_PATCH_OP:${String(_exhaustive)}`);
    }
    return { spec_json: spec, design_tokens: tokens, applied };
  }
});

"use strict";
const persistPreviewVersion = createTool({
  id: "persist-preview-version",
  description: "Saves dashboard spec as a new interface version in Supabase",
  inputSchema: z.object({
    tenantId: z.string().uuid(),
    userId: z.string().uuid(),
    interfaceId: z.string().uuid().optional(),
    spec_json: z.record(z.any()),
    design_tokens: z.record(z.any()),
    platformType: z.string()
  }),
  outputSchema: z.object({
    interfaceId: z.string().uuid(),
    versionId: z.string().uuid(),
    previewUrl: z.string()
  }),
  execute: async (inputData, context) => {
    const { tenantId, userId, interfaceId, spec_json, design_tokens, platformType } = inputData;
    const supabase = await createClient();
    let finalInterfaceId = interfaceId;
    if (!finalInterfaceId) {
      const { data: newInterface, error: interfaceError } = await supabase.from("interfaces").insert({
        tenant_id: tenantId,
        name: `${platformType} Dashboard`,
        status: "draft",
        component_pack: "default"
      }).select("id").single();
      if (interfaceError) {
        throw new Error(`Failed to create interface: ${interfaceError.message}`);
      }
      finalInterfaceId = newInterface.id;
    }
    const { data: version, error: versionError } = await supabase.from("interface_versions").insert({
      interface_id: finalInterfaceId,
      spec_json,
      design_tokens,
      created_by: userId
    }).select("id").single();
    if (versionError) {
      throw new Error(`Failed to create version: ${versionError.message}`);
    }
    if (!finalInterfaceId) {
      throw new Error("Failed to create or retrieve interface ID");
    }
    const previewUrl = `/preview/${finalInterfaceId}/${version.id}`;
    return {
      interfaceId: finalInterfaceId,
      versionId: version.id,
      previewUrl
    };
  }
});

"use strict";
const savePreviewVersion = createTool({
  id: "savePreviewVersion",
  description: "Persist a validated spec_json + design_tokens as a new preview interface version. Reads tenantId/userId/interfaceId/platformType from runtimeContext when available.",
  inputSchema: z.object({
    spec_json: z.record(z.any()),
    design_tokens: z.record(z.any()).default({}),
    interfaceId: z.string().uuid().optional()
  }),
  outputSchema: z.object({
    interfaceId: z.string().uuid(),
    versionId: z.string().uuid(),
    previewUrl: z.string()
  }),
  execute: async ({ context, runtimeContext }) => {
    const tenantId = runtimeContext?.get("tenantId");
    const userId = runtimeContext?.get("userId");
    const platformType = runtimeContext?.get("platformType") ?? "make";
    if (!tenantId || !userId) throw new Error("AUTH_REQUIRED");
    const interfaceId = inputData.interfaceId ?? runtimeContext?.get("interfaceId") ?? void 0;
    const result = await persistPreviewVersion.execute({
      context: {
        tenantId,
        userId,
        interfaceId,
        spec_json: inputData.spec_json,
        design_tokens: inputData.design_tokens ?? {},
        platformType
      },
      runtimeContext
    });
    return {
      interfaceId: result.interfaceId,
      versionId: result.versionId,
      previewUrl: result.previewUrl
    };
  }
});

"use strict";

"use strict";
const UISpecSchema = z.object({
  version: z.string(),
  templateId: z.string(),
  platformType: z.string(),
  layout: z.object({
    type: z.string(),
    columns: z.number(),
    gap: z.number()
  }),
  components: z.array(z.object({
    id: z.string(),
    type: z.string(),
    props: z.record(z.any()),
    layout: z.object({
      col: z.number(),
      row: z.number(),
      w: z.number(),
      h: z.number()
    })
  }))
});
const validateSpec = createTool({
  id: "validate-spec",
  description: "Validates dashboard UI specification against schema",
  inputSchema: z.object({
    spec_json: z.record(z.any())
  }),
  outputSchema: z.object({
    valid: z.boolean(),
    errors: z.array(z.string()),
    score: z.number().min(0).max(1)
  }),
  execute: async (inputData, context) => {
    const { spec_json } = inputData;
    try {
      UISpecSchema.parse(spec_json);
      const errors = [];
      if (!spec_json.components || spec_json.components.length === 0) {
        errors.push("Spec must have at least one component");
      }
      const ids = /* @__PURE__ */ new Set();
      spec_json.components?.forEach((comp) => {
        if (ids.has(comp.id)) {
          errors.push(`Duplicate component ID: ${comp.id}`);
        }
        ids.add(comp.id);
      });
      spec_json.components?.forEach((comp) => {
        if (comp.layout.col + comp.layout.w > spec_json.layout.columns) {
          errors.push(`Component ${comp.id} exceeds grid width`);
        }
      });
      const valid = errors.length === 0;
      const score = valid ? 1 : Math.max(0, 1 - errors.length * 0.1);
      return {
        valid,
        errors,
        score
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        valid: false,
        errors: [message],
        score: 0
      };
    }
  }
});

"use strict";
const DensityPreset = z.enum(["compact", "comfortable", "spacious"]);
const ChartType = z.enum(["line", "area", "bar"]);
const EditAction = z.discriminatedUnion("type", [
  z.object({ type: z.literal("toggle_widget"), widgetId: z.string(), enabled: z.boolean() }),
  z.object({ type: z.literal("rename_widget"), widgetId: z.string(), title: z.string().min(1).max(80) }),
  z.object({ type: z.literal("reorder_widgets"), orderedIds: z.array(z.string()).min(2).max(50) }),
  z.object({ type: z.literal("switch_chart_type"), widgetId: z.string(), chartType: ChartType }),
  z.object({ type: z.literal("set_density"), density: DensityPreset }),
  z.object({ type: z.literal("set_palette"), paletteId: z.string() })
]);

"use strict";
const LayoutSchema = z.object({
  col: z.number().int().min(0),
  row: z.number().int().min(0),
  w: z.number().int().min(1),
  h: z.number().int().min(1)
});
const ComponentSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  props: z.record(z.any()),
  layout: LayoutSchema
});
const UISpecSchemaLoose = z.object({
  version: z.string(),
  templateId: z.string(),
  platformType: z.string(),
  layout: z.object({
    type: z.string(),
    columns: z.number(),
    gap: z.number()
  }),
  components: z.array(ComponentSchema)
});
function deepClone(v) {
  return JSON.parse(JSON.stringify(v));
}
const reorderComponents = createTool({
  id: "interactive.reorderComponents",
  description: "Deterministically reorder spec_json.components according to orderedIds. Missing ids appended in original order. Unknown ids ignored.",
  inputSchema: z.object({
    spec_json: z.record(z.any()),
    orderedIds: z.array(z.string()).min(1).max(200)
  }),
  outputSchema: z.object({
    spec_json: z.record(z.any()),
    applied: z.string()
  }),
  execute: async (inputData, context) => {
    const spec = deepClone(inputData.spec_json);
    const parsed = UISpecSchemaLoose.safeParse(spec);
    if (!parsed.success) throw new Error("SPEC_VALIDATION_FAILED");
    const components = parsed.data.components;
    const byId = new Map(components.map((c) => [c.id, c]));
    const seen = /* @__PURE__ */ new Set();
    const reordered = [];
    for (const id of inputData.orderedIds) {
      const c = byId.get(id);
      if (!c) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      reordered.push(c);
    }
    for (const c of components) {
      if (seen.has(c.id)) continue;
      reordered.push(c);
    }
    spec.components = reordered;
    return { spec_json: spec, applied: "reorderComponents" };
  }
});

"use strict";
function densityToSpacingBase(d) {
  if (d === "compact") return 8;
  if (d === "spacious") return 14;
  return 10;
}
const applyInteractiveEdits = createTool({
  id: "interactive.applyEdits",
  description: "Apply interactive edit actions (toggle/rename/switch chart type + density) to current preview spec and persist a new preview version.",
  inputSchema: z.object({
    tenantId: z.string().uuid(),
    userId: z.string().uuid(),
    interfaceId: z.string().uuid(),
    platformType: z.string().min(1),
    actions: z.array(EditAction).min(1).max(30)
  }),
  outputSchema: z.object({
    previewUrl: z.string().url(),
    previewVersionId: z.string().uuid()
  }),
  execute: async ({ context, runtimeContext }) => {
    const current = await getCurrentSpec.execute(
      { context: { tenantId: inputData.tenantId, interfaceId: inputData.interfaceId }, runtimeContext }
    );
    let nextSpec = current.spec_json ?? {};
    let nextTokens = current.design_tokens ?? {};
    const reorderAction = inputData.actions.find((a) => a.type === "reorder_widgets");
    if (reorderAction?.orderedIds?.length) {
      const reordered = await reorderComponents.execute(
        { context: { spec_json: nextSpec, orderedIds: reorderAction.orderedIds }, runtimeContext }
      );
      nextSpec = reordered.spec_json;
    }
    const ops = [];
    for (const a of inputData.actions) {
      if (a.type === "toggle_widget") {
        ops.push({
          op: "updateComponentProps",
          componentId: a.widgetId,
          propsPatch: { hidden: !a.enabled }
        });
      } else if (a.type === "rename_widget") {
        ops.push({
          op: "updateComponentProps",
          componentId: a.widgetId,
          propsPatch: { title: a.title }
        });
      } else if (a.type === "switch_chart_type") {
        ops.push({
          op: "updateComponentProps",
          componentId: a.widgetId,
          propsPatch: { chartType: a.chartType }
        });
      } else if (a.type === "set_density") {
        ops.push({
          op: "setDesignToken",
          tokenPath: "theme.spacing.base",
          tokenValue: densityToSpacingBase(a.density)
        });
      }
    }
    if (ops.length) {
      const patched = await applySpecPatch.execute(
        { context: { spec_json: nextSpec, design_tokens: nextTokens, operations: ops }, runtimeContext }
      );
      nextSpec = patched.spec_json;
      nextTokens = patched.design_tokens;
    }
    const validation = await validateSpec.execute(
      { context: { spec_json: nextSpec }, runtimeContext }
    );
    if (!validation.valid || validation.score < 0.8) throw new Error("INTERACTIVE_EDIT_VALIDATION_FAILED");
    const saved = await savePreviewVersion.execute(
      {
        context: {
          tenantId: inputData.tenantId,
          userId: inputData.userId,
          interfaceId: inputData.interfaceId,
          spec_json: nextSpec,
          design_tokens: nextTokens,
          platformType: inputData.platformType
        },
        runtimeContext
      }
    );
    return { previewUrl: saved.previewUrl, previewVersionId: saved.versionId };
  }
});

"use strict";
const dashboardBuilderAgent = new Agent({
  name: "dashboardBuilderAgent",
  description: "Dashboard Builder Agent: applies safe, incremental edits to an existing dashboard spec and persists validated preview versions.",
  instructions: async ({ requestContext }) => {
    const mode = requestContext.get("mode") ?? "edit";
    const phase = requestContext.get("phase") ?? "editing";
    const platformType = requestContext.get("platformType") ?? "make";
    return [
      {
        role: "system",
        content: "You are the Dashboard Builder Agent (Spec Editor) for GetFlowetic. You own the dashboard spec language and all incremental 'vibe coding' edits. CRITICAL RULES: Never ask the user for tenantId, sourceId, interfaceId, threadId, versionId, or any UUID. Never mention internal IDs. Always use tools to read/modify/persist specs. Never hand-edit JSON in your reply. Never show raw spec JSON unless the user explicitly asks. Always validate before saving. If validation fails, explain the issue in 1\u20132 sentences and propose the next best edit attempt.\n\nDeterministic editing workflow:\n1) Call getCurrentSpec to load the latest spec/version.\n2) Call applySpecPatch with a minimal patch (operations array) to implement the user request.\n3) Call validateSpec with spec_json from applySpecPatch.\n4) If valid and score >= 0.8, call savePreviewVersion to persist and return previewUrl.\n\nPatch operation constraints:\n- Prefer small edits: update component props, add/remove one component, adjust layout, adjust design_tokens.\n- Do not change templateId/platformType unless explicitly requested.\n- Keep component ids stable; when adding a component, create a short deterministic id (kebab-case).\n"
      },
      { role: "system", content: `Mode: ${mode}, Phase: ${phase}, platformType: ${platformType}` },
      {
        role: "system",
        content: "Tools available:\n- getCurrentSpec: load current spec and design tokens\n- applySpecPatch: apply validated operations to spec/design tokens\n- validateSpec: validate spec_json structure and constraints\n- savePreviewVersion: persist validated spec/design tokens (preview) and return previewUrl\n"
      }
    ];
  },
  model: openai("gpt-4o"),
  memory: new Memory({
    options: {
      lastMessages: 20
    }
  }),
  tools: {
    getCurrentSpec,
    applySpecPatch,
    validateSpec,
    savePreviewVersion,
    applyInteractiveEdits,
    reorderComponents,
    getStyleBundles,
    todoAdd,
    todoList,
    todoUpdate,
    todoComplete
  }
});

"use strict";
const appendThreadEvent = createTool({
  id: "appendThreadEvent",
  description: "Append a brief rationale event to the thread timeline (stored in events table). Keep message 1-2 sentences.",
  inputSchema: z.object({
    tenantId: z.string().uuid(),
    threadId: z.string(),
    interfaceId: z.string().uuid().optional(),
    runId: z.string().uuid().optional(),
    type: z.enum(["state", "tool_event", "error", "info"]),
    message: z.string().min(1),
    metadata: z.record(z.any()).optional()
  }),
  outputSchema: z.object({
    eventId: z.string().uuid()
  }),
  execute: async (inputData, context) => {
    const supabase = await createClient();
    const { tenantId, threadId, interfaceId, runId, type, message, metadata } = inputData;
    const { data, error } = await supabase.from("events").insert({
      tenant_id: tenantId,
      interface_id: interfaceId ?? null,
      run_id: runId ?? null,
      type,
      name: "thread_event",
      text: message,
      state: metadata ?? null,
      labels: { threadId },
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { eventId: data.id };
  }
});

"use strict";
const getClientContext = createTool({
  id: "getClientContext",
  description: "Fetch tenant context: connected sources and last event timestamp per source.",
  inputSchema: z.object({
    tenantId: z.string().uuid().optional()
  }),
  outputSchema: z.object({
    tenantId: z.string().uuid(),
    sources: z.array(
      z.object({
        id: z.string().uuid(),
        type: z.string(),
        status: z.string().nullable(),
        lastEventTime: z.string().nullable()
      })
    ),
    entities: z.array(
      z.object({
        sourceId: z.string().uuid(),
        entityKind: z.string(),
        externalId: z.string(),
        displayName: z.string(),
        enabledForAnalytics: z.boolean(),
        enabledForActions: z.boolean(),
        lastSeenAt: z.string().nullable()
      })
    )
  }),
  execute: async ({ context, runtimeContext }) => {
    const supabase = await createClient();
    const tenantId = inputData.tenantId ?? runtimeContext?.get("tenantId") ?? void 0;
    if (!tenantId) {
      throw new Error("AUTH_REQUIRED");
    }
    const { data: sources, error: sourcesError } = await supabase.from("sources").select("id,type,status").eq("tenant_id", tenantId);
    if (sourcesError) throw new Error(sourcesError.message);
    const sourceIds = (sources ?? []).map((s) => s.id);
    const { data: entities, error: entitiesError } = await supabase.from("source_entities").select("source_id,entity_kind,external_id,display_name,enabled_for_analytics,enabled_for_actions,last_seen_at").in("source_id", sourceIds);
    if (entitiesError) throw new Error(entitiesError.message);
    const results = [];
    for (const s of sources ?? []) {
      const { data: lastEvent, error: lastEventError } = await supabase.from("events").select("timestamp").eq("tenant_id", tenantId).eq("source_id", s.id).order("timestamp", { ascending: false }).limit(1).maybeSingle();
      if (lastEventError) throw new Error(lastEventError.message);
      results.push({
        id: s.id,
        type: s.type,
        status: s.status ?? null,
        lastEventTime: lastEvent?.timestamp ?? null
      });
    }
    return {
      tenantId,
      sources: results,
      entities: (entities ?? []).map((e) => ({
        sourceId: e.source_id,
        entityKind: e.entity_kind,
        externalId: e.external_id,
        displayName: e.display_name,
        enabledForAnalytics: e.enabled_for_analytics,
        enabledForActions: e.enabled_for_actions,
        lastSeenAt: e.last_seen_at
      }))
    };
  }
});

"use strict";
const getRecentEventSamples = createTool({
  id: "getRecentEventSamples",
  description: "Fetch recent raw event rows for internal analysis. Do not expose raw JSON to user by default.",
  inputSchema: z.object({
    tenantId: z.string().uuid().optional(),
    sourceId: z.string().uuid().optional(),
    lastN: z.number().int().min(1).max(500).default(100)
  }),
  outputSchema: z.object({
    count: z.number().int(),
    samples: z.array(
      z.object({
        id: z.string().uuid(),
        type: z.string(),
        name: z.string().nullable(),
        text: z.string().nullable(),
        state: z.any().nullable(),
        labels: z.any().nullable(),
        timestamp: z.string()
      })
    )
  }),
  execute: async ({ context, runtimeContext }) => {
    const supabase = await createClient();
    const tenantId = inputData.tenantId ?? runtimeContext?.get("tenantId") ?? void 0;
    const sourceId = inputData.sourceId ?? runtimeContext?.get("sourceId") ?? void 0;
    if (!tenantId) throw new Error("AUTH_REQUIRED");
    if (!sourceId) throw new Error("CONNECTION_NOT_CONFIGURED");
    const { data, error } = await supabase.from("events").select("id,type,name,text,state,labels,timestamp").eq("tenant_id", tenantId).eq("source_id", sourceId).order("timestamp", { ascending: false }).limit(inputData.lastN);
    if (error) throw new Error(error.message);
    return { count: (data ?? []).length, samples: data ?? [] };
  }
});

"use strict";
const getSchemaSummary = createTool({
  id: "getSchemaSummary",
  description: "Summarize event schema and field types from samples",
  inputSchema: z.object({
    samples: z.array(z.any()).describe("Event samples to analyze"),
    includeStatistics: z.boolean().default(true).describe("Include field statistics")
  }),
  outputSchema: z.object({
    fields: z.array(z.object({
      name: z.string(),
      type: z.string(),
      path: z.string(),
      nullable: z.boolean(),
      sampleValue: z.any(),
      frequency: z.number()
    })),
    eventTypes: z.array(z.string()),
    totalEvents: z.number(),
    schemaComplexity: z.enum(["simple", "moderate", "complex"]),
    confidence: z.number()
  }),
  execute: async (inputData, context) => {
    const { samples, includeStatistics } = inputData;
    try {
      if (!samples || samples.length === 0) {
        throw new Error("No samples provided for schema analysis");
      }
      const fieldMap = /* @__PURE__ */ new Map();
      const eventTypes = /* @__PURE__ */ new Set();
      samples.forEach((sample) => {
        if (sample.type) {
          eventTypes.add(String(sample.type));
        }
        extractFieldsFromObject(sample.data || sample, "", fieldMap);
      });
      const fields = Array.from(fieldMap.entries()).map(([path, info]) => ({
        name: path.split(".").pop() || path,
        type: String(info.type),
        path,
        nullable: Boolean(info.nullable),
        sampleValue: info.sampleValue,
        frequency: info.count / samples.length * 100
      }));
      const fieldsCount = fields.length;
      let complexity;
      if (fieldsCount <= 10) {
        complexity = "simple";
      } else if (fieldsCount <= 25) {
        complexity = "moderate";
      } else {
        complexity = "complex";
      }
      return {
        fields,
        eventTypes: Array.from(eventTypes),
        totalEvents: samples.length,
        schemaComplexity: complexity,
        confidence: Math.min(0.95, samples.length / 100)
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to summarize schema: ${message}`);
    }
  }
});
function extractFieldsFromObject(obj, prefix, fieldMap) {
  if (obj === null || typeof obj !== "object") {
    return;
  }
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const fieldPath = prefix ? `${prefix}.${key}` : key;
      const value = obj[key];
      const type = typeof value;
      if (!fieldMap.has(fieldPath)) {
        fieldMap.set(fieldPath, {
          type: type === "object" && Array.isArray(value) ? "array" : type,
          count: 0,
          sampleValue: value,
          nullable: value === null || value === void 0
        });
      }
      const fieldInfo = fieldMap.get(fieldPath);
      fieldInfo.count++;
      if (type === "object" && !Array.isArray(value) && value !== null) {
        extractFieldsFromObject(value, fieldPath, fieldMap);
      }
    }
  }
}

"use strict";
const listTemplates = createTool({
  id: "listTemplates",
  description: "List available dashboard templates",
  inputSchema: z.object({
    platformType: z.string().optional().describe("Filter by platform type"),
    category: z.string().optional().describe("Filter by template category")
  }),
  outputSchema: z.object({
    templates: z.array(z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      category: z.string(),
      platformType: z.string(),
      requiredFields: z.array(z.string()),
      optionalFields: z.array(z.string()),
      supportedEventTypes: z.array(z.string()),
      preview: z.string().optional()
    }))
  }),
  execute: async (inputData, context) => {
    const { platformType, category } = inputData;
    try {
      const templates = [
        {
          id: "call-center-dashboard",
          name: "Call Center Dashboard",
          description: "Comprehensive call center analytics with volume, duration, and performance metrics",
          category: "customer-service",
          platformType: "vapi",
          requiredFields: ["customer.name", "agent.name", "duration", "status"],
          optionalFields: ["outcome", "revenue", "department"],
          supportedEventTypes: ["call.started", "call.ended", "call.missed"],
          preview: "/templates/call-center.png"
        },
        {
          id: "sales-dashboard",
          name: "Sales Performance Dashboard",
          description: "Track sales metrics, conversion rates, and revenue trends",
          category: "sales",
          platformType: "vapi",
          requiredFields: ["customer.name", "outcome", "revenue"],
          optionalFields: ["agent.name", "duration", "department"],
          supportedEventTypes: ["call.ended", "sale.completed", "lead.created"],
          preview: "/templates/sales.png"
        },
        {
          id: "support-dashboard",
          name: "Customer Support Dashboard",
          description: "Monitor support tickets, resolution times, and customer satisfaction",
          category: "customer-service",
          platformType: "vapi",
          requiredFields: ["customer.name", "issue.type", "status"],
          optionalFields: ["resolution.time", "satisfaction.rating"],
          supportedEventTypes: ["ticket.created", "ticket.resolved", "ticket.escalated"],
          preview: "/templates/support.png"
        }
      ];
      let filteredTemplates = templates;
      if (platformType) {
        filteredTemplates = filteredTemplates.filter((t) => t.platformType === platformType);
      }
      if (category) {
        filteredTemplates = filteredTemplates.filter((t) => t.category === category);
      }
      return {
        templates: filteredTemplates
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to list templates: ${message}`);
    }
  }
});

"use strict";
const recommendTemplates = createTool({
  id: "recommendTemplates",
  description: "Recommend up to 3 dashboard templates deterministically based on platform type and schema.",
  inputSchema: z.object({
    platformType: z.enum(["vapi", "retell", "n8n", "mastra", "crewai", "activepieces", "make"]),
    schemaSummary: z.object({
      eventTypes: z.array(z.string()),
      fields: z.array(
        z.object({
          name: z.string(),
          type: z.string(),
          nullable: z.boolean()
        })
      )
    })
  }),
  outputSchema: z.object({
    recommendations: z.array(
      z.object({
        templateId: z.string(),
        confidence: z.number(),
        reason: z.string()
      })
    )
  }),
  execute: async (inputData, context) => {
    const { platformType, schemaSummary } = inputData;
    const fields = new Set(schemaSummary.fields.map((f) => f.name.toLowerCase()));
    const templatesByPlatform = {
      vapi: [{ id: "voice-analytics", required: ["duration", "status"] }],
      retell: [{ id: "voice-analytics", required: ["duration", "status"] }],
      n8n: [{ id: "workflow-monitor", required: ["status"] }],
      mastra: [{ id: "workflow-monitor", required: ["status"] }],
      crewai: [{ id: "workflow-monitor", required: ["status"] }],
      activepieces: [{ id: "workflow-monitor", required: ["status"] }],
      make: [{ id: "general-analytics", required: [] }]
    };
    const candidates = templatesByPlatform[platformType] ?? templatesByPlatform.make;
    const scored = candidates.map((t) => {
      const matched = t.required.filter((r) => {
        for (const f of fields) {
          if (f.includes(r)) return true;
        }
        return false;
      }).length;
      const confidence = t.required.length === 0 ? 0.6 : matched / t.required.length;
      return {
        templateId: t.id,
        confidence,
        reason: t.required.length === 0 ? "Fallback template." : `Matched ${matched}/${t.required.length} required field patterns.`
      };
    });
    scored.sort((a, b) => b.confidence - a.confidence);
    return { recommendations: scored.slice(0, 3) };
  }
});

"use strict";
const proposeMapping = createTool({
  id: "proposeMapping",
  description: "Propose a mapping from observed schema fields to template-required keys. Returns missing required fields and confidence.",
  inputSchema: z.object({
    platformType: z.enum(["vapi", "retell", "n8n", "mastra", "crewai", "activepieces", "make"]),
    templateId: z.string(),
    schemaFields: z.array(z.object({ name: z.string(), type: z.string(), nullable: z.boolean() }))
  }),
  outputSchema: z.object({
    mappings: z.record(z.string()),
    missingFields: z.array(z.string()),
    confidence: z.number()
  }),
  execute: async (inputData, context) => {
    const { templateId, schemaFields } = inputData;
    const available = schemaFields.map((f) => f.name);
    const lower = schemaFields.map((f) => f.name.toLowerCase());
    const findFirst = (candidates) => {
      for (const c of candidates) {
        const idx = lower.findIndex((n) => n === c || n.includes(c));
        if (idx >= 0) return available[idx];
      }
      return null;
    };
    const templateRequirements = {
      "voice-analytics": ["timestamp", "duration", "status"],
      "workflow-monitor": ["timestamp", "status"],
      "general-analytics": ["timestamp"]
    };
    const required = templateRequirements[templateId] ?? ["timestamp"];
    const mappings = {};
    const timestamp = findFirst(["timestamp", "created_at", "createdat", "time", "event_time"]);
    const duration = findFirst(["call_duration", "duration", "call_length", "duration_seconds", "call_duration_seconds"]);
    const status = findFirst(["status", "call_status", "outcome", "execution_status"]);
    if (timestamp) mappings.timestamp = timestamp;
    if (duration) mappings.duration = duration;
    if (status) mappings.status = status;
    const missingFields = required.filter((r) => !mappings[r]);
    const confidence = required.length === 0 ? 1 : (required.length - missingFields.length) / required.length;
    return { mappings, missingFields, confidence };
  }
});

"use strict";
const saveMapping = createTool({
  id: "saveMapping",
  description: "Save mapping configuration to database",
  inputSchema: z.object({
    tenantId: z.string().describe("Tenant ID"),
    userId: z.string().describe("User ID"),
    interfaceId: z.string().describe("Interface ID"),
    templateId: z.string().describe("Template ID"),
    mappings: z.record(z.string()).describe("Field mappings"),
    confidence: z.number().describe("Mapping confidence score"),
    metadata: z.object({
      platformType: z.string(),
      sourceId: z.string(),
      eventTypes: z.array(z.string()),
      unmappedFields: z.array(z.string()).optional()
    })
  }),
  outputSchema: z.object({
    success: z.boolean(),
    mappingId: z.string(),
    savedAt: z.string(),
    confidence: z.number(),
    fieldCount: z.number(),
    requiresReview: z.boolean()
  }),
  execute: async (inputData, context) => {
    const { tenantId, userId, interfaceId, templateId, mappings, confidence, metadata } = inputData;
    try {
      if (!tenantId || !userId || !interfaceId) {
        throw new Error("Missing required identifiers");
      }
      if (!mappings || Object.keys(mappings).length === 0) {
        throw new Error("No mappings provided");
      }
      const mappingId = `mapping_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const mappingRecord = {
        id: mappingId,
        tenantId,
        userId,
        interfaceId,
        templateId,
        mappings,
        confidence,
        metadata,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        status: confidence >= 0.8 ? "approved" : "pending_review"
      };
      console.log("Saving mapping:", JSON.stringify(mappingRecord, null, 2));
      const requiresReview = confidence < 0.7 || Boolean(metadata.unmappedFields && metadata.unmappedFields.length > 0);
      return {
        success: true,
        mappingId,
        savedAt: mappingRecord.createdAt,
        confidence,
        fieldCount: Object.keys(mappings).length,
        requiresReview
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to save mapping: ${message}`);
    }
  }
});

"use strict";
async function triggerGeneratePreview(params) {
  const workflow = mastra.getWorkflow("generatePreview");
  if (!workflow) throw new Error("WORKFLOW_NOT_FOUND");
  const requestContext = new RequestContext();
  requestContext.set("tenantId", params.tenantId);
  requestContext.set("threadId", params.threadId);
  const run = await workflow.createRunAsync();
  const result = await run.start({
    inputData: {
      tenantId: params.tenantId,
      threadId: params.threadId,
      schemaName: params.schemaName,
      selectedStoryboardKey: params.selectedStoryboardKey,
      selectedStyleBundleId: params.selectedStyleBundleId
    },
    requestContext
  });
  if (result.status !== "success") {
    throw new Error(`WORKFLOW_FAILED: ${result.status}`);
  }
  return {
    runId: result.result.runId,
    previewVersionId: result.result.previewVersionId,
    previewUrl: result.result.previewUrl
  };
}

"use strict";
const runGeneratePreviewWorkflow = createTool({
  id: "runGeneratePreviewWorkflow",
  description: "Triggers the generate preview workflow to create a dashboard preview",
  inputSchema: z.object({
    tenantId: z.string().describe("The tenant ID"),
    threadId: z.string().describe("The thread ID"),
    schemaName: z.string().describe("The schema name"),
    selectedStoryboardKey: z.string().describe("The selected storyboard key"),
    selectedStyleBundleId: z.string().describe("The selected style bundle ID")
  }),
  execute: async (inputData, context) => {
    const result = await triggerGeneratePreview({
      tenantId: inputData.tenantId,
      threadId: inputData.threadId,
      schemaName: inputData.schemaName,
      selectedStoryboardKey: inputData.selectedStoryboardKey,
      selectedStyleBundleId: inputData.selectedStyleBundleId
    });
    return result;
  }
});

"use strict";

"use strict";
const getJourneySession = createTool({
  id: "journey.getSession",
  description: "Fetch journey session state for tenant/thread (source of truth for schemaReady).",
  inputSchema: z.object({
    tenantId: z.string().min(1),
    threadId: z.string().min(1)
  }),
  outputSchema: z.object({
    tenantId: z.string(),
    threadId: z.string(),
    platformType: z.string(),
    sourceId: z.string().nullable(),
    entityId: z.string().nullable(),
    mode: z.string(),
    schemaReady: z.boolean(),
    selectedOutcome: z.string().nullable(),
    selectedStoryboard: z.string().nullable(),
    selectedStyleBundleId: z.string().nullable(),
    previewInterfaceId: z.string().nullable(),
    previewVersionId: z.string().nullable()
  }),
  execute: async (inputData) => {
    const supabase = createClient();
    const { data, error } = await supabase.from("journey_sessions").select(
      "tenant_id,thread_id,platform_type,source_id,entity_id,mode,schema_ready,selected_outcome,selected_storyboard,selected_style_bundle_id,preview_interface_id,preview_version_id"
    ).eq("tenant_id", inputData.tenantId).eq("thread_id", inputData.threadId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("JOURNEY_SESSION_NOT_FOUND");
    return {
      tenantId: data.tenant_id,
      threadId: data.thread_id,
      platformType: String(data.platform_type || "other"),
      sourceId: data.source_id ? String(data.source_id) : null,
      entityId: data.entity_id ? String(data.entity_id) : null,
      mode: String(data.mode || "select_entity"),
      schemaReady: Boolean(data.schema_ready),
      selectedOutcome: data.selected_outcome ? String(data.selected_outcome) : null,
      selectedStoryboard: data.selected_storyboard ? String(data.selected_storyboard) : null,
      selectedStyleBundleId: data.selected_style_bundle_id ? String(data.selected_style_bundle_id) : null,
      previewInterfaceId: data.preview_interface_id ? String(data.preview_interface_id) : null,
      previewVersionId: data.preview_version_id ? String(data.preview_version_id) : null
    };
  }
});

"use strict";
const setSchemaReady = createTool({
  id: "journey.setSchemaReady",
  description: "Update journey session schema_ready flag for tenant/thread.",
  inputSchema: z.object({
    tenantId: z.string().min(1),
    threadId: z.string().min(1),
    schemaReady: z.boolean()
  }),
  outputSchema: z.object({ ok: z.boolean() }),
  execute: async (inputData) => {
    const supabase = createClient();
    const { error } = await supabase.from("journey_sessions").update({ schema_ready: inputData.schemaReady, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("tenant_id", inputData.tenantId).eq("thread_id", inputData.threadId);
    if (error) throw new Error(error.message);
    return { ok: true };
  }
});

"use strict";
const PlatformType$1 = z.enum(["vapi", "n8n", "make", "retell"]);
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}
const fetchPlatformEvents = createTool({
  id: "fetchPlatformEvents",
  description: "Fetch historical events from a connected platform API. Studio-first: uses env vars for credentials. Returns raw platform events.",
  inputSchema: z.object({
    tenantId: z.string().min(1),
    sourceId: z.string().min(1),
    platformType: PlatformType$1,
    eventCount: z.number().int().min(1).max(500).default(100)
  }),
  outputSchema: z.object({
    events: z.array(z.any()),
    count: z.number().int(),
    platformType: z.string(),
    fetchedAt: z.string()
  }),
  execute: async (inputData) => {
    const { platformType, eventCount } = inputData;
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (platformType === "vapi") {
          const apiKey = process.env.VAPI_API_KEY;
          if (!apiKey) return { events: [], count: 0, platformType, fetchedAt: nowIso() };
          return { events: [], count: 0, platformType, fetchedAt: nowIso() };
        }
        if (platformType === "n8n") {
          const baseUrl = process.env.N8N_BASE_URL;
          const apiKey = process.env.N8N_API_KEY;
          if (!baseUrl || !apiKey) return { events: [], count: 0, platformType, fetchedAt: nowIso() };
          return { events: [], count: 0, platformType, fetchedAt: nowIso() };
        }
        if (platformType === "make") {
          const baseUrl = process.env.MAKE_BASE_URL;
          const apiKey = process.env.MAKE_API_KEY;
          if (!baseUrl || !apiKey) return { events: [], count: 0, platformType, fetchedAt: nowIso() };
          return { events: [], count: 0, platformType, fetchedAt: nowIso() };
        }
        if (platformType === "retell") {
          const apiKey = process.env.RETELL_API_KEY;
          if (!apiKey) return { events: [], count: 0, platformType, fetchedAt: nowIso() };
          return { events: [], count: 0, platformType, fetchedAt: nowIso() };
        }
        return { events: [], count: 0, platformType, fetchedAt: nowIso() };
      } catch (e) {
        if (attempt === maxRetries) {
          throw new Error(
            `FETCH_PLATFORM_EVENTS_FAILED: ${String(e?.message || e)}`
          );
        }
        await sleep(250 * attempt);
      }
    }
    return { events: [], count: Math.min(eventCount, 0), platformType, fetchedAt: nowIso() };
  }
});

"use strict";
const PlatformType = z.enum(["vapi", "n8n", "make", "retell"]);
const normalizeEvents = createTool({
  id: "normalizeEvents",
  description: "Normalize raw platform events into Flowetic events rows for Supabase insertion. Adds platform_event_id for idempotency.",
  inputSchema: z.object({
    rawEvents: z.array(z.any()),
    platformType: PlatformType,
    sourceId: z.string().min(1),
    tenantId: z.string().min(1)
  }),
  outputSchema: z.object({
    normalizedEvents: z.array(z.record(z.any())),
    count: z.number().int()
  }),
  execute: async (inputData) => {
    const { rawEvents, platformType, sourceId, tenantId } = inputData;
    const normalized = (rawEvents ?? []).map((e, idx) => {
      const platformEventId = String(e?.id ?? e?.eventId ?? e?.executionId ?? e?.callId ?? `${platformType}-${idx}`);
      const ts = e?.timestamp ?? e?.occurred_at ?? e?.created_at ?? e?.ended_at ?? (/* @__PURE__ */ new Date()).toISOString();
      return {
        tenant_id: tenantId,
        source_id: sourceId,
        platform_event_id: platformEventId,
        // Minimal classification
        type: "platform_event",
        name: `${platformType}.event`,
        text: null,
        state: {
          platformType,
          raw: e
        },
        // Prefer existing column name 'timestamp' if your table uses it.
        timestamp: ts,
        labels: { platformType }
      };
    });
    return { normalizedEvents: normalized, count: normalized.length };
  }
});

"use strict";
const storeEvents = createTool({
  id: "storeEvents",
  description: "Bulk insert normalized events into Supabase events table. Skips duplicates via (source_id, platform_event_id) unique index.",
  inputSchema: z.object({
    events: z.array(z.record(z.any())),
    tenantId: z.string().min(1),
    sourceId: z.string().min(1)
  }),
  outputSchema: z.object({
    stored: z.number().int(),
    skipped: z.number().int(),
    errors: z.array(z.string())
  }),
  execute: async (inputData) => {
    const supabase = createClient();
    const rows = inputData.events ?? [];
    if (!rows.length) return { stored: 0, skipped: 0, errors: [] };
    const { data, error } = await supabase.from("events").upsert(rows, {
      onConflict: "source_id,platform_event_id",
      ignoreDuplicates: true
    }).select("id");
    if (error) {
      return { stored: 0, skipped: 0, errors: [error.message] };
    }
    const stored = (data ?? []).length;
    const skipped = Math.max(0, rows.length - stored);
    return { stored, skipped, errors: [] };
  }
});

"use strict";
function inferType(v) {
  if (v === null || v === void 0) return "null";
  if (Array.isArray(v)) return "array";
  const t = typeof v;
  if (t === "number") return Number.isInteger(v) ? "integer" : "number";
  if (t === "boolean") return "boolean";
  if (t === "string") return "string";
  if (t === "object") return "object";
  return "unknown";
}
const generateSchemaSummaryFromEvents = createTool({
  id: "generateSchemaSummaryFromEvents",
  description: "Analyze stored events rows to infer a simple schema summary (fields, types, eventTypes, frequencies) for Phase 1 routing.",
  inputSchema: z.object({
    tenantId: z.string().min(1),
    sourceId: z.string().min(1),
    sampleSize: z.number().int().min(1).max(500).default(100)
  }),
  outputSchema: z.object({
    fields: z.array(
      z.object({
        name: z.string(),
        type: z.string(),
        sample: z.any().optional(),
        nullable: z.boolean().optional()
      })
    ),
    eventTypes: z.array(z.string()),
    eventCounts: z.record(z.number()),
    confidence: z.number().min(0).max(1)
  }),
  execute: async (inputData) => {
    const supabase = createClient();
    const { data, error } = await supabase.from("events").select("type,name,state,labels,timestamp,source_id,tenant_id,platform_event_id").eq("tenant_id", inputData.tenantId).eq("source_id", inputData.sourceId).order("timestamp", { ascending: false }).limit(inputData.sampleSize);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const eventCounts = {};
    const fieldStats = {};
    for (const r of rows) {
      const eventType = String(r?.name ?? r?.type ?? "unknown");
      eventCounts[eventType] = (eventCounts[eventType] ?? 0) + 1;
      const raw = r?.state?.raw;
      if (raw && typeof raw === "object") {
        for (const [k, v] of Object.entries(raw)) {
          const s = fieldStats[k] ??= { types: /* @__PURE__ */ new Set(), nullable: false };
          const t = inferType(v);
          s.types.add(t);
          if (v === null || v === void 0) s.nullable = true;
          if (s.sample === void 0 && v !== void 0) s.sample = v;
        }
      }
    }
    const fields = Object.entries(fieldStats).slice(0, 200).map(([name, s]) => ({
      name,
      type: Array.from(s.types).sort().join("|"),
      sample: s.sample,
      nullable: s.nullable
    }));
    const eventTypes = Object.keys(eventCounts);
    const confidence = Math.min(1, rows.length / Math.max(1, inputData.sampleSize)) * 0.7 + Math.min(0.3, fields.length / 200 * 0.3);
    return { fields, eventTypes, eventCounts, confidence };
  }
});

"use strict";
const updateJourneySchemaReady = createTool({
  id: "updateJourneySchemaReady",
  description: "Marks journey session schemaReady=true for tenant/thread. Uses journey_sessions as source of truth for gating.",
  inputSchema: z.object({
    tenantId: z.string().min(1),
    threadId: z.string().min(1),
    schemaReady: z.boolean()
  }),
  outputSchema: z.object({
    ok: z.boolean()
  }),
  execute: async (inputData) => {
    const supabase = createClient();
    const { tenantId, threadId, schemaReady } = inputData;
    {
      const { error } = await supabase.from("journey_sessions").update({ schema_ready: schemaReady }).eq("tenant_id", tenantId).eq("thread_id", threadId);
      if (!error) return { ok: true };
      const msg = String(error.message || "");
      const isMissingColumn = msg.toLowerCase().includes("schema_ready") && msg.toLowerCase().includes("column");
      if (!isMissingColumn) {
        throw new Error(`JOURNEY_SCHEMA_READY_UPDATE_FAILED: ${error.message}`);
      }
    }
    {
      const { data, error } = await supabase.from("journey_sessions").select("id,state_json").eq("tenant_id", tenantId).eq("thread_id", threadId).maybeSingle();
      if (error) throw new Error(`JOURNEY_SESSION_LOAD_FAILED: ${error.message}`);
      if (!data?.id) throw new Error("JOURNEY_SESSION_NOT_FOUND");
      const state = data.state_json ?? {};
      const next = { ...state, schemaReady };
      const { error: upErr } = await supabase.from("journey_sessions").update({ state_json: next }).eq("id", data.id);
      if (upErr) throw new Error(`JOURNEY_STATE_JSON_UPDATE_FAILED: ${upErr.message}`);
      return { ok: true };
    }
  }
});

"use strict";
const connectionBackfillWorkflow = createWorkflow({
  id: "connectionBackfill",
  description: "Pulls historical events from a connected platform source, normalizes and stores them in Supabase, generates a schema summary, and marks the journey session schemaReady=true.",
  inputSchema: z.object({
    tenantId: z.string().min(1),
    threadId: z.string().min(1),
    sourceId: z.string().min(1),
    platformType: z.enum(["vapi", "n8n", "make", "retell"]),
    eventCount: z.number().int().min(1).max(500).default(100)
  }),
  outputSchema: z.object({
    fetched: z.number().int().min(0),
    normalized: z.number().int().min(0),
    stored: z.number().int().min(0),
    skipped: z.number().int().min(0),
    schema: z.object({
      fields: z.array(
        z.object({
          name: z.string(),
          type: z.string(),
          sample: z.any().optional(),
          nullable: z.boolean().optional()
        })
      ),
      eventTypes: z.array(z.string()),
      eventCounts: z.record(z.number()),
      confidence: z.number().min(0).max(1)
    })
  })
}).then(
  createStep({
    id: "fetchPlatformEventsStep",
    description: "Fetch historical events from the connected platform API.",
    inputSchema: z.object({
      tenantId: z.string(),
      sourceId: z.string(),
      platformType: z.enum(["vapi", "n8n", "make", "retell"]),
      eventCount: z.number().int()
    }),
    outputSchema: z.object({
      events: z.array(z.any()),
      count: z.number().int(),
      platformType: z.string(),
      fetchedAt: z.string()
    }),
    execute: async ({ inputData, requestContext }) => {
      return fetchPlatformEvents.execute(inputData, { requestContext });
    }
  })
).then(
  createStep({
    id: "normalizeEventsStep",
    description: "Normalize raw platform events into Flowetic events row shape.",
    inputSchema: z.object({
      rawEvents: z.array(z.any()),
      platformType: z.enum(["vapi", "n8n", "make", "retell"]),
      sourceId: z.string(),
      tenantId: z.string()
    }),
    outputSchema: z.object({
      normalizedEvents: z.array(z.record(z.any())),
      count: z.number().int()
    }),
    execute: async ({ inputData, requestContext }) => {
      return normalizeEvents.execute(inputData, { requestContext });
    }
  })
).then(
  createStep({
    id: "storeEventsStep",
    description: "Store normalized events into Supabase events table (idempotent).",
    inputSchema: z.object({
      events: z.array(z.record(z.any())),
      tenantId: z.string(),
      sourceId: z.string()
    }),
    outputSchema: z.object({
      stored: z.number().int(),
      skipped: z.number().int(),
      errors: z.array(z.string())
    }),
    execute: async ({ inputData, requestContext }) => {
      return storeEvents.execute(inputData, { requestContext });
    }
  })
).then(
  createStep({
    id: "generateSchemaSummaryStep",
    description: "Generate schema summary from stored events in Supabase.",
    inputSchema: z.object({
      tenantId: z.string(),
      sourceId: z.string(),
      sampleSize: z.number().int().min(1).max(500).default(100)
    }),
    outputSchema: z.object({
      fields: z.array(
        z.object({
          name: z.string(),
          type: z.string(),
          sample: z.any().optional(),
          nullable: z.boolean().optional()
        })
      ),
      eventTypes: z.array(z.string()),
      eventCounts: z.record(z.number()),
      confidence: z.number().min(0).max(1)
    }),
    execute: async ({ inputData, requestContext }) => {
      return generateSchemaSummaryFromEvents.execute(inputData, {
        requestContext
      });
    }
  })
).then(
  createStep({
    id: "updateJourneyStateStep",
    description: "Mark journey_sessions.schemaReady = true for this tenant/thread.",
    inputSchema: z.object({
      tenantId: z.string(),
      threadId: z.string(),
      schemaReady: z.boolean()
    }),
    outputSchema: z.object({
      ok: z.boolean()
    }),
    execute: async ({ inputData, requestContext }) => {
      return updateJourneySchemaReady.execute(inputData, {
        requestContext
      });
    }
  })
).then(
  createStep({
    id: "logConnectionEventStep",
    description: "Append a thread event that connection backfill is complete.",
    inputSchema: z.object({
      tenantId: z.string(),
      threadId: z.string(),
      sourceId: z.string(),
      message: z.string()
    }),
    outputSchema: z.object({
      eventId: z.string().uuid()
    }),
    execute: async ({ inputData, requestContext }) => {
      return appendThreadEvent.execute(
        {
          tenantId: inputData.tenantId,
          threadId: inputData.threadId,
          interfaceId: null,
          runId: null,
          type: "state",
          message: inputData.message,
          metadata: {
            kind: "connectionBackfill",
            sourceId: inputData.sourceId
          }
        },
        { requestContext }
      );
    }
  })
).commit();

"use strict";
const platformMappingMaster = new Agent({
  name: "platformMappingMaster",
  description: "Platform Mapping Agent: inspects event samples, recommends templates, proposes mappings, and triggers preview workflow. Triggers connection backfill when schema is not ready.",
  instructions: async ({ requestContext }) => {
    const platformType = requestContext.get("platformType") || "make";
    const skill = await loadSkillMarkdown(platformType);
    return [
      {
        role: "system",
        content: "CRITICAL RULES: Never ask the user for tenantId, sourceId, interfaceId, threadId, or any UUID. Never mention internal identifiers. Never hallucinate field names. Never show raw JSON unless the user explicitly asks. You are PlatformMappingMaster. Your job is to get the user from connected platform -> preview dashboard generated in minutes. SCHEMA READINESS GATE: You MUST check journey.getSession. If schemaReady is false, you MUST run connectionBackfillWorkflow first, then set journey.setSchemaReady(schemaReady=true), then proceed. Before proposing mapping, use getRecentEventSamples + recommendTemplates + proposeMapping as needed. Write brief rationale via appendThreadEvent (1-2 sentences)."
      },
      { role: "system", content: `Selected platformType: ${platformType}` },
      { role: "system", content: `Platform Skill.md:

${skill}` },
      {
        role: "system",
        content: "When user asks to generate/preview, call runGeneratePreviewWorkflow only AFTER schemaReady is true and mapping is complete."
      }
    ];
  },
  model: openai("gpt-4o"),
  workflows: {
    connectionBackfillWorkflow
  },
  memory: new Memory({
    options: {
      lastMessages: 20
    }
  }),
  tools: {
    // new gating tools
    getJourneySession,
    setSchemaReady,
    // existing platform mapping tools
    appendThreadEvent,
    getClientContext,
    getRecentEventSamples,
    recommendTemplates,
    proposeMapping,
    saveMapping,
    runGeneratePreviewWorkflow,
    getStyleBundles,
    todoAdd,
    todoList,
    todoUpdate,
    todoComplete
  }
});

"use strict";
const analyzeSchema = createTool({
  id: "analyze-schema",
  description: "Analyzes event schema from a data source to detect field types and patterns",
  inputSchema: z.object({
    tenantId: z.string().uuid(),
    sourceId: z.string().uuid(),
    sampleSize: z.number().default(100)
  }),
  outputSchema: z.object({
    fields: z.array(z.object({
      name: z.string(),
      type: z.enum(["string", "number", "boolean", "date", "object", "array"]),
      sample: z.any(),
      nullable: z.boolean()
    })),
    eventTypes: z.array(z.string()),
    confidence: z.number().min(0).max(1)
  }),
  execute: async (inputData, context) => {
    const { tenantId, sourceId, sampleSize } = inputData;
    const supabase = await createClient();
    const { data: events, error } = await supabase.from("events").select("*").eq("tenant_id", tenantId).eq("source_id", sourceId).order("created_at", { ascending: false }).limit(sampleSize);
    if (error || !events || events.length === 0) {
      throw new Error("NO_EVENTS_AVAILABLE");
    }
    const fieldMap = /* @__PURE__ */ new Map();
    const eventTypes = /* @__PURE__ */ new Set();
    events.forEach((event) => {
      eventTypes.add(event.type);
      const fields2 = event.labels || {};
      Object.entries(fields2).forEach(([key, value]) => {
        if (!fieldMap.has(key)) {
          fieldMap.set(key, { type: typeof value, samples: [], nullCount: 0 });
        }
        const field = fieldMap.get(key);
        if (value === null) {
          field.nullCount++;
        } else {
          field.samples.push(value);
        }
      });
      if (event.value !== null) {
        if (!fieldMap.has("value")) {
          fieldMap.set("value", { type: "number", samples: [], nullCount: 0 });
        }
        fieldMap.get("value").samples.push(event.value);
      }
      if (event.text) {
        if (!fieldMap.has("text")) {
          fieldMap.set("text", { type: "string", samples: [], nullCount: 0 });
        }
        fieldMap.get("text").samples.push(event.text);
      }
    });
    const fields = Array.from(fieldMap.entries()).map(([name, data]) => ({
      name,
      type: data.type,
      sample: data.samples[0],
      nullable: data.nullCount > 0
    }));
    const confidence = events.length >= 10 ? 0.9 : 0.6;
    return {
      fields,
      eventTypes: Array.from(eventTypes),
      confidence
    };
  }
});

"use strict";
const selectTemplate = createTool({
  id: "select-template",
  description: "Selects the best dashboard template based on platform type and schema",
  inputSchema: z.object({
    platformType: z.enum(["vapi", "retell", "n8n", "mastra", "crewai", "activepieces", "make"]),
    eventTypes: z.array(z.string()),
    fields: z.array(z.object({
      name: z.string(),
      type: z.string()
    }))
  }),
  outputSchema: z.object({
    templateId: z.string(),
    confidence: z.number().min(0).max(1),
    reason: z.string()
  }),
  execute: async (inputData, context) => {
    const { platformType, eventTypes, fields } = inputData;
    const hasMessages = eventTypes.includes("message");
    const hasMetrics = eventTypes.includes("metric");
    const hasToolEvents = eventTypes.includes("tool_event");
    let templateId = "default";
    let confidence = 0.7;
    let reason = "Using default template";
    if (platformType === "vapi" || platformType === "retell") {
      templateId = "voice-agent-dashboard";
      confidence = 0.95;
      reason = "Voice agent platform detected with call metrics";
    } else if (platformType === "n8n" || platformType === "mastra") {
      templateId = "workflow-dashboard";
      confidence = 0.9;
      reason = "Workflow automation platform with execution tracking";
    } else if (platformType === "crewai") {
      templateId = "multi-agent-dashboard";
      confidence = 0.85;
      reason = "Multi-agent orchestration platform";
    } else if (hasMessages && !hasMetrics) {
      templateId = "chat-dashboard";
      confidence = 0.7;
      reason = "Message-heavy data detected";
    } else if (hasToolEvents) {
      templateId = "workflow-dashboard";
      confidence = 0.75;
      reason = "Tool execution events detected";
    }
    return {
      templateId,
      confidence,
      reason
    };
  }
});

"use strict";
const generateMapping = createTool({
  id: "generate-mapping",
  description: "Maps platform event fields to dashboard template requirements",
  inputSchema: z.object({
    templateId: z.string(),
    fields: z.array(z.object({
      name: z.string(),
      type: z.string()
    })),
    platformType: z.string()
  }),
  outputSchema: z.object({
    mappings: z.record(z.string()),
    missingFields: z.array(z.string()),
    confidence: z.number().min(0).max(1)
  }),
  execute: async (inputData, context) => {
    const { templateId, fields, platformType } = inputData;
    const templateRequirements = {
      "voice-agent-dashboard": ["call_id", "duration", "status", "transcript", "cost"],
      "workflow-dashboard": ["workflow_id", "status", "started_at", "ended_at"],
      "chat-dashboard": ["message_id", "role", "text", "timestamp"],
      "multi-agent-dashboard": ["agent_id", "task", "status", "output"],
      "default": ["id", "timestamp", "type"]
    };
    const required = templateRequirements[templateId] || templateRequirements["default"];
    const fieldNames = fields.map((f) => f.name.toLowerCase());
    const mappings = {};
    const missingFields = [];
    required.forEach((reqField) => {
      const normalized = reqField.toLowerCase().replace(/_/g, "");
      let found = fieldNames.find((f) => f === reqField);
      if (!found) {
        found = fieldNames.find(
          (f) => f.replace(/_/g, "").includes(normalized) || normalized.includes(f.replace(/_/g, ""))
        );
      }
      if (found) {
        mappings[reqField] = found;
      } else {
        missingFields.push(reqField);
      }
    });
    const confidence = Object.keys(mappings).length / required.length;
    return {
      mappings,
      missingFields,
      confidence
    };
  }
});

"use strict";
const generateUISpec = createTool({
  id: "generate-ui-spec",
  description: "Generates dashboard UI specification JSON from template and mappings",
  inputSchema: z.object({
    templateId: z.string(),
    mappings: z.record(z.string()),
    platformType: z.string()
  }),
  outputSchema: z.object({
    spec_json: z.record(z.any()),
    design_tokens: z.record(z.any())
  }),
  execute: async (inputData, context) => {
    const { templateId, mappings, platformType } = inputData;
    const spec_json = {
      version: "1.0",
      templateId,
      platformType,
      layout: {
        type: "grid",
        columns: 12,
        gap: 4
      },
      components: []
    };
    if (templateId === "voice-agent-dashboard") {
      spec_json.components = [
        {
          id: "total-calls",
          type: "MetricCard",
          props: {
            title: "Total Calls",
            valueField: mappings["call_id"] || "id",
            aggregation: "count",
            icon: "phone"
          },
          layout: { col: 0, row: 0, w: 3, h: 2 }
        },
        {
          id: "avg-duration",
          type: "MetricCard",
          props: {
            title: "Avg Duration",
            valueField: mappings["duration"] || "duration",
            aggregation: "avg",
            unit: "seconds",
            icon: "clock"
          },
          layout: { col: 3, row: 0, w: 3, h: 2 }
        },
        {
          id: "success-rate",
          type: "MetricCard",
          props: {
            title: "Success Rate",
            valueField: mappings["status"] || "status",
            aggregation: "percentage",
            condition: { equals: "success" },
            icon: "check-circle"
          },
          layout: { col: 6, row: 0, w: 3, h: 2 }
        },
        {
          id: "total-cost",
          type: "MetricCard",
          props: {
            title: "Total Cost",
            valueField: mappings["cost"] || "cost",
            aggregation: "sum",
            unit: "USD",
            icon: "dollar-sign"
          },
          layout: { col: 9, row: 0, w: 3, h: 2 }
        },
        {
          id: "calls-timeline",
          type: "TimeseriesChart",
          props: {
            title: "Calls Over Time",
            xField: "timestamp",
            yField: mappings["call_id"] || "id",
            aggregation: "count",
            interval: "hour"
          },
          layout: { col: 0, row: 2, w: 8, h: 4 }
        },
        {
          id: "status-breakdown",
          type: "PieChart",
          props: {
            title: "Call Status",
            field: mappings["status"] || "status"
          },
          layout: { col: 8, row: 2, w: 4, h: 4 }
        },
        {
          id: "recent-calls",
          type: "DataTable",
          props: {
            title: "Recent Calls",
            columns: [
              { key: mappings["call_id"] || "id", label: "Call ID" },
              { key: mappings["duration"] || "duration", label: "Duration" },
              { key: mappings["status"] || "status", label: "Status" },
              { key: "timestamp", label: "Time" }
            ],
            pageSize: 10
          },
          layout: { col: 0, row: 6, w: 12, h: 4 }
        }
      ];
    } else {
      spec_json.components = [
        {
          id: "total-events",
          type: "MetricCard",
          props: {
            title: "Total Events",
            valueField: "id",
            aggregation: "count"
          },
          layout: { col: 0, row: 0, w: 4, h: 2 }
        }
      ];
    }
    const design_tokens = {
      colors: {
        primary: "#3b82f6",
        secondary: "#8b5cf6",
        success: "#10b981",
        warning: "#f59e0b",
        error: "#ef4444"
      },
      fonts: {
        heading: "Inter, sans-serif",
        body: "Inter, sans-serif"
      },
      spacing: {
        unit: 4
      }
    };
    return {
      spec_json,
      design_tokens
    };
  }
});

"use strict";
const GeneratePreviewInput = z.object({
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  userRole: z.enum(["admin", "client", "viewer"]),
  interfaceId: z.string().uuid(),
  instructions: z.string().optional()
});
const GeneratePreviewOutput = z.object({
  runId: z.string().uuid(),
  previewVersionId: z.string().uuid(),
  previewUrl: z.string()
});
const analyzeSchemaStep = createStep({
  id: "analyzeSchema",
  inputSchema: z.object({
    tenantId: z.string(),
    userId: z.string(),
    userRole: z.enum(["admin", "client", "viewer"]),
    interfaceId: z.string(),
    instructions: z.string().optional()
  }),
  outputSchema: z.object({
    fields: z.array(z.object({
      name: z.string(),
      type: z.string(),
      sample: z.any(),
      nullable: z.boolean()
    })),
    eventTypes: z.array(z.string()),
    confidence: z.number()
  }),
  async execute({ inputData, runtimeContext }) {
    const sourceId = runtimeContext?.get("sourceId");
    const { tenantId } = inputData;
    const sampleSize = 100;
    if (!tenantId || !sourceId) {
      throw new Error("CONNECTION_NOT_CONFIGURED");
    }
    const result = await analyzeSchema.execute({
      context: {
        tenantId,
        sourceId,
        sampleSize
      },
      runtimeContext
    });
    return result;
  }
});
const selectTemplateStep = createStep({
  id: "selectTemplate",
  inputSchema: analyzeSchemaStep.outputSchema,
  outputSchema: z.object({
    templateId: z.string(),
    confidence: z.number(),
    reason: z.string()
  }),
  async execute({ runtimeContext, getStepResult }) {
    const analyzeResult = getStepResult(analyzeSchemaStep);
    if (!analyzeResult) {
      throw new Error("TEMPLATE_NOT_FOUND");
    }
    const platformType = runtimeContext?.get("platformType") || "make";
    const result = await selectTemplate.execute({
      context: {
        platformType,
        eventTypes: analyzeResult.eventTypes,
        fields: analyzeResult.fields
      },
      runtimeContext
    });
    return result;
  }
});
const generateMappingStep = createStep({
  id: "generateMapping",
  inputSchema: selectTemplateStep.outputSchema,
  outputSchema: z.object({
    mappings: z.record(z.string()),
    missingFields: z.array(z.string()),
    confidence: z.number()
  }),
  async execute({ runtimeContext, getStepResult }) {
    const analyzeResult = getStepResult(analyzeSchemaStep);
    const templateResult = getStepResult(selectTemplateStep);
    if (!analyzeResult || !templateResult) {
      throw new Error("MAPPING_INCOMPLETE_REQUIRED_FIELDS");
    }
    const fields = analyzeResult.fields;
    const templateId = templateResult.templateId;
    const platformType = runtimeContext?.get("platformType") || "make";
    const result = await generateMapping.execute({
      context: {
        templateId,
        fields: analyzeResult.fields,
        platformType
      },
      runtimeContext
    });
    return result;
  }
});
const checkMappingCompletenessStep = createStep({
  id: "checkMappingCompleteness",
  inputSchema: generateMappingStep.outputSchema,
  outputSchema: z.object({
    shouldSuspend: z.boolean(),
    missingFields: z.array(z.string()).optional(),
    message: z.string().optional(),
    decision: z.string()
  }),
  suspendSchema: z.object({
    reason: z.string(),
    missingFields: z.array(z.string()),
    message: z.string().optional()
  }),
  resumeSchema: z.object({
    selectedFieldKey: z.string().optional(),
    confirmed: z.boolean().optional()
  }),
  async execute({ getStepResult, suspend }) {
    const mappingResult = getStepResult(generateMappingStep);
    const missingFields = mappingResult?.missingFields || [];
    if (missingFields.length > 0) {
      await suspend({
        reason: "Required fields missing - needs human input",
        missingFields,
        message: "Please map missing fields and resume."
      });
    }
    return {
      shouldSuspend: false,
      decision: "complete"
    };
  }
});
const generateUISpecStep = createStep({
  id: "generateUISpec",
  inputSchema: z.object({
    shouldSuspend: z.boolean(),
    missingFields: z.array(z.string()).optional(),
    message: z.string().optional(),
    decision: z.string()
  }),
  outputSchema: z.object({
    spec_json: z.record(z.any()),
    design_tokens: z.record(z.any())
  }),
  async execute({ inputData, runtimeContext, getStepResult }) {
    const { shouldSuspend, missingFields, message, decision } = inputData;
    if (shouldSuspend && missingFields && missingFields.length > 0) {
      throw new Error(`INCOMPLETE_MAPPING: ${message || "Missing required fields"}`);
    }
    const templateResult = getStepResult(selectTemplateStep);
    const mappingResult = getStepResult(generateMappingStep);
    if (!templateResult || !mappingResult) {
      throw new Error("SPEC_GENERATION_FAILED");
    }
    const templateId = templateResult.templateId;
    const mappings = mappingResult.mappings;
    const platformType = runtimeContext?.get("platformType") || "make";
    const result = await generateUISpec.execute({
      context: {
        templateId,
        mappings: mappingResult.mappings,
        platformType
      },
      runtimeContext
    });
    return result;
  }
});
const validateSpecStep = createStep({
  id: "validateSpec",
  inputSchema: generateUISpecStep.outputSchema,
  outputSchema: z.object({
    valid: z.boolean(),
    errors: z.array(z.string()),
    score: z.number()
  }),
  async execute({ getStepResult, runtimeContext }) {
    const specResult = getStepResult(generateUISpecStep);
    const spec_json = specResult?.spec_json || {};
    const result = await validateSpec.execute({
      context: {
        spec_json
      },
      runtimeContext
    });
    if (!result.valid || result.score < 0.8) {
      throw new Error("SCORING_HARD_GATE_FAILED");
    }
    return result;
  }
});
const persistPreviewVersionStep = createStep({
  id: "persistPreviewVersion",
  inputSchema: validateSpecStep.outputSchema,
  outputSchema: z.object({
    interfaceId: z.string().uuid(),
    versionId: z.string().uuid(),
    previewUrl: z.string()
  }),
  async execute({ runtimeContext, getStepResult, getInitData }) {
    const initData = getInitData();
    const specResult = getStepResult(generateUISpecStep);
    const spec_json = specResult?.spec_json || {};
    const design_tokens = specResult?.design_tokens || {};
    const tenantId = initData.tenantId;
    const userId = initData.userId;
    const interfaceId = initData.interfaceId;
    const platformType = runtimeContext?.get("platformType") || "make";
    const result = await persistPreviewVersion.execute({
      context: {
        tenantId,
        userId,
        interfaceId,
        spec_json,
        design_tokens,
        platformType
      },
      runtimeContext
    });
    return result;
  }
});
const finalizeStep = createStep({
  id: "finalize",
  inputSchema: persistPreviewVersionStep.outputSchema,
  outputSchema: GeneratePreviewOutput,
  async execute({ getStepResult, runId }) {
    const persistResult = getStepResult(persistPreviewVersionStep);
    return {
      runId,
      previewVersionId: persistResult.versionId,
      previewUrl: persistResult.previewUrl
    };
  }
});
const generatePreviewWorkflow = createWorkflow({
  id: "generatePreview",
  inputSchema: GeneratePreviewInput,
  outputSchema: GeneratePreviewOutput
}).then(analyzeSchemaStep).then(selectTemplateStep).then(generateMappingStep).then(checkMappingCompletenessStep).then(generateUISpecStep).then(validateSpecStep).then(persistPreviewVersionStep).then(finalizeStep).commit();

"use strict";
const getPreviewVersionSpec = createTool({
  id: "deploy.getPreviewVersionSpec",
  description: "Fetch spec_json + design_tokens and interface_id for a preview version.",
  inputSchema: z.object({
    tenantId: z.string().min(1),
    previewVersionId: z.string().min(1)
  }),
  outputSchema: z.object({
    interfaceId: z.string().min(1),
    spec_json: z.record(z.any()),
    design_tokens: z.record(z.any())
  }),
  execute: async (inputData) => {
    const supabase = createClient();
    const { data, error } = await supabase.from("interface_versions").select("id, interface_id, spec_json, design_tokens").eq("id", inputData.previewVersionId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data?.interface_id) throw new Error("PREVIEW_VERSION_NOT_FOUND");
    return {
      interfaceId: String(data.interface_id),
      spec_json: data.spec_json ?? {},
      design_tokens: data.design_tokens ?? {}
    };
  }
});

"use strict";
const createDeploymentRecord = createTool({
  id: "deploy.createDeploymentRecord",
  description: "Create a deployment record for an interface/version.",
  inputSchema: z.object({
    tenantId: z.string().min(1),
    interfaceId: z.string().min(1),
    previewVersionId: z.string().min(1)
  }),
  outputSchema: z.object({
    deploymentId: z.string().min(1)
  }),
  execute: async (inputData) => {
    const supabase = createClient();
    const { data, error } = await supabase.from("deployments").insert({
      tenant_id: inputData.tenantId,
      interface_id: inputData.interfaceId,
      version_id: inputData.previewVersionId,
      status: "active"
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { deploymentId: String(data.id) };
  }
});

"use strict";
const markPreviousDeploymentsInactive = createTool({
  id: "deploy.markPreviousDeploymentsInactive",
  description: "Mark all previous deployments inactive except the current one.",
  inputSchema: z.object({
    tenantId: z.string().min(1),
    interfaceId: z.string().min(1),
    keepDeploymentId: z.string().min(1)
  }),
  outputSchema: z.object({ ok: z.boolean() }),
  execute: async (inputData) => {
    const supabase = createClient();
    const { error } = await supabase.from("deployments").update({ status: "inactive" }).eq("tenant_id", inputData.tenantId).eq("interface_id", inputData.interfaceId).neq("id", inputData.keepDeploymentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  }
});

"use strict";
const setInterfacePublished = createTool({
  id: "deploy.setInterfacePublished",
  description: "Set interfaces.status='published' and active_version_id to the deployed version.",
  inputSchema: z.object({
    tenantId: z.string().min(1),
    interfaceId: z.string().min(1),
    previewVersionId: z.string().min(1)
  }),
  outputSchema: z.object({ ok: z.boolean() }),
  execute: async (inputData) => {
    const supabase = createClient();
    const { error } = await supabase.from("interfaces").update({
      status: "published",
      active_version_id: inputData.previewVersionId
    }).eq("tenant_id", inputData.tenantId).eq("id", inputData.interfaceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  }
});

"use strict";
const generatePortalUrl = createTool({
  id: "deploy.generatePortalUrl",
  description: "Generate the deployed portal URL for a dashboard deployment.",
  inputSchema: z.object({
    tenantId: z.string().min(1),
    interfaceId: z.string().min(1),
    deploymentId: z.string().min(1)
  }),
  outputSchema: z.object({
    deployedUrl: z.string().min(1)
  }),
  execute: async (inputData) => {
    const base = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL?.startsWith("http") ? process.env.VERCEL_URL : process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";
    return {
      deployedUrl: `${base}/portal/${encodeURIComponent(inputData.tenantId)}/dashboards/${encodeURIComponent(
        inputData.interfaceId
      )}`
    };
  }
});

"use strict";
const setJourneyDeployed = createTool({
  id: "deploy.setJourneyDeployed",
  description: "Update journey_sessions preview pointers after deploy (keep current schema).",
  inputSchema: z.object({
    tenantId: z.string().min(1),
    threadId: z.string().min(1),
    interfaceId: z.string().min(1),
    previewVersionId: z.string().min(1)
  }),
  outputSchema: z.object({ ok: z.boolean() }),
  execute: async (inputData) => {
    const supabase = createClient();
    const { error } = await supabase.from("journey_sessions").update({
      preview_interface_id: inputData.interfaceId,
      preview_version_id: inputData.previewVersionId,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("tenant_id", inputData.tenantId).eq("thread_id", inputData.threadId);
    if (error) throw new Error(error.message);
    return { ok: true };
  }
});

"use strict";
const deployDashboardWorkflow = createWorkflow({
  id: "deployDashboard",
  description: "Deploy a preview dashboard version to the client portal with validation, confirmation gating, deployment versioning, and audit events.",
  inputSchema: z.object({
    tenantId: z.string().min(1),
    userId: z.string().min(1),
    threadId: z.string().min(1),
    previewVersionId: z.string().min(1),
    confirmed: z.boolean()
  }),
  outputSchema: z.object({
    deploymentId: z.string().min(1),
    deployedUrl: z.string().min(1),
    status: z.string().min(1)
  })
}).then(
  createStep({
    id: "revalidateSpecStep",
    description: "Load preview spec and re-validate before deploy (hard gate).",
    inputSchema: z.object({
      tenantId: z.string(),
      previewVersionId: z.string()
    }),
    outputSchema: z.object({
      interfaceId: z.string().min(1),
      spec_json: z.record(z.any()),
      design_tokens: z.record(z.any())
    }),
    execute: async ({ inputData, requestContext }) => {
      const pv = await getPreviewVersionSpec.execute(inputData, {
        requestContext
      });
      const v = await validateSpec.execute(
        { spec_json: pv.spec_json },
        { requestContext }
      );
      if (!v.valid || v.score < 0.8) {
        throw new Error("DEPLOY_SPEC_VALIDATION_FAILED");
      }
      return pv;
    }
  })
).then(
  createStep({
    id: "checkUserConfirmationStep",
    description: "Verify user confirmation (HITL gate).",
    inputSchema: z.object({
      confirmed: z.boolean()
    }),
    outputSchema: z.object({ ok: z.boolean() }),
    execute: async ({ inputData }) => {
      if (!inputData.confirmed) throw new Error("DEPLOY_CONFIRMATION_REQUIRED");
      return { ok: true };
    }
  })
).then(
  createStep({
    id: "createDeploymentRecordStep",
    description: "Create deployment record in Supabase.",
    inputSchema: z.object({
      tenantId: z.string(),
      interfaceId: z.string(),
      previewVersionId: z.string()
    }),
    outputSchema: z.object({
      deploymentId: z.string().min(1)
    }),
    execute: async ({ inputData, requestContext }) => {
      return createDeploymentRecord.execute(inputData, {
        requestContext
      });
    }
  })
).then(
  createStep({
    id: "markPreviousInactiveStep",
    description: "Mark previous deployments inactive for this interface.",
    inputSchema: z.object({
      tenantId: z.string(),
      interfaceId: z.string(),
      keepDeploymentId: z.string()
    }),
    outputSchema: z.object({ ok: z.boolean() }),
    execute: async ({ inputData, requestContext }) => {
      return markPreviousDeploymentsInactive.execute(inputData, {
        requestContext
      });
    }
  })
).then(
  createStep({
    id: "updateInterfaceStatusStep",
    description: "Set interface status to published and active version pointer.",
    inputSchema: z.object({
      tenantId: z.string(),
      interfaceId: z.string(),
      previewVersionId: z.string()
    }),
    outputSchema: z.object({ ok: z.boolean() }),
    execute: async ({ inputData, requestContext }) => {
      return setInterfacePublished.execute(inputData, {
        requestContext
      });
    }
  })
).then(
  createStep({
    id: "generatePortalUrlStep",
    description: "Generate portal URL for deployed dashboard.",
    inputSchema: z.object({
      tenantId: z.string(),
      interfaceId: z.string(),
      deploymentId: z.string()
    }),
    outputSchema: z.object({
      deployedUrl: z.string().min(1)
    }),
    execute: async ({ inputData, requestContext }) => {
      return generatePortalUrl.execute(inputData, { requestContext });
    }
  })
).then(
  createStep({
    id: "logDeploymentEventStep",
    description: "Append thread event for deployment success.",
    inputSchema: z.object({
      tenantId: z.string(),
      threadId: z.string(),
      interfaceId: z.string(),
      deploymentId: z.string(),
      deployedUrl: z.string()
    }),
    outputSchema: z.object({ ok: z.boolean() }),
    execute: async ({ inputData, requestContext }) => {
      await appendThreadEvent.execute(
        {
          tenantId: inputData.tenantId,
          threadId: inputData.threadId,
          interfaceId: inputData.interfaceId,
          runId: null,
          type: "state",
          message: `Deployed successfully. Portal URL ready.`,
          metadata: {
            deploymentId: inputData.deploymentId,
            deployedUrl: inputData.deployedUrl
          }
        },
        { requestContext }
      );
      return { ok: true };
    }
  })
).then(
  createStep({
    id: "updateJourneySessionPointersStep",
    description: "Write deployed pointers back to journey_sessions (keep schema the same).",
    inputSchema: z.object({
      tenantId: z.string(),
      threadId: z.string(),
      interfaceId: z.string(),
      previewVersionId: z.string()
    }),
    outputSchema: z.object({ ok: z.boolean() }),
    execute: async ({ inputData, requestContext }) => {
      return setJourneyDeployed.execute(inputData, { requestContext });
    }
  })
).then(
  createStep({
    id: "completeTodosStep",
    description: "Complete deploy-related todos (best-effort).",
    inputSchema: z.object({
      tenantId: z.string(),
      threadId: z.string()
    }),
    outputSchema: z.object({ ok: z.boolean() }),
    execute: async ({ inputData, requestContext }) => {
      try {
        await todoComplete.execute(
          {
            tenantId: inputData.tenantId,
            threadId: inputData.threadId,
            todoId: "deploy"
            // placeholder convention; update later when you have real todo ids
          },
          { requestContext }
        );
      } catch {
      }
      return { ok: true };
    }
  })
).then(
  createStep({
    id: "finalize",
    description: "Finalize deploy output.",
    inputSchema: z.object({
      deploymentId: z.string(),
      deployedUrl: z.string()
    }),
    outputSchema: z.object({
      deploymentId: z.string(),
      deployedUrl: z.string(),
      status: z.string()
    }),
    execute: async ({ inputData }) => {
      return { ...inputData, status: "published" };
    }
  })
).commit();

"use strict";
const masterRouterAgent = new Agent({
  name: "masterRouterAgent",
  description: "Master Router Agent (Copilot-connected). Enforces the VibeChat journey phases and routes to platform mapping, design advisor, and dashboard builder.",
  instructions: async ({ requestContext }) => {
    const platformType = requestContext.get("platformType") || "make";
    const platformSkill = await loadSkillMarkdown(platformType);
    const businessSkill = await loadNamedSkillMarkdown("business-outcomes-advisor");
    const workflowName = requestContext.get("workflowName");
    const selectedOutcome = requestContext.get("selectedOutcome");
    return [
      {
        role: "system",
        content: [
          "# IDENTITY & ROLE",
          "You are a premium agency business consultant helping non-technical clients build custom dashboards.",
          "Your job is to guide users naturally through decisions and ensure deployment success.",
          "",
          "# CRITICAL COMMUNICATION RULES (NEVER VIOLATE)",
          "1. NEVER mention numbered phases, steps, or journey stages to the user",
          "   - WRONG: 'Phase 1 is outcome selection' or 'We're in Phase 2'",
          "   - RIGHT: 'Great choice. Now let's pick a style.'",
          "",
          "2. NEVER explain the multi-step process or provide roadmaps",
          "   - WRONG: 'First we'll select outcome, then align goals, then style...'",
          "   - RIGHT: 'I recommend starting with a dashboard.'",
          "",
          "3. Focus on the CURRENT decision, not the process",
          "",
          "# RESPONSE STYLE",
          "- Use plain, conversational language",
          "- Avoid jargon: 'execution status', 'success rates', 'optimize processes'",
          "- Be concise (2-3 sentences max)",
          "- Sound consultative, not robotic",
          "",
          "# CONVERSATION PATTERNS",
          "",
          "## When Recommending",
          "- Format: 'I recommend [X].'",
          "- Give exactly 2 bullet reasons",
          "- End with: 'Pick one of the cards above/below.'",
          "",
          "## When User Selects",
          "- Acknowledge: 'Great choice' or 'Perfect'",
          "- Bridge: 'Now let's [next decision]'",
          "- NO phase explanations",
          "",
          "## When User Is Unsure",
          "- Ask MAX 2 consultative questions",
          "- Focus on business goals",
          "- Return to recommendation",
          "",
          "# CURRENT CONTEXT",
          workflowName ? `- Selected workflow: "${workflowName}"` : "- No workflow selected",
          selectedOutcome ? `- User chose: ${selectedOutcome}` : "- No outcome chosen",
          "",
          "# BUSINESS CONSULTANT EXPERTISE",
          businessSkill || "[Business skill not loaded]",
          "",
          "# PLATFORM KNOWLEDGE",
          platformSkill || "[Platform skill not loaded]",
          "",
          "# CAPABILITIES",
          "You can manage Connections (sources): create, list, update, and delete platform connections for the tenant.",
          "You can manage Projects: create, list, update, and delete projects for the tenant.",
          "You can return a navigation URL using the navigation.navigateTo tool when you want the UI to move to a specific page."
        ].join("\n")
      },
      {
        role: "system",
        content: [
          "# INTERNAL ROUTING STATES (FOR YOUR LOGIC ONLY)",
          "(USER NEVER SEES THESE STATE NAMES)",
          "",
          "States: select_entity \u2192 recommend \u2192 align \u2192 style \u2192 build_preview \u2192 interactive_edit \u2192 deploy",
          "",
          "YOU USE STATES FOR ROUTING.",
          "USER NEVER HEARS STATE NAMES.",
          "",
          "Example:",
          "- State 'recommend' \u2192 You say: 'I recommend a dashboard.'",
          "- State 'align' \u2192 You say: 'Now let's pick the story.'",
          "- State 'style' \u2192 You say: 'Choose a style bundle.'"
        ].join("\n")
      }
    ];
  },
  model: openai("gpt-4o"),
  // REQUIRED: routing primitives for Agent.network()
  agents: {
    platformMappingMaster,
    dashboardBuilderAgent,
    designAdvisorAgent
  },
  workflows: {
    generatePreviewWorkflow,
    connectionBackfillWorkflow,
    deployDashboardWorkflow
  },
  memory: new Memory({
    options: {
      lastMessages: 20
    }
  }),
  tools: {
    todoAdd,
    todoList,
    todoUpdate,
    todoComplete,
    // Sources CRUD
    createSource,
    listSources,
    updateSource,
    deleteSource,
    // Projects CRUD
    createProject,
    listProjects,
    updateProject,
    deleteProject,
    // Navigation
    navigateTo
  }
});

"use strict";
const mastra = new Mastra({
  telemetry: {
    enabled: true
  },
  storage: new LibSQLStore({
    id: "mastra-storage",
    url: process.env.MASTRA_STORAGE_URL || "file:./mastra.db",
    authToken: process.env.TURSO_AUTH_TOKEN
  }),
  agents: {
    masterRouterAgent,
    platformMappingMaster,
    dashboardBuilderAgent,
    designAdvisorAgent,
    default: masterRouterAgent
  },
  workflows: {
    generatePreview: generatePreviewWorkflow,
    connectionBackfill: connectionBackfillWorkflow,
    deployDashboard: deployDashboardWorkflow
  }
});

export { mastra };
