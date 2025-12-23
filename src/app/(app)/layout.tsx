import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("memberships")
    .select("tenant_id, role, tenants(name)")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  const tenantName = (membership?.tenants as any)?.name ?? "Workspace";

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="text-lg font-bold text-blue-600">
              Getflowetic
            </Link>
            <div className="hidden sm:flex items-center gap-6 text-sm">
              <Link href="/dashboard" className="text-gray-700 hover:text-gray-900">
                Dashboard
              </Link>
              <Link href="/sources" className="text-gray-700 hover:text-gray-900">
                Sources
              </Link>
              <Link href="/interfaces" className="text-gray-700 hover:text-gray-900">
                Interfaces
              </Link>
              <Link href="/settings" className="text-gray-700 hover:text-gray-900">
                Settings
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden sm:inline text-sm text-gray-500">{tenantName}</span>
            <span className="hidden sm:inline text-sm text-gray-700">{user.email}</span>
            <LogoutButton />
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}