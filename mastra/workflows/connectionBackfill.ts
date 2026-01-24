
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { fetchPlatformEvents } from "../tools/fetchPlatformEvents";
import { normalizeEvents } from "../tools/normalizeEvents";
import { storeEvents } from "../tools/storeEvents";
import { generateSchemaSummaryFromEvents } from "../tools/generateSchemaSummaryFromEvents";
import { updateJourneySchemaReady } from "../tools/updateJourneySchemaReady";
import { appendThreadEvent } from "../tools/platformMapping/appendThreadEvent";

export const connectionBackfillWorkflow = createWorkflow({
  id: "connectionBackfill",
  description:
    "Pulls historical events from a connected platform source, normalizes and stores them in Supabase, generates a schema summary, and marks the journey session schemaReady=true.",
  inputSchema: z.object({
    tenantId: z.string().min(1),
    threadId: z.string().min(1),
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
        eventCount: z.number().int(),
      }),
      outputSchema: z.object({
        events: z.array(z.any()),
        count: z.number().int(),
        platformType: z.string(),
        fetchedAt: z.string(),
      }),
      execute: async ({ inputData, requestContext }) => {
        return await fetchPlatformEvents(inputData.platformType, inputData.sourceId, inputData.eventCount);
      },
    }),
  )
  .then(
    createStep({
      id: "normalizeEventsStep",
      description: "Normalize raw platform events into Flowetic events row shape.",
      inputSchema: z.object({
        rawEvents: z.array(z.any()),
        platformType: z.enum(["vapi", "n8n", "make", "retell"]),
        sourceId: z.string(),
        tenantId: z.string(),
      }),
      outputSchema: z.object({
        normalizedEvents: z.array(z.record(z.any())),
        count: z.number().int(),
      }),
      execute: async ({ inputData, requestContext }) => {
        return await normalizeEvents(inputData.rawEvents, inputData.platformType);
      },
    }),
  )
  .then(
    createStep({
      id: "storeEventsStep",
      description: "Store normalized events into Supabase events table (idempotent).",
      inputSchema: z.object({
        events: z.array(z.record(z.any())),
        tenantId: z.string(),
        sourceId: z.string(),
      }),
      outputSchema: z.object({
        stored: z.number().int(),
        skipped: z.number().int(),
        errors: z.array(z.string()),
      }),
      execute: async ({ inputData, requestContext }) => {
        return await storeEvents(inputData.events, inputData.tenantId, inputData.sourceId);
      },
    }),
  )
  .then(
    createStep({
      id: "generateSchemaSummaryStep",
      description: "Generate schema summary from stored events in Supabase.",
      inputSchema: z.object({
        tenantId: z.string(),
        sourceId: z.string(),
        sampleSize: z.number().int().min(1).max(500).default(100),
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
      }),
      execute: async ({ inputData, requestContext }) => {
        return await generateSchemaSummaryFromEvents(inputData.tenantId, inputData.sourceId, inputData.sampleSize);
      },
    }),
  )
  .then(
    createStep({
      id: "updateJourneyStateStep",
      description: "Mark journey_sessions.schemaReady = true for this tenant/thread.",
      inputSchema: z.object({
        tenantId: z.string(),
        threadId: z.string(),
        schemaReady: z.boolean(),
      }),
      outputSchema: z.object({
        ok: z.boolean(),
      }),
      execute: async ({ inputData, requestContext }) => {
        return await updateJourneySchemaReady(inputData.tenantId, inputData.threadId, inputData.schemaReady);
      },
    }),
  )
  .then(
    createStep({
      id: "logConnectionEventStep",
      description: "Append a thread event that connection backfill is complete.",
      inputSchema: z.object({
        tenantId: z.string(),
        threadId: z.string(),
        sourceId: z.string(),
        message: z.string(),
      }),
      outputSchema: z.object({
        eventId: z.string().uuid(),
      }),
      execute: async ({ inputData, requestContext }) => {
        return await appendThreadEvent(
          inputData.tenantId,
          inputData.threadId,
          null,
          null,
          "state",
          inputData.message,
          {
            kind: "connectionBackfill",
            sourceId: inputData.sourceId,
          }
        );
      },
    }),
  )
  .commit();
