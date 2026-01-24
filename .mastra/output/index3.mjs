import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { openai } from '@ai-sdk/openai';
import fs from 'node:fs/promises';
import path from 'node:path';
import { todoComplete } from './tools/cf5efe7c-4e65-4cb9-9544-cf36b5357056.mjs';
import { todoUpdate } from './tools/1afcf7e0-2d05-4d4c-a5a0-6bfb3db9d115.mjs';
import { todoList } from './tools/3e8d420d-bd46-4433-8062-04e656e360d1.mjs';
import { todoAdd } from './tools/355a8ae3-f9b2-4b14-a1dd-abae8e00f517.mjs';
import { getStyleBundles } from './tools/c62a3f79-b10f-45c7-88ad-14d4d2571315.mjs';
import { searchDesignKBLocal } from './tools/0651ae69-eb0a-46c6-94f6-fc952ff9b107.mjs';
import { searchDesignKB } from './tools/49bdfde7-d37e-4b87-8633-fb85901dca6d.mjs';
import { validateSpec } from './tools/8f8fbf39-d697-4727-9f57-93eed5df67ea.mjs';
import { applyInteractiveEdits } from './tools/b50bedc4-9a55-48d4-ad9f-588c81b24be4.mjs';
import { reorderComponents } from './tools/71a5c419-b5ff-4dbc-8b03-154d3d4f66d5.mjs';
import { savePreviewVersion } from './tools/83cb9653-4043-4ed3-93ed-b62d3019c72f.mjs';
import { applySpecPatch } from './tools/62c15984-69dd-428e-8bef-b2843e58c020.mjs';
import { getCurrentSpec } from './tools/22a82169-bcc4-4704-8c07-646802f3136f.mjs';
import { getJourneySession } from './tools/ad1ae531-d5a7-47ee-824e-74967fe53ccb.mjs';
import { setSchemaReady } from './tools/101c8c0c-2e44-42bc-a439-d2f8cd6e9c2c.mjs';
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { fetchPlatformEvents } from './tools/7103e8ab-2067-4507-add1-b16592e38108.mjs';
import { normalizeEvents } from './tools/07a6c1bd-0717-44a2-a1b4-218c70171a9e.mjs';
import { storeEvents } from './tools/fbbcb19f-f3b4-452d-9c4c-0f25824c26f3.mjs';
import { generateSchemaSummaryFromEvents } from './tools/000334a3-1ff8-4471-8ca9-3e2d1080933c.mjs';
import { updateJourneySchemaReady } from './tools/ac4b566f-fdcd-4371-868d-0c20b0d4698a.mjs';
import { appendThreadEvent } from './tools/2ab3f100-411c-4793-99dc-515010e5ed2a.mjs';
import { createTool } from '@mastra/core/tools';
import { analyzeSchema } from './tools/49dd7d87-8691-4638-b5e4-1397ea6f5b2c.mjs';
import { selectTemplate } from './tools/a1a315b8-b6b2-4f11-844e-8d1af20d9c9f.mjs';
import { generateMapping } from './tools/d32fb4eb-f470-4bac-b1f3-de729e8aa5ec.mjs';
import { generateUISpec } from './tools/98ca5d12-aad7-498f-a007-b056cd6c28df.mjs';
import { persistPreviewVersion } from './tools/2afe9f7b-3baa-40e6-b81f-d049ec3a95c3.mjs';
import { getPreviewVersionSpec } from './tools/7644cefe-91e6-443c-8283-d37c2ea2b82c.mjs';
import { createDeploymentRecord } from './tools/e07a89d8-8063-4f9f-8168-737e2bc34811.mjs';
import { markPreviousDeploymentsInactive } from './tools/fd1848f1-a95c-4709-804d-11aa7872bec6.mjs';
import { setInterfacePublished } from './tools/acd1bb5b-a609-4c53-9d63-6fa22a842d88.mjs';
import { generatePortalUrl } from './tools/971d339b-fb13-4e0f-8529-0d8106ac4586.mjs';
import { setJourneyDeployed } from './tools/5c581831-948a-45b3-b9bc-b2db7d0813d7.mjs';
import { RequestContext } from '@mastra/core/request-context';
import { saveMapping } from './tools/70ac6b4b-d43e-488c-8c7a-93cb63d966bf.mjs';
import { proposeMapping } from './tools/1a2f3f7a-c3be-4f30-8fc9-e8a68eb06fbc.mjs';
import { recommendTemplates } from './tools/2f5d8d0a-4c83-4294-a2ff-8f1cbd4d9ec8.mjs';
import { getRecentEventSamples } from './tools/74c49e6f-ac24-4b22-b0fd-198bff9573fb.mjs';
import { getClientContext } from './tools/3c1cbbdd-2671-4398-bb29-41ab6e1a39e8.mjs';
import { navigateTo } from './tools/dc28c4bf-e3c4-4e06-96ee-7f508051732b.mjs';
import { deleteProject } from './tools/03ac37c8-15da-4c4b-ac69-68fd4e06209a.mjs';
import { updateProject } from './tools/3318239b-d8e9-4345-a22f-68ba0beae1b4.mjs';
import { listProjects } from './tools/e74616ea-4168-42f7-9c99-da97a53e787c.mjs';
import { createProject } from './tools/e825fca3-62a8-47b8-9550-b79b59d74b78.mjs';
import { deleteSource } from './tools/2e180490-ab48-44f0-8308-6a307a7beed7.mjs';
import { updateSource } from './tools/19a7ad5b-03c3-4c9a-8e78-66a92f64fb18.mjs';
import { listSources } from './tools/a3564e16-9036-4616-8be3-6e4a506c1cba.mjs';
import { createSource } from './tools/e73ab3ae-538e-44fc-b9e3-6049163d1aa5.mjs';

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
    const { shouldSuspend, missingFields, message} = inputData;
    if (shouldSuspend && missingFields && missingFields.length > 0) {
      throw new Error(`INCOMPLETE_MAPPING: ${message || "Missing required fields"}`);
    }
    const templateResult = getStepResult(selectTemplateStep);
    const mappingResult = getStepResult(generateMappingStep);
    if (!templateResult || !mappingResult) {
      throw new Error("SPEC_GENERATION_FAILED");
    }
    const templateId = templateResult.templateId;
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

export { mastra as m, runGeneratePreviewWorkflow as r };
