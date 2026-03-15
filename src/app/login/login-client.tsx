"use client";

import { createClient } from "@/lib/supabase/client";
import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";

type SignupMode = "7day" | "agency-pay" | "scale-pay";

const MODE_CONFIG: Record<
  SignupMode,
  {
    title: string;
    sub: string;
    btnText: string;
    btnSub: string;
    pillTitle: string;
    pillDesc: string;
  }
> = {
  "7day": {
    title: "Start your free trial",
    sub: "Explore the platform free for 7 days.",
    btnText: "Start free trial →",
    btnSub: "",
    pillTitle: "7-day free trial",
    pillDesc: "No card needed, cancel anytime",
  },
  "agency-pay": {
    title: "Get started today",
    sub: "Full access, billed monthly.",
    btnText: "Get Agency access",
    btnSub: "Charged $149/mo. Cancel anytime.",
    pillTitle: "Agency Plan $149/mo",
    pillDesc: "",
  },
  "scale-pay": {
    title: "Get started today",
    sub: "More portals, more team, billed monthly.",
    btnText: "Get Scale access",
    btnSub: "Charged $299/mo. Cancel anytime.",
    pillTitle: "Scale Plan $299/mo",
    pillDesc: "",
  },
};

function PillRadio({
  mode,
  current,
  onClick,
  tag,
}: {
  mode: SignupMode;
  current: SignupMode;
  onClick: () => void;
  tag?: { label: string; color: string };
}) {
  const c = MODE_CONFIG[mode];
  const selected = mode === current;

  const borderColor = selected
    ? mode === "7day"
      ? "border-gray-400 bg-gray-50"
      : mode === "agency-pay"
        ? "border-blue-400 bg-blue-50"
        : "border-blue-400 bg-blue-50"
    : "border-gray-200";

  const dotColor =
    mode === "7day"
      ? "bg-blue-600"
      : mode === "agency-pay"
        ? "bg-blue-600"
        : "bg-blue-600";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all ${borderColor}`}
    >
      <div
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
          selected ? `${dotColor} border-transparent` : "border-gray-300"
        }`}
      >
        {selected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-900">{c.pillTitle}</p>
        {c.pillDesc && (
          <p className="text-xs text-gray-500">{c.pillDesc}</p>
        )}
      </div>
      {tag && (
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${tag.color}`}
        >
          {tag.label}
        </span>
      )}
    </button>
  );
}

const GoogleIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const OAuthDivider = () => (
  <div className="relative">
    <div className="absolute inset-0 flex items-center">
      <div className="w-full border-t border-gray-100" />
    </div>
    <div className="relative flex justify-center text-xs">
      <span className="bg-white px-2 text-gray-400">or</span>
    </div>
  </div>
);

export default function AuthShell() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/control-panel/connections";

  const defaultTab =
    typeof window !== "undefined" && window.location.pathname === "/signup"
      ? "signup"
      : "signin";
  const [tab, setTab] = useState<"signin" | "signup">(defaultTab);
  const [mode, setMode] = useState<SignupMode>("7day");

  // Sign-in state
  const [siEmail, setSiEmail] = useState("");
  const [siPassword, setSiPassword] = useState("");
  const [siError, setSiError] = useState<string | null>(null);
  const [siLoading, setSiLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Sign-up state
  const [suName, setSuName] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [suError, setSuError] = useState<string | null>(null);
  const [suLoading, setSuLoading] = useState(false);
  const [suSuccess, setSuSuccess] = useState(false);

  const urlError = searchParams.get("error");
  const urlErrorMessage =
    urlError === "not_registered"
      ? "No account found for that Google address. Please sign up first."
      : null;

  const cfg = MODE_CONFIG[mode];
  const isPayNow = mode === "agency-pay" || mode === "scale-pay";
  const selectedPlan = mode === "scale-pay" ? "scale" : "agency";

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSiLoading(true);
    setSiError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: siEmail,
      password: siPassword,
    });
    if (error) {
      setSiError(error.message);
      setSiLoading(false);
      return;
    }
    router.push(next);
    router.refresh();
  };

  const signInWithGoogle = async (intent: "signin" | "signup" = "signin") => {
    setGoogleLoading(true);
    setSiError(null);
    setSuError(null);
    const params = new URLSearchParams({ intent });
    if (intent === "signup") {
      const trialParam = isPayNow ? "0" : "7";
      params.set("trial", trialParam);
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?${params.toString()}`,
      },
    });
    if (error) {
      setSiError(error.message);
      setSuError(error.message);
      setGoogleLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuLoading(true);
    setSuError(null);

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!siteUrl || !siteUrl.startsWith("http")) {
      setSuError("Missing NEXT_PUBLIC_SITE_URL env var.");
      setSuLoading(false);
      return;
    }

    // trial=7 → 7-day free trial
    // trial=0 → pay-now, redirect to billing with plan pre-selected
    const trialParam = isPayNow ? "0" : "7";
    const redirectTo = `${siteUrl}/auth/callback?trial=${trialParam}`;

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: suName,
          email: suEmail,
          password: suPassword,
          redirectTo,
        }),
      });
      const body = await res.json();

      if (!res.ok || !body.ok) {
        setSuError(
          (body?.message || "Sign up failed") +
            (body?.hint ? ` — ${body.hint}` : "")
        );
        setSuLoading(false);
        return;
      }

      if (body?.hasSession) {
        if (isPayNow) {
          router.push(
            `/control-panel/settings?tab=billing&intent=subscribe&plan=${selectedPlan}`
          );
        } else {
          router.push("/control-panel/connections");
        }
        router.refresh();
        return;
      }

      setSuSuccess(true);
      setSuLoading(false);
    } catch {
      setSuError("Network error during signup.");
      setSuLoading(false);
    }
  };

  if (suSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
            <svg
              className="h-6 w-6 text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">
            Check your email
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            We sent a confirmation link to{" "}
            <span className="font-medium text-gray-700">{suEmail}</span>.
          </p>
          <p className="mt-1 text-sm text-gray-400">
            Open the link to finish signing in.
          </p>
          <button
            onClick={() => setTab("signin")}
            className="mt-6 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="flex w-full max-w-3xl overflow-hidden rounded-2xl border border-gray-200 shadow-sm">

        {/* ── Brand panel ──
            justify-start + gap-8 keeps content tight at the top
            instead of spreading awkwardly across the full height */}
        <div className="relative hidden w-[42%] flex-col justify-start gap-8 overflow-hidden bg-[#0F1117] p-9 md:flex">
          <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-blue-600/10" />

          {/* Logo */}
          <div className="relative z-10 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-semibold text-white">
              G
            </div>
            <span className="text-sm font-medium tracking-tight text-white">
              Getflowetic
            </span>
          </div>

          {/* Headline */}
          <div className="relative z-10">
            <h2 className="text-xl font-medium leading-snug tracking-tight text-white">
              Your AI agent.
              <br />
              Your brand.
              <br />
              Your revenue.
            </h2>
          </div>

          {/* Feature list */}
          <div className="relative z-10 space-y-2">
            {[
              "White-labeled portals in 60 seconds",
              "Charge clients via Stripe Connect",
              "Vapi, Retell, Make, n8n supported",
            ].map((f) => (
              <div key={f} className="flex items-center gap-2.5">
                <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                <span className="text-xs text-slate-400">{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Form panel ── */}
        <div className="flex flex-1 flex-col justify-center bg-white px-8 py-10">

          {/* Tabs */}
          <div className="mb-6 flex border-b border-gray-100">
            {(["signin", "signup"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`-mb-px mr-5 pb-3 text-sm font-medium transition-colors ${
                  tab === t
                    ? "border-b-2 border-blue-600 text-blue-600"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {t === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          {/* ── Sign in ── */}
          {tab === "signin" && (
            <div className="space-y-4">
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-gray-900">
                  Welcome back
                </h1>
                {/* CHANGED: "Sign in to your account" (was "Sign in to your agency dashboard") */}
                <p className="mt-0.5 text-xs text-gray-400">
                  Sign in to your account
                </p>
              </div>

              {siError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
                  {siError}
                </div>
              )}

              {urlErrorMessage && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
                  {urlErrorMessage}
                </div>
              )}

              <button
                type="button"
                onClick={() => signInWithGoogle("signin")}
                disabled={googleLoading}
                className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                <GoogleIcon />
                {googleLoading ? "Redirecting..." : "Continue with Google"}
              </button>

              <OAuthDivider />

              <form onSubmit={handleSignIn} className="space-y-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-600">
                    Email
                  </label>
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={siEmail}
                    onChange={(e) => setSiEmail(e.target.value)}
                    placeholder="you@agency.com"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-600">
                    Password
                  </label>
                  <input
                    type="password"
                    autoComplete="current-password"
                    required
                    value={siPassword}
                    onChange={(e) => setSiPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <button
                  type="submit"
                  disabled={siLoading}
                  className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                  {siLoading ? "Signing in..." : "Sign in"}
                </button>
              </form>

              <p className="text-center text-xs text-gray-400">
                No account?{" "}
                <button
                  type="button"
                  onClick={() => setTab("signup")}
                  className="font-medium text-blue-600 hover:text-blue-700"
                >
                  Create one
                </button>
              </p>
            </div>
          )}

          {/* ── Sign up ── */}
          {tab === "signup" && (
            <form onSubmit={handleSignUp} className="space-y-3">
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-gray-900">
                  {cfg.title}
                </h1>
                <p className="mt-0.5 text-xs text-gray-400">{cfg.sub}</p>
              </div>

              {suError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
                  {suError}
                </div>
              )}

              {/* Google OAuth — signup */}
              <button
                type="button"
                onClick={() => signInWithGoogle("signup")}
                disabled={googleLoading}
                className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                <GoogleIcon />
                {googleLoading ? "Redirecting..." : "Sign up with Google"}
              </button>

              <OAuthDivider />

              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-600">
                  Full name
                </label>
                <input
                  type="text"
                  autoComplete="name"
                  required
                  value={suName}
                  onChange={(e) => setSuName(e.target.value)}
                  placeholder="Your name"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-600">
                  Email
                </label>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={suEmail}
                  onChange={(e) => setSuEmail(e.target.value)}
                  placeholder="you@agency.com"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-600">
                  Password
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={suPassword}
                  onChange={(e) => setSuPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <button
                type="submit"
                disabled={suLoading}
                className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {suLoading ? "Creating account..." : cfg.btnText}
              </button>

              {cfg.btnSub && (
                <p className="text-center text-xs text-gray-400">{cfg.btnSub}</p>
              )}

              <div className="flex items-center gap-2 py-1">
                <div className="h-px flex-1 bg-gray-100" />
                <span className="text-xs text-gray-400">
                  or choose a different plan
                </span>
                <div className="h-px flex-1 bg-gray-100" />
              </div>

              <div className="space-y-2">
                {/* Free trial */}
                <PillRadio
                  mode="7day"
                  current={mode}
                  onClick={() => setMode("7day")}
                  tag={{ label: "Free", color: "bg-gray-100 text-gray-600" }}
                />
                {/* Agency plan — pay now */}
                <PillRadio
                  mode="agency-pay"
                  current={mode}
                  onClick={() => setMode("agency-pay")}
                  tag={{
                    label: "$149/mo",
                    color: "bg-blue-50 text-blue-600",
                  }}
                />
                {/* Scale plan — pay now */}
                <PillRadio
                  mode="scale-pay"
                  current={mode}
                  onClick={() => setMode("scale-pay")}
                  tag={{
                    label: "$299/mo",
                    color: "bg-blue-50 text-blue-600",
                  }}
                />
              </div>

              <p className="text-center text-xs text-gray-400">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => setTab("signin")}
                  className="font-medium text-blue-600 hover:text-blue-700"
                >
                  Sign in
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
