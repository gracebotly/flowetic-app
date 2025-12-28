import { mastra } from '@/mastra';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { NextRequest } from 'next/server';
import { getThreadState, updateThreadState } from '@/lib/sharedState';
import { logThreadEvent } from '@/lib/threadEvents';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      messages,
      threadId,
      tenantId,
      userId,
      userRole,
      clientId,
      dashboardId,
      sourceId,
      platformType,
      planTier = 'free',
      mode: incomingMode,
      phase: incomingPhase,
      templateId: incomingTemplateId,
      skillsEnabled = false,
      ragEnabled = false,
    } = body;

    // Pull or initialize shared state
    const currentState = getThreadState(threadId) ?? {
      mode: incomingMode ?? 'plan',
      phase: incomingPhase ?? 'plan',
      schemaReady: false,
      mappingComplete: false,
      templateId: incomingTemplateId,
      planTurnsCount: 0,
    };

    // Update state with values from the request, if provided
    const state = updateThreadState(threadId, {
      mode: incomingMode ?? currentState.mode,
      phase: incomingPhase ?? currentState.phase,
      templateId: incomingTemplateId ?? currentState.templateId,
    });

    // Determine the last user message
    const lastMessage = messages?.[messages.length - 1]?.content ?? '';
    const text = lastMessage.toLowerCase();

    // Build runtime context
    const runtimeContext = new RuntimeContext();
    runtimeContext.set('tenantId', tenantId);
    runtimeContext.set('userId', userId);
    runtimeContext.set('userRole', userRole);
    runtimeContext.set('threadId', threadId);
    runtimeContext.set('clientId', clientId);
    runtimeContext.set('dashboardId', dashboardId);
    runtimeContext.set('platformType', platformType);
    runtimeContext.set('sourceId', sourceId);
    runtimeContext.set('planTier', planTier);
    runtimeContext.set('mode', state.mode);
    runtimeContext.set('phase', state.phase);
    runtimeContext.set('templateId', state.templateId);
    runtimeContext.set('skillsEnabled', skillsEnabled);
    runtimeContext.set('ragEnabled', ragEnabled);

    // Detect intents
    const wantsGenerate = /\b(generate|create|build)\b/.test(text);
    const wantsDeploy = /\b(deploy|publish)\b/.test(text);

    // RBAC enforcement: viewers cannot mutate
    const isViewer = userRole === 'viewer';
    const isAdmin = userRole === 'admin';

    if (wantsGenerate) {
      if (isViewer) {
        return new Response(
          JSON.stringify({
            type: 'error',
            code: 'TENANT_ACCESS_DENIED',
            message: 'Your role does not permit generating previews.',
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        );
      }

      // CTA gating
      const readyForCTA =
        state.schemaReady &&
        state.templateId !== undefined &&
        state.mappingComplete &&
        state.planTurnsCount >= 2;

      if (!readyForCTA) {
        // Increment planTurnsCount and update state
        updateThreadState(threadId, { planTurnsCount: state.planTurnsCount + 1 });
        await logThreadEvent(threadId, 'state', {
          mode: state.mode,
          phase: state.phase,
          planTurnsCount: state.planTurnsCount + 1,
        });
        return new Response(
          JSON.stringify({
            type: 'cta_unavailable',
            code: 'CTA_NOT_READY',
            message: 'A preview can only be generated after planning and mapping are complete.',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      // Trigger the generate preview workflow
      try {
        const result = await mastra.workflows.generatePreview.execute({
          triggerData: {
            tenantId,
            userId,
            sourceId,
            platformType,
          },
          runtimeContext,
        });

        // Extract the persist-preview-version step result
        const persistResult =
          result?.results?.['persist-preview-version'] ??
          result?.results?.['persistPreviewVersion'];

        // Update state to preview_ready
        updateThreadState(threadId, {
          phase: 'preview_ready',
          lastPreviewRunId: result?.id ?? undefined,
          previewVersionId: persistResult?.versionId,
        });

        // Log the workflow execution
        await logThreadEvent(threadId, 'tool_event', {
          workflow: 'generatePreview',
          result: persistResult,
        });

        return new Response(
          JSON.stringify({
            type: 'workflow_complete',
            workflow: 'generate-preview',
            result: {
              previewUrl: persistResult?.previewUrl,
              interfaceId: persistResult?.interfaceId,
              versionId: persistResult?.versionId,
            },
            message: `✅ Dashboard preview generated! You can view it at ${persistResult?.previewUrl}`,
          }),
          { headers: { 'Content-Type': 'application/json' } },
        );
      } catch (err: any) {
        // Map known errors to taxonomy
        let code = 'SPEC_GENERATION_FAILED';
        let message = 'An unexpected error occurred while generating the preview.';
        switch (err?.message) {
          case 'NO_EVENTS_AVAILABLE':
            code = 'NO_EVENTS_AVAILABLE';
            message = 'No events found. Please connect your platform and ensure data is flowing.';
            break;
          case 'MAPPING_INCOMPLETE_REQUIRED_FIELDS':
            code = 'MAPPING_INCOMPLETE_REQUIRED_FIELDS';
            message = 'Cannot generate preview – some required fields are missing from your data.';
            break;
          case 'TEMPLATE_NOT_FOUND':
            code = 'TEMPLATE_NOT_FOUND';
            message = 'No suitable template could be found for this platform.';
            break;
        }
        await logThreadEvent(threadId, 'error', { code, details: err?.message });
        return new Response(
          JSON.stringify({ type: 'error', code, message }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      }
    }

    if (wantsDeploy) {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({
            type: 'error',
            code: 'TENANT_ACCESS_DENIED',
            message: 'Only administrators can deploy dashboards.',
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        );
      }
      // TODO: implement the deploy workflow (trigger publishDashboard)
      return new Response(
        JSON.stringify({
          type: 'error',
          code: 'DEPLOY_CONFIRMATION_REQUIRED',
          message: 'Deploy workflow is not yet implemented.',
        }),
        { status: 501, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Normal chat – increment turns and call the agent
    updateThreadState(threadId, { planTurnsCount: state.planTurnsCount + 1 });
    await logThreadEvent(threadId, 'state', {
      mode: state.mode,
      phase: state.phase,
      planTurnsCount: state.planTurnsCount + 1,
    });

    const agent = mastra.agents.masterRouter;
    const response = await agent.generate(lastMessage, {
      runtimeContext,
      maxSteps: 3,
    });

    return new Response(response.text, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (error: any) {
    console.error('Master Agent Error:', error);
    await logThreadEvent(body?.threadId ?? 'unknown', 'error', {
      code: 'UNKNOWN',
      details: error?.message,
    });
    return new Response(
      JSON.stringify({
        type: 'error',
        code: 'UNKNOWN',
        message: 'An error occurred while processing your request.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
