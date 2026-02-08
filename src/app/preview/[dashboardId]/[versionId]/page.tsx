import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { DashboardRenderer } from "@/components/preview/dashboard-renderer";

export const dynamic = "force-dynamic";

interface PreviewPageProps {
  params: Promise<{
    dashboardId: string;
    versionId: string;
  }>;
}

export default async function PreviewPage({ params }: PreviewPageProps) {
  const { dashboardId, versionId } = await params;
  const supabase = await createClient();

  const { data: version, error } = await supabase
    .from("interface_versions")
    .select("id, interface_id, spec_json, design_tokens")
    .eq("id", versionId)
    .eq("interface_id", dashboardId)
    .single();

  if (error || !version) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-white">
      <DashboardRenderer
        spec={version.spec_json}
        designTokens={version.design_tokens}
      />
    </div>
  );
}
