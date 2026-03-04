/**
 * extractInputSchema — Auto-generate form fields from workflow/agent data
 *
 * Reads raw n8n nodes, Make modules, or Vapi/Retell agent configs
 * and produces an InputField[] array that FormWizard can render.
 *
 * Pure function. No side effects. No API calls. No Supabase.
 */

import type { InputField } from "./types";

type Dict = Record<string, unknown>;

type FieldType = InputField["type"];

// ── Helpers ──────────────────────────────────────────────────

function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, "_$1")
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_/, "")
    .toLowerCase();
}

function toTitleCase(str: string): string {
  return str
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function inferFieldType(key: string, value?: unknown): FieldType {
  const k = key.toLowerCase();
  if (k.includes("email")) return "email";
  if (k.includes("phone") || k.includes("tel")) return "phone";
  if (k.includes("url") || k.includes("website") || k.includes("link")) return "url";
  if (k.includes("date")) return "date";
  if (k.includes("amount") || k.includes("price") || k.includes("cost") || k.includes("quantity") || k.includes("count") || k.includes("number") || k.includes("age")) return "number";
  if (k.includes("description") || k.includes("message") || k.includes("body") || k.includes("content") || k.includes("notes") || k.includes("text") || k.includes("prompt")) return "textarea";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "select";
  return "text";
}

const SKIP_KEYS = new Set([
  "httpMethod", "path", "authentication", "options", "responseMode",
  "responseData", "responseCode", "responseHeaders", "rawBody",
  "connection", "__IMTCONN__", "scenario", "webhook", "maxResults",
  "limit", "offset", "cursor", "page", "headers",
]);

function shouldSkip(key: string): boolean {
  if (SKIP_KEYS.has(key)) return true;
  if (key.startsWith("_") || key.startsWith("__")) return true;
  return false;
}

function asDict(value: unknown): Dict {
  return typeof value === "object" && value !== null ? (value as Dict) : {};
}

function asDictArray(value: unknown): Dict[] {
  return Array.isArray(value) ? value.map((v) => asDict(v)) : [];
}

// ── n8n Extractor ────────────────────────────────────────────

function extractFromN8n(nodes: Dict[]): InputField[] {
  const fields: InputField[] = [];
  const seenNames = new Set<string>();

  const triggerNode = nodes.find((n) => {
    const type = typeof n.type === "string" ? n.type.toLowerCase() : "";
    return type.includes("trigger") || type.includes("webhook") || n.type === "n8n-nodes-base.webhook";
  });

  const triggerParams = asDict(triggerNode?.parameters);
  for (const [key, value] of Object.entries(triggerParams)) {
    if (shouldSkip(key)) continue;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) continue;
    const name = toSnakeCase(key);
    if (seenNames.has(name)) continue;
    seenNames.add(name);
    fields.push({
      name,
      type: inferFieldType(key, value),
      label: toTitleCase(key),
      required: true,
      placeholder: `Enter ${toTitleCase(key).toLowerCase()}`,
    });
  }

  if (fields.length === 0) {
    for (const node of nodes) {
      if (node.type !== "n8n-nodes-base.set") continue;
      const assignments = asDictArray(asDict(asDict(node.parameters).assignments).assignments);
      for (const assignment of assignments) {
        const val = typeof assignment.value === "string" ? assignment.value : "";
        if (val.includes("{{") || val.includes("$json") || val.includes("$input")) {
          const assignmentName = typeof assignment.name === "string" ? assignment.name : "input";
          const name = toSnakeCase(assignmentName);
          if (seenNames.has(name)) continue;
          seenNames.add(name);
          fields.push({
            name,
            type: inferFieldType(assignmentName),
            label: toTitleCase(assignmentName || "Input"),
            required: false,
            placeholder: `Enter ${toTitleCase(assignmentName).toLowerCase()}`,
          });
        }
      }
    }
  }

  if (fields.length === 0) {
    for (const node of nodes) {
      if (
        node.type !== "n8n-nodes-base.function" &&
        node.type !== "n8n-nodes-base.functionItem" &&
        node.type !== "n8n-nodes-base.code"
      ) {
        continue;
      }
      const nodeParams = asDict(node.parameters);
      const code =
        typeof nodeParams.functionCode === "string"
          ? nodeParams.functionCode
          : typeof nodeParams.jsCode === "string"
            ? nodeParams.jsCode
            : "";
      const matches = code.match(/\$input\.(?:first|last|all|item)\.json\.(\w+)/g) || [];
      for (const match of matches) {
        const varName = match.split(".").pop() || "";
        if (!varName || seenNames.has(varName)) continue;
        seenNames.add(varName);
        fields.push({
          name: toSnakeCase(varName),
          type: inferFieldType(varName),
          label: toTitleCase(varName),
          required: false,
        });
      }
    }
  }

  return fields;
}

