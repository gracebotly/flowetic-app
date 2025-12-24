import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: membership } = await supabase
    .from("memberships")
    .select("tenant_id")
    .eq("user_id", user?.id)
    .single();

  const tenantId = membership?.tenant_id;

  const { count: interfaceCount } = await supabase
    .from("interfaces")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  const { count: sourceCount } = await supabase
    .from("sources")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  const { count: eventCount } = await supabase
    .from("events")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Overview of your workspace.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="rounded-lg bg-white p-5 shadow">
          <div className="text-sm text-gray-500">Interfaces</div>
          <div className="mt-1 text-2xl font-semibold text-gray-900">{interfaceCount || 0}</div>
        </div>
        <div className="rounded-lg bg-white p-5 shadow">
          <div className="text-sm text-gray-500">Sources</div>
          <div className="mt-1 text-2xl font-semibold text-gray-900">{sourceCount || 0}</div>
        </div>
        <div className="rounded-lg bg-white p-5 shadow">
          <div className="text-sm text-gray-500">Events (all time)</div>
          <div className="mt-1 text-2xl font-semibold text-gray-900">{eventCount || 0}</div>
        </div>
      </div>
    </div>
  );
}