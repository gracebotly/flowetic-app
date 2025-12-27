import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PreviewPage({
  params,
}: {
  params: { dashboardId: string; versionId: string };
}) {
  const { dashboardId, versionId } = params;
  if (!dashboardId || !versionId) return notFound();

  const supabase = await createClient();

  const { data: version, error } = await supabase
    .from("interface_versions")
    .select("id, interface_id, spec_json, design_tokens, created_at")
    .eq("id", versionId)
    .eq("interface_id", dashboardId)
    .single();

  if (error || !version) return notFound();

  return (
    <div style={{ fontFamily: "ui-sans-serif", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ margin: 0, fontSize: 18 }}>Preview</h1>
        <div style={{ color: "#6b7280", fontSize: 12 }}>
          Dashboard: <b>{dashboardId}</b> · Version: <b>{versionId}</b>
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 16,
          background: "#ffffff",
        }}
      >
        <h2 style={{ margin: "0 0 8px 0", fontSize: 16 }}>Spec JSON (MVP)</h2>
        <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12, color: "#111827" }}>
          {JSON.stringify(version.spec_json, null, 2)}
        </pre>
      </div>
    </div>
  );
}
