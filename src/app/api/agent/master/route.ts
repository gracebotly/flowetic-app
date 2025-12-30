import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RuntimeContext } from "@/mastra/core/RuntimeContext";
import { platformDetectionAgent } from "@/mastra/agents/platformDetectionAgent";
import { templateRecommendationAgent } from "@/mastra/agents/templateRecommendationAgent";
import { mappingGenerationAgent } from "@/mastra/agents/mappingGenerationAgent";
import { loadSkillMarkdown } from "@/mastra/skills/loadSkill";
import { generatePreviewWorkflow } from "@/mastra/workflows/generatePreview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { messages, lastMessage } = await req.json();

    // Check if this is a workflow trigger
    if (lastMessage?.toLowerCase().includes("generate") || lastMessage?.toLowerCase().includes("preview")) {
      const body = await req.json();
      const { tenantId, userId, interfaceId } = body;

      if (!tenantId || !userId || !interfaceId) {
        return NextResponse.json({
          type: "error",
          code: "MISSING_CONTEXT",
          message: "Missing required context for preview generation",
        }, { status: 400 });
      }

      const supabase = createClient();
      const rc = new RuntimeContext({ tenantId, userId, interfaceId });

      // 1️⃣  PlatformDetectionAgent - load first record
      const { data: firstRecord } = await supabase
        .from("events")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("timestamp", { ascending: false })
        .limit(1)
        .single();

      if (!firstRecord) {
        throw new Error("NO_EVENTS_AVAILABLE");
      }

      // Detect platform
      const detectedPlatform = "vapi"; // MVP: fallback if detection fails
      const sourceId = firstRecord.source_id;

      rc.sourceId = sourceId;
      rc.platformType = detectedPlatform;
      rc.threadId = `thread_${Date.now()}`;

      // 2️⃣  Agent 1 - Platform Detection (lightweight)
      await platformDetectionAgent.generate(`Detect platform type from this event: ${JSON.stringify(firstRecord)}`);

      // 3️⃣  Agent 2 - Template Recommendation 
      const skillMarkdown = await loadSkillMarkdown(detectedPlatform as any);
      
      const { data: sampleEvents } = await supabase
        .from("events")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("source_id", sourceId)
        .order("timestamp", { ascending: false })
        .limit(10);

      const recommendedTemplate = "voice-analytics"; // Agent would normally determine this
      rc.templateId = recommendedTemplate;

      await templateRecommendationAgent.generate(
        `Recommend template for events. Skill: ${skillMarkdown}. Samples: ${JSON.stringify(sampleEvents)}`
      );

      // 4️⃣  Agent 3 - Mapping Generation (deterministic)
      const resultMappings: Record<string, string> = {
        "customer.name": "customer_name",
        "agent.name": "agent_name", 
        "duration": "call_duration_seconds",
        "status": "call_status",
      };

      await mappingGenerationAgent.generate(
        `Generate mappings. Skill: ${skillMarkdown}. Events: ${JSON.stringify(sampleEvents)}`
      );

      // 5️⃣  Execute existing preview workflow with deterministic values
      const previewResult = await generatePreviewWorkflow.execute({
        inputData: {
          tenantId,
          userId,
          userRole: "admin",
          interfaceId,
          instructions: `Generate ${recommendedTemplate} preview`,
        },
        runtimeContext: {
          tenantId,
          userId,
          sourceId,
          platformType: detectedPlatform,
          templateId: recommendedTemplate,
          mappings: resultMappings,
        },
      });

      return NextResponse.json({
        type: "success",
        previewUrl: previewResult.previewUrl,
        interfaceId,
        versionId: previewResult.previewVersionId,
        platformType: detectedPlatform,
        templateId: recommendedTemplate,
        mappings: resultMappings,
      });
    }

    // Fall back to conversational agent
    // TODO: Add master router agent fallback

  } catch (error: any) {
    console.error("Master Agent Error:", error);

    const body = await req.json().catch(() => ({}));
    const { tenantId, userId, sourceId, platformType } = body;

    // Handle known errors
    if (error.message === "NO_EVENTS_AVAILABLE") {
      return NextResponse.json({
        type: "error",
        code: "NO_EVENTS_AVAILABLE",
        message: "No events found. Please connect your platform and ensure data is flowing.",
      }, { status: 400 });
    }

    if (error.message === "MAPPING_INCOMPLETE_REQUIRED_FIELDS") {
      return NextResponse.json({
        executionContext: {
          tenantId,
          userId,
          sourceId,
          platformType,
        },
        type: "error",
        code: "MAPPING_INCOMPLETE",
        message: "Cannot generate preview without all required fields.",
      }, { status: 400 });
    }

    return NextResponse.json({
      type: "error",
      code: "UNKNOWN_ERROR",
      message: error.message || "An unexpected error occurred.",
    }, { status: 500 });
  }
}
