
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { fetchPlatformEvents } from "../tools/fetchPlatformEvents";
import { normalizeEvents } from "../tools/normalizeEvents";
import { storeEvents } from "../tools/storeEvents";
import { generateSchemaSummaryFromEvents } from "../tools/generateSchemaSummaryFromEvents";
import { updateJourneySchemaReady } from "../tools/updateJourneySchemaReady";
import { appendThreadEvent } from "../tools/platformMapping/appendThreadEvent";

// Type guard for handling tool execution errors
type ValidationErrorLike = {
  code?: string;
  path?: string | string[];
  message: string;
};

function isValidationErrorLike(error: unknown): error is ValidationErrorLike {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as ValidationErrorLike).message === "string"
  );
}

// Helper to unwrap tool results and handle ValidationErrors properly
function unwrapToolResult<T>(result: T): T {
  if (isValidationErrorLike(result)) {
    throw new Error(`VALIDATION_ERROR: ${result.message}`);
  }
  return result;
}

export const connectionBackfillWorkflow = createWorkflow({
  id: "connectionBackfill",
  description:
    "Pulls historical events from a connected platform source, normalizes and stores them in Supabase, generates a schema summary, and marks the journey session schemaReady=true.",
  inputSchema: z.object({
    tenantId: z.string().min(1),
    sourceId: z.string().min(1),
    platformType: z.enum(["vapi", "n8n", "make", "retell"]),
    eventCount: z.number().int().min(1).max(500).default(100),
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
          nullable: z.boolean().optional(),
        }),
      ),
      eventTypes: z.array(z.string()),
      eventCounts: z.record(z.number()),
      confidence: z.number().min(0).max(1),
    }),
  }),
})
  .then(
    createStep({
      id: "fetchPlatformEventsStep",
      description: "Fetch historical events from the connected platform API.",
      inputSchema: z.object({
        tenantId: z.string(),
        sourceId: z.string(),
        platformType: z.enum(["vapi", "n8n", "make", "retell"]),
        threadId: z.string().uuid(),
        eventCount: z.number().int().optional(),
      }),
      outputSchema: z.object({
        events: z.array(z.any()),
        count: z.number().int(),
        platformType: z.string(),
        fetchedAt: z.string(),
      }),
      execute: async ({ inputData, requestContext }) => {
        const eventCount = inputData.eventCount ?? 10;
        const result = await fetchPlatformEvents.execute(
          { 
            tenantId: inputData.tenantId,
            platformType: inputData.platformType, 
            sourceId: inputData.sourceId, 
            eventCount 
          },
          requestContext
        );
        return unwrapToolResult(result);
      },
    }),
  )
  .then(
    createStep({
      id: "normalizeEventsStep",
      description: "Normalize raw platform events into Flowetic events row shape.",
      inputSchema: z.object({
        events: z.array(z.any()),
        count: z.number().int(),
        platformType: z.string(),
        fetchedAt: z.string(),
        sourceId: z.string(),
        tenantId: z.string(),
      }),
      outputSchema: z.object({
        normalizedEvents: z.array(z.record(z.any())),
        count: z.number().int(),
        tenantId: z.string(),
        sourceId: z.string(),
      }),
      execute: async ({ inputData, requestContext }) => {
        const result = await normalizeEvents.execute(
          { 
            tenantId: inputData.tenantId,
            platformType: inputData.platformType as 'vapi' | 'n8n' | 'make' | 'retell',
            sourceId: inputData.sourceId,
            rawEvents: inputData.events
          },
          new RuntimeContext()
        );
        const unwrapped = unwrapToolResult(result);
        return {
          ...unwrapped,
          tenantId: inputData.tenantId,
          sourceId: inputData.sourceId,
        };
      },
    }),
  )
  .then(
    createStep({
      id: "storeEventsStep",
      description: "Store normalized events into Supabase events table (idempotent).",
      inputSchema: z.object({
        normalizedEvents: z.array(z.record(z.any())),
        count: z.number().int(),
        sourceId: z.string(),
        tenantId: z.string(),
      }),
      outputSchema: z.object({
        stored: z.number().int(),
        skipped: z.number().int(),
        errors: z.array(z.string()),
        tenantId: z.string(),
        sourceId: z.string(),
      }),
      execute: async ({ inputData, requestContext }) => {
        const result = await storeEvents.execute(
          { 
            tenantId: inputData.tenantId,
            sourceId: inputData.sourceId,
            events: inputData.normalizedEvents
          },
          new RuntimeContext()
        );
        const unwrapped = unwrapToolResult(result);
        return {
          ...unwrapped,
          tenantId: inputData.tenantId,
          sourceId: inputData.sourceId,
        };
      },
    }),
  )
  .then(
    createStep({
      id: "generateSchemaSummaryStep",
      description: "Generate schema summary from stored events in Supabase.",
      inputSchema: z.object({
        stored: z.number().int(),
        skipped: z.number().int(),
        errors: z.array(z.string()),
        tenantId: z.string(),
        sourceId: z.string(),
      }),
      outputSchema: z.object({
        fields: z.array(
          z.object({
            name: z.string(),
            type: z.string(),
            sample: z.any().optional(),
            nullable: z.boolean().optional(),
          }),
        ),
        eventTypes: z.array(z.string()),
        eventCounts: z.record(z.number()),
        confidence: z.number().min(0).max(1),
        tenantId: z.string(),
        sourceId: z.string(),
      }),
      execute: async ({ inputData, requestContext }) => {
        const sampleSize = 100; // Default sample size
        const result = await generateSchemaSummaryFromEvents.execute(
          { 
            tenantId: inputData.tenantId,
            sourceId: inputData.sourceId,
            sampleSize
          },
          new RuntimeContext()
        );
        const unwrapped = unwrapToolResult(result);
        return {
          ...unwrapped,
          tenantId: inputData.tenantId,
          sourceId: inputData.sourceId,
        };
      },
    }),
  )
  .then(
    createStep({
      id: "updateJourneyStateStep",
      description: "Mark journey_sessions.schemaReady = true for this tenant/thread.",
      inputSchema: z.object({
        fields: z.array(z.any()),
        eventTypes: z.array(z.string()),
        eventCounts: z.record(z.number()),
        confidence: z.number(),
        tenantId: z.string(),
        sourceId: z.string(),
      }),
      outputSchema: z.object({
        ok: z.boolean(),
        tenantId: z.string(),
        sourceId: z.string(),
      }),
      execute: async ({ inputData, requestContext }) => {
        const result = await updateJourneySchemaReady.execute(
          { 
            tenantId: inputData.tenantId,
            schemaReady: true
          },
          requestContext
        );
        const unwrapped = unwrapToolResult(result);
        return {
          ...unwrapped,
          tenantId: inputData.tenantId,
          sourceId: inputData.sourceId,
        };
      },
    }),
  )
  .then(
    createStep({
      id: "logConnectionEventStep",
      description: "Append a thread event that connection backfill is complete.",
      inputSchema: z.object({
        ok: z.boolean(),
        tenantId: z.string(),
        threadId: z.string(),
        sourceId: z.string(),
      }),
      outputSchema: z.object({
        eventId: z.string().uuid(),
      }),
      execute: async ({ inputData, requestContext }) => {
        const result = await appendThreadEvent.execute(
          {
            tenantId: inputData.tenantId,
            threadId: inputData.threadId,
            // userId removed - not in appendThreadEvent schema
            // role: null, // also removed - not in appendThreadEvent schema
            type: "state",
            message: "Connection backfill completed successfully",
            metadata: {
              kind: "connectionBackfill",
              sourceId: inputData.sourceId,
            }
          },
          new RuntimeContext()
        );
        return unwrapToolResult(result);
      },
    }),
  )
  .commit();
