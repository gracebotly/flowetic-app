import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;

  // Supabase sends OAuth errors to the Site URL (this page), not to /auth/callback
  // Catch them and redirect to login with a friendly error
  if (params.error || params.error_code) {
    redirect("/login?error=auth_failed");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/control-panel/connections");
  }

  redirect("/login");
}
