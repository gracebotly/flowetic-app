import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="max-w-xl text-center">
        <h1 className="text-5xl font-bold text-gray-900">Getflowetic</h1>
        <p className="mt-4 text-lg text-gray-600">
          Turn AI agent activity into client-ready dashboards.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/signup"
            className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Create account
          </Link>
          <Link
            href="/login"
            className="rounded-md border px-5 py-2.5 text-sm font-medium hover:bg-white"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}