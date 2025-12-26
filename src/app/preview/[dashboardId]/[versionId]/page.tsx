import { notFound } from "next/navigation";

export default async function PreviewPage({
  params,
}: {
  params: { dashboardId: string; versionId: string };
}) {
  const { dashboardId, versionId } = params;

  // MVP: if params missing
  if (!dashboardId || !versionId) return notFound();

  // TODO (next): load real spec/version from Supabase:
  // - interfaces/interface_versions tables
  // - render via your renderer later
  // For now: a clean placeholder preview page.
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
        <h2 style={{ margin: "0 0 8px 0", fontSize: 16 }}>Dashboard content goes here</h2>
        <p style={{ margin: 0, color: "#6b7280" }}>
          Next step: load the saved dashboard spec/version from Supabase and render it.
        </p>
      </div>
    </div>
  );
}