// ── Make Extractor ───────────────────────────────────────────

function extractFromMake(modules: Dict[]): InputField[] {
  const fields: InputField[] = [];
  const seenNames = new Set<string>();

  if (!modules.length) return fields;

  const triggerParams = asDict(modules[0]?.parameters);
  for (const [key, value] of Object.entries(triggerParams)) {
    if (shouldSkip(key)) continue;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) continue;
    const name = toSnakeCase(key);
    if (seenNames.has(name)) continue;
    seenNames.add(name);
    fields.push({
      name,
      type: inferFieldType(key, value),
      label: toTitleCase(key),
      required: true,
      placeholder: `Enter ${toTitleCase(key).toLowerCase()}`,
    });
  }

  return fields;
}

// ── Voice Agent Extractor (Vapi / Retell) ────────────────────

function extractForVoiceAgent(platform: string, agentData: Dict): InputField[] {
  const fields: InputField[] = [
    {
      name: "phone_number",
      type: "phone",
      label: "Phone Number",
      required: true,
      placeholder: "+1 (555) 123-4567",
    },
    {
      name: "customer_name",
      type: "text",
      label: "Customer Name",
      required: true,
      placeholder: "Full name",
    },
  ];

  const promptText =
    platform === "vapi"
      ? typeof asDict(asDict(asDict(agentData.model).messages)[0]).content === "string"
        ? (asDict(asDict(agentData.model).messages)[0] as Dict).content as string
        : ""
      : typeof agentData.general_prompt === "string"
        ? agentData.general_prompt
        : agentData.llm_websocket_url
          ? ""
          : typeof asDict(asDict(asDict(agentData.response_engine).llm).general_prompt) === "string"
            ? (asDict(asDict(agentData.response_engine).llm).general_prompt as string)
            : "";

  const variablePattern = /\{\{(\w+)\}\}/g;
  const seenNames = new Set(["phone_number", "customer_name"]);
  let match: RegExpExecArray | null;

  while ((match = variablePattern.exec(promptText)) !== null) {
    const varName = match[1];
    if (seenNames.has(varName.toLowerCase())) continue;
    seenNames.add(varName.toLowerCase());
    fields.push({
      name: toSnakeCase(varName),
      type: inferFieldType(varName),
      label: toTitleCase(varName),
      required: false,
      placeholder: `Enter ${toTitleCase(varName).toLowerCase()}`,
    });
  }

  return fields;
}

function fallbackFields(): InputField[] {
  return [
    {
      name: "input_text",
      type: "textarea",
      label: "Input",
      required: true,
      placeholder: "Enter your input...",
    },
    {
      name: "email",
      type: "email",
      label: "Your Email",
      required: true,
      placeholder: "you@example.com",
    },
  ];
}

// ── Main Dispatcher ──────────────────────────────────────────

/**
 * Given a platform type and raw entity data (workflow nodes, scenario modules,
 * or agent config), returns an array of InputField[] for the form wizard.
 *
 * If nothing can be detected, returns sensible fallback fields.
 */
export function extractInputSchema(
  platformType: string,
  entityData: Dict
): InputField[] {
  let fields: InputField[] = [];

  switch (platformType) {
    case "n8n":
      fields = extractFromN8n(asDictArray(entityData.nodes));
      break;
    case "make":
      fields = extractFromMake(
        asDictArray(entityData.modules).length ? asDictArray(entityData.modules) : asDictArray(entityData.flow)
      );
      break;
    case "vapi":
    case "retell":
      fields = extractForVoiceAgent(platformType, entityData);
      break;
    default:
      break;
  }

  if (fields.length === 0) {
    fields = fallbackFields();
  }

  return fields;
}
