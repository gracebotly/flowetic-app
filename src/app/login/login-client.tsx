"use client";

import { createClient } from "@/lib/supabase/client";
import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";

type SignupMode = "14day" | "7day" | "paynow";

const MODE_CONFIG: Record<
  SignupMode,
  {
    badge: string;
    badgeColor: string;
    title: string;
    sub: string;
    btnText: string;
    btnColor: string;
    btnSub: string;
    pillTitle: string;
    pillDesc: string;
  }
> = {
  "14day": {
    badge: "14-day free trial — add a card, cancel anytime",
    badgeColor: "bg-blue-50 border-blue-200 text-blue-700",
    title: "Start your free trial",
    sub: "Full access. No charge until your trial ends.",
    btnText: "Start 14-day free trial →",
    btnColor: "bg-blue-600 hover:bg-blue-700",
    btnSub: "You won't be charged until your trial ends",
    pillTitle: "14-day free trial",
    pillDesc: "Add a card now, charged after trial",
  },
  "7day": {
    badge: "7-day free trial — no card required",
    badgeColor: "bg-gray-100 border-gray-300 text-gray-600",
    title: "Start your free trial",
    sub: "Explore the platform free for 7 days.",
    btnText: "Start 7-day free trial →",
    btnColor: "bg-gray-700 hover:bg-gray-800",
    btnSub: "No card needed. Upgrade anytime during your trial.",
    pillTitle: "7-day free trial",
    pillDesc: "No card needed, limited trial",
  },
  paynow: {
    badge: "Subscribe now — full access immediately",
    badgeColor: "bg-emerald-50 border-emerald-200 text-emerald-700",
    title: "Subscribe to Getflowetic",
    sub: "Full access from day one. Cancel anytime.",
    btnText: "Subscribe and get started →",
    btnColor: "bg-emerald-600 hover:bg-emerald-700",
    btnSub: "You'll be charged $149/mo. Cancel anytime.",
    pillTitle: "Subscribe now",
    pillDesc: "Skip the trial, get full access today",
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
    ? mode === "14day"
      ? "border-blue-400 bg-blue-50"
      : mode === "7day"
        ? "border-gray-400 bg-gray-50"
        : "border-emerald-400 bg-emerald-50"
    : "border-gray-200";
  const dotColor =
    mode === "14day"
      ? "bg-blue-600"
      : mode === "7day"
        ? "bg-gray-600"
        : "bg-emerald-600";

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
        <p className="text-xs text-gray-500">{c.pillDesc}</p>
      </div>
      {tag && (
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${tag.color}`}>
          {tag.label}
        </span>
      )}
    </button>
  );
}

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
  const [mode, setMode] = useState<SignupMode>("14day");

  // Sign-in state
  const [siEmail, setSiEmail] = useState("");
  const [siPassword, setSiPassword] = useState("");
  const [siError, setSiError] = useState<string | null>(null);
  const [siLoading, setSiLoading] = useState(false);

  // Sign-up state
  const [suName, setSuName] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [suError, setSuError] = useState<string | null>(null);
  const [suLoading, setSuLoading] = useState(false);
  const [suSuccess, setSuSuccess] = useState(false);

  const cfg = MODE_CONFIG[mode];

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

    // Encode trial intent into the callback URL
    // trial=14 → 14-day trial (card added later via billing)
    // trial=7  → 7-day trial, no card
    // trial=0  → pay-now, redirect to billing after confirm
    const trialParam = mode === "14day" ? "14" : mode === "7day" ? "7" : "0";
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
        // Auto-confirmed (local dev) — redirect based on mode
        if (mode === "paynow") {
          router.push("/control-panel/settings?tab=billing&intent=subscribe");
        } else if (mode === "14day") {
          router.push("/control-panel/settings?tab=billing&intent=trial14");
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
        {/* Brand panel */}
        <div className="relative hidden w-[42%] flex-col justify-between overflow-hidden bg-[#0F1117] p-9 md:flex">
          <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-blue-600/10" />

          <div className="relative z-10 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-semibold text-white">
              G
            </div>
            <span className="text-sm font-medium tracking-tight text-white">
              Getflowetic
            </span>
          </div>

          <div className="relative z-10">
            <h2 className="text-xl font-medium leading-snug tracking-tight text-white">
              Your AI agent.
              <br />
              Your brand.
              <br />
              Your revenue.
            </h2>
            <p className="mt-3 text-xs leading-relaxed text-slate-400">
              Connect Vapi, Retell, Make, or n8n — get a white-labeled client
              portal in 60 seconds.
            </p>
          </div>

          <div className="relative z-10 rounded-xl border border-white/10 bg-white/5 p-3.5">
            <p className="text-xs italic leading-relaxed text-slate-300">
              "Went from sending screenshots to giving clients a real dashboard.
              My retention went up immediately."
            </p>
            <div className="mt-2.5 flex items-center gap-2">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-medium text-white">
                JM
              </div>
              <span className="text-xs text-slate-400">
                James M. — AI automation agency
              </span>
            </div>
          </div>

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

        {/* Form panel */}
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

          {/* Sign in */}
          {tab === "signin" && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-gray-900">
                  Welcome back
                </h1>
                <p className="mt-0.5 text-xs text-gray-400">
                  Sign in to your agency dashboard
                </p>
              </div>
              {siError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
                  {siError}
                </div>
              )}
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
            </form>
          )}

          {/* Sign up */}
          {tab === "signup" && (
            <form onSubmit={handleSignUp} className="space-y-3">
              <div
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${cfg.badgeColor}`}
              >
                <div className="h-1.5 w-1.5 rounded-full bg-current" />
                {cfg.badge}
              </div>
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
                className={`w-full rounded-lg py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50 ${cfg.btnColor}`}
              >
                {suLoading ? "Creating account..." : cfg.btnText}
              </button>
              <p className="text-center text-xs text-gray-400">{cfg.btnSub}</p>

              <div className="flex items-center gap-2 py-1">
                <div className="h-px flex-1 bg-gray-100" />
                <span className="text-xs text-gray-400">
                  or choose a different plan
                </span>
                <div className="h-px flex-1 bg-gray-100" />
              </div>

              <div className="space-y-2">
                <PillRadio
                  mode="14day"
                  current={mode}
                  onClick={() => setMode("14day")}
                  tag={{ label: "Recommended", color: "bg-blue-50 text-blue-600" }}
                />
                <PillRadio
                  mode="7day"
                  current={mode}
                  onClick={() => setMode("7day")}
                />
                <PillRadio
                  mode="paynow"
                  current={mode}
                  onClick={() => setMode("paynow")}
                  tag={{
                    label: "Full access",
                    color: "bg-emerald-50 text-emerald-600",
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
