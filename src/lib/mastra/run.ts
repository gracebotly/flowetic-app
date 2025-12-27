import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { GeneratePreviewInput, GeneratePreviewOutput } from "./workflows/generate-preview";
import { PublishInput, PublishOutput } from "./workflows/publish-dashboard";

function nowIso() {
  return new Date().toISOString();
}

export async function runGeneratePreview(input: z.infer<typeof GeneratePreviewInput>) {
  const parsed = GeneratePreviewInput.parse(input);
  const supabase = await createClient();

  // runs row
  const { data: runRow, error: runErr } = await supabase
    .from("runs")
    .insert({
      tenant_id: parsed.tenantId,
      interface_id: parsed.interfaceId,
      workflow_id: "generate_preview",
      status: "running",
      started_at: nowIso(),
    })
    .select("id")
    .single();

  if (runErr || !runRow?.id) throw new Error(runErr?.message || "Failed to create run");
  const runId = runRow.id as string;

  // run_steps (minimal)
  await supabase.from("run_steps").insert([
    { run_id: runId, step_name: "validate", status: "succeeded", inputs: parsed, outputs: { ok: true } },
    { run_id: runId, step_name: "generate_spec", status: "succeeded", inputs: { instructions: parsed.instructions }, outputs: { ok: true } },
  ]);

  // Create a preview version (spec_json placeholder for now)
  const spec_json = {
    kind: "flowetic_spec_v1",
    title: "Preview Dashboard",
    generatedAt: nowIso(),
    instructions: parsed.instructions || null,
    widgets: [],
  };

  const { data: versionRow, error: versionErr } = await supabase
    .from("interface_versions")
    .insert({
      interface_id: parsed.interfaceId,
      spec_json,
      design_tokens: {},
      created_by: parsed.userId,
    })
    .select("id")
    .single();

  if (versionErr || !versionRow?.id) throw new Error(versionErr?.message || "Failed to create preview version");

  const previewVersionId = versionRow.id as string;
  const previewUrl = `/preview/${parsed.interfaceId}/${previewVersionId}`;

  // finish run
  await supabase
    .from("runs")
    .update({ status: "succeeded", ended_at: nowIso() })
    .eq("id", runId);

  return GeneratePreviewOutput.parse({ runId, previewVersionId, previewUrl });
}

export async function runPublishDashboard(input: z.infer<typeof PublishInput>) {
  const parsed = PublishInput.parse(input);

  if (parsed.userRole !== "admin") {
    throw new Error("TENANT_ACCESS_DENIED");
  }
  if (!parsed.confirm) {
    throw new Error("DEPLOY_CONFIRMATION_REQUIRED");
  }

  const supabase = await createClient();

  const { data: runRow, error: runErr } = await supabase
    .from("runs")
    .insert({
      tenant_id: parsed.tenantId,
      interface_id: parsed.interfaceId,
      workflow_id: "publish_dashboard",
      status: "running",
      started_at: nowIso(),
    })
    .select("id")
    .single();

  if (runErr || !runRow?.id) throw new Error(runErr?.message || "Failed to create run");
  const runId = runRow.id as string;

  // mark old deployments inactive
  await supabase
    .from("deployments")
    .update({ status: "inactive" })
    .eq("tenant_id", parsed.tenantId)
    .eq("interface_id", parsed.interfaceId)
    .eq("status", "active");

  // create new deployment
  const { data: depRow, error: depErr } = await supabase
    .from("deployments")
    .insert({
      tenant_id: parsed.tenantId,
      interface_id: parsed.interfaceId,
      version_id: parsed.versionId,
      route: parsed.route,
      status: "active",
    })
    .select("id")
    .single();

  if (depErr || !depRow?.id) throw new Error(depErr?.message || "Failed to create deployment");
  const deploymentId = depRow.id as string;

  // update interface pointer
  await supabase
    .from("interfaces")
    .update({ active_version_id: parsed.versionId, status: "published" })
    .eq("id", parsed.interfaceId)
    .eq("tenant_id", parsed.tenantId);

  await supabase.from("run_steps").insert([
    { run_id: runId, step_name: "deploy", status: "succeeded", inputs: parsed, outputs: { deploymentId } },
  ]);

  await supabase.from("runs").update({ status: "succeeded", ended_at: nowIso() }).eq("id", runId);

  const publishedUrl = parsed.route;
  return PublishOutput.parse({ runId, deploymentId, publishedUrl });
}
