"use client";

import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export default function SignupPage() {
  const supabase = createClient();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const redirectBase = useMemo(() => {
    const base = process.env.NEXT_PUBLIC_SITE_URL;
    return base && base.startsWith("http") ? base : "";
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!redirectBase) {
      setError(
        "Missing NEXT_PUBLIC_SITE_URL. Set it to https://app.getflowetic.com in Vercel Environment Variables."
      );
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: `${redirectBase}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message || "Sign up failed");
      setLoading(false);
      return;
    }

    if (data?.session) {
      router.push("/dashboard");
      router.refresh();
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-xl bg-white p-8 shadow text-center">
          <h1 className="text-2xl font-bold text-gray-900">Check your email</h1>
          <p className="mt-2 text-sm text-gray-600">
            We sent a confirmation link to <span className="font-medium">{email}</span>.
          </p>
          <p className="mt-4 text-sm text-gray-500">Open the link to finish signing in.</p>
          <div className="mt-6">
            <Link className="text-sm font-medium text-blue-600 hover:text-blue-700" href="/login">
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Getflowetic</h1>
          <p className="mt-2 text-sm text-gray-600">Create your account</p>
        </div>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700" htmlFor="name">
              Full name
            </label>
            <input
              id="name"
              className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              type="password"
              autoComplete="new-password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <p className="text-xs text-gray-500">At least 6 characters</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          Already have an account?{" "}
          <Link className="font-medium text-blue-600 hover:text-blue-700" href="/login">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}