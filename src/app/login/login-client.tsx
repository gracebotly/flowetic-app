"use client";

import { createClient } from "@/lib/supabase/client";
import { trackSignUp, trackSignIn } from "@/lib/analytics/events";
import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  Eye,
  EyeOff,
  ChevronLeft,
  ArrowLeft,
} from "lucide-react";

type SignupMode = "7day" | "agency-pay" | "scale-pay";

/** Must match the regex in /api/auth/signup/route.ts */
const EMAIL_RE =
  /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;

/** Password strength: 0 = weak, 1 = ok, 2 = good */
function getPasswordStrength(pw: string): {
  score: 0 | 1 | 2;
  label: string;
  color: string;
  width: string;
} {
  if (!pw || pw.length < 8)
    return { score: 0, label: "Too short", color: "bg-red-400", width: "33%" };
  let pts = 0;
  if (pw.length >= 8) pts++;
  if (pw.length >= 12) pts++;
  if (/[A-Z]/.test(pw) || /[0-9]/.test(pw)) pts++;
  if (/[^A-Za-z0-9]/.test(pw)) pts++;
  if (pts <= 1) return { score: 0, label: "Weak", color: "bg-red-400", width: "33%" };
  if (pts <= 2) return { score: 1, label: "OK", color: "bg-amber-400", width: "66%" };
  return { score: 2, label: "Strong", color: "bg-green-500", width: "100%" };
}

/** Fade-in wrapper for state transitions */
const FadeIn = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.25, ease: "easeOut" }}
    className={className}
  >
    {children}
  </motion.div>
);

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
      <span className="bg-white px-2 text-slate-500">or</span>
    </div>
  </div>
);

/** Reusable password input with show/hide toggle */
function PasswordField({
  value,
  onChange,
  placeholder,
  autoComplete,
  required,
  minLength,
  onBlur,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoComplete: string;
  required?: boolean;
  minLength?: number;
  onBlur?: () => void;
  error?: string | null;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          className={`w-full rounded-lg border px-3 py-2 pr-10 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 ${
            error
              ? "border-red-300 focus:border-red-400"
              : "border-gray-200 focus:border-blue-500"
          }`}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow(!show)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer rounded p-0.5 transition-colors duration-200 hover:bg-gray-100"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? (
            <EyeOff className="h-4 w-4 text-slate-400" />
          ) : (
            <Eye className="h-4 w-4 text-slate-400" />
          )}
        </button>
      </div>
      {error && (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}

/** Inline validation error — shown below a field on blur */
function FieldError({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs text-red-500">{msg}</p>;
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
  const [mode, setMode] = useState<SignupMode>("7day");

  // Sign-in state
  const [siEmail, setSiEmail] = useState("");
  const [siPassword, setSiPassword] = useState("");
  const [siError, setSiError] = useState<string | null>(null);
  const [siLoading, setSiLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Forgot password state
  const [forgotMode, setForgotMode] = useState(false);
  const [fpEmail, setFpEmail] = useState("");
  const [fpLoading, setFpLoading] = useState(false);
  const [fpError, setFpError] = useState<string | null>(null);
  const [fpSent, setFpSent] = useState(false);

  // Sign-up state
  const [suName, setSuName] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [suError, setSuError] = useState<string | null>(null);
  const [suLoading, setSuLoading] = useState(false);
  const [suSuccess, setSuSuccess] = useState(false);

  // Inline validation errors (shown on blur)
  const [suEmailError, setSuEmailError] = useState<string | null>(null);
  const [suPasswordError, setSuPasswordError] = useState<string | null>(null);
  const [siEmailError, setSiEmailError] = useState<string | null>(null);

  const urlError = searchParams.get("error");
  const urlErrorMessage =
    urlError === "not_registered"
      ? "No account found for that email. Please sign up first."
      : urlError === "workspace_deleted"
        ? "This workspace has been deleted. Contact support if you need to restore it."
        : urlError === "auth_failed"
          ? 'Sign-in was interrupted. Please click "Continue with Google" to try again.'
          : null;

  const cfg = MODE_CONFIG[mode];
  const isPayNow = mode === "agency-pay" || mode === "scale-pay";
  const selectedPlan = mode === "scale-pay" ? "scale" : "agency";

  // Password strength (signup only)
  const strength = getPasswordStrength(suPassword);

  // ── Inline validators (on blur) ──

  const validateEmail = (email: string): string | null => {
    if (!email) return null; // Don't flag empty on blur — let required handle it
    if (!EMAIL_RE.test(email.trim()))
      return "Please enter a valid email (e.g. you@company.com)";
    return null;
  };

  const validateSignupPassword = (pw: string): string | null => {
    if (!pw) return null;
    if (pw.length < 8) return "Must be at least 8 characters";
    return null;
  };

  // ── Sign-in handler ──

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSiLoading(true);
    setSiError(null);
    const { error, data } = await supabase.auth.signInWithPassword({
      email: siEmail,
      password: siPassword,
    });
    if (error) {
      setSiError(error.message);
      setSiLoading(false);
      return;
    }

    // Safety net: if user somehow has no tenant (e.g. email-confirm callback
    // failed to create one), create it now via the ensure-tenant API.
    if (data?.user) {
      try {
        await fetch("/api/auth/ensure-tenant", { method: "POST" });
      } catch {
        // Non-fatal — the page will still load, just might show "contact admin"
        console.warn("[login] ensure-tenant call failed");
      }
    }

    trackSignIn(data.user?.id || "", siEmail);
    router.push(next);
    router.refresh();
  };

  // ── Google OAuth ──

  const signInWithGoogle = async (intent: "signin" | "signup" = "signin") => {
    setGoogleLoading(true);
    setSiError(null);
    setSuError(null);
    const params = new URLSearchParams({ intent });
    if (intent === "signup") {
      const trialParam = isPayNow ? "0" : "7";
      params.set("trial", trialParam);
      params.set("plan", selectedPlan);
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

  // ── Forgot password (magic link) ──

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFpLoading(true);
    setFpError(null);

    if (!EMAIL_RE.test(fpEmail.trim())) {
      setFpError("Please enter a valid email address.");
      setFpLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/send-signin-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: fpEmail.trim() }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        // If typo detected, auto-fill the corrected email
        if (data.code === "typo_detected" && data.suggested) {
          setFpEmail(data.suggested);
          setFpError(data.message);
        } else {
          setFpError(data.message || "Something went wrong. Please try again.");
        }
        setFpLoading(false);
        return;
      }

      setFpSent(true);
      setFpLoading(false);
    } catch {
      setFpError("Network error. Please try again.");
      setFpLoading(false);
    }
  };

  // ── Sign-up handler ──

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuLoading(true);
    setSuError(null);

    // Client-side email validation
    if (!EMAIL_RE.test(suEmail.trim())) {
      setSuError("Please enter a valid email address (e.g. you@company.com).");
      setSuLoading(false);
      return;
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!siteUrl || !siteUrl.startsWith("http")) {
      setSuError("Missing NEXT_PUBLIC_SITE_URL env var.");
      setSuLoading(false);
      return;
    }

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
          trial: trialParam,
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
        // When Supabase auto-confirms the email, we get a session immediately
        // but the auth callback (which creates the tenant) is never hit.
        // Create tenant first, then route accordingly.
        try {
          await fetch("/api/auth/ensure-tenant", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              plan: isPayNow ? selectedPlan : "agency",
              skipTrial: isPayNow,
            }),
          });
        } catch {
          console.warn("[signup] ensure-tenant call failed");
        }
        trackSignUp(
          body.userId || suEmail,
          suEmail,
          isPayNow ? selectedPlan : "agency-trial"
        );

        if (isPayNow) {
          // Redirect to Stripe Checkout directly — don't show the app first.
          // User stays on this page with loading state until Stripe URL is ready.
          try {
            const stripeRes = await fetch("/api/billing/subscribe", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ plan: selectedPlan, skipTrial: true }),
            });
            const stripeData = await stripeRes.json();
            if (stripeData.url) {
              window.location.href = stripeData.url;
              return;
            }
          } catch {
            console.warn("[signup] stripe subscribe call failed");
          }
          // Fallback: if Stripe call fails, send to billing page
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

  // ── Check-email success screen ──

  if (suSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white px-8 py-10 text-center shadow-sm"
        >
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
            <Mail className="h-6 w-6 text-blue-600" />
          </div>

          <h1 className="text-lg font-semibold tracking-tight text-slate-900">
            Confirm your email
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            We sent a confirmation link to
          </p>
          <p className="text-sm font-medium text-slate-900">{suEmail}</p>

          <div className="mx-auto my-5 h-px w-16 bg-gray-200" />

          <div className="space-y-2 text-xs leading-relaxed text-slate-500">
            <p>Open the email and click the link to activate your account.</p>
            <p>
              Don&apos;t see it? Check your{" "}
              <span className="font-medium text-slate-600">spam or promotions</span>{" "}
              folder.
            </p>
          </div>

          <div className="mt-6">
            <button
              onClick={() => {
                setSuSuccess(false);
                setTab("signin");
              }}
              className="cursor-pointer text-xs font-medium text-blue-600 transition-colors duration-200 hover:text-blue-700"
            >
              Go to sign in
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="flex w-full max-w-3xl overflow-hidden rounded-2xl border border-gray-200 shadow-sm">

        {/* ── Brand panel ── */}
        <div className="relative hidden w-[42%] flex-col justify-start gap-8 overflow-hidden bg-[#0F1117] p-9 md:flex">
          <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-blue-600/10" />

          <div className="relative z-10">
            <img
              src="/assets/logo-white.svg"
              alt="Getflowetic"
              className="h-7 w-auto"
            />
          </div>

          <div className="relative z-10">
            <h2 className="text-xl font-medium leading-snug tracking-tight text-white">
              Your AI agent.
              <br />
              Your brand.
              <br />
              Your revenue.
            </h2>
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

        {/* ── Form panel ── */}
        <div className="flex flex-1 flex-col justify-center bg-white px-8 py-10">

          {/* Back to site */}
          <a
            href="https://getflowetic.com"
            className="mb-4 inline-flex items-center gap-1 self-start cursor-pointer text-xs text-slate-400 transition-colors duration-200 hover:text-slate-600"
          >
            <ChevronLeft className="h-3 w-3" />
            Back to site
          </a>

          {/* Tabs */}
          <div className="mb-6 flex border-b border-gray-100">
            {(["signin", "signup"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTab(t);
                  setForgotMode(false);
                  setFpSent(false);
                }}
                className={`-mb-px mr-5 pb-3 text-sm font-medium transition-colors ${
                  tab === t
                    ? "border-b-2 border-blue-600 text-blue-600"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                {t === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          {/* ── Sign in ── */}
          <AnimatePresence mode="wait">
            {tab === "signin" && !forgotMode && (
              <FadeIn key="signin-pane" className="space-y-4">
            <div>
                <h1 className="text-lg font-semibold tracking-tight text-gray-900">
                  Welcome back
                </h1>
                <p className="mt-0.5 text-xs text-slate-500">
                  Sign in to your account
                </p>
              </div>

              {siError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
                  {siError}
                </div>
              )}

              {urlErrorMessage && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
                  {urlErrorMessage}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => signInWithGoogle("signin")}
                  disabled={googleLoading}
                  className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors duration-200 hover:bg-gray-50 disabled:opacity-50"
                >
                  <GoogleIcon />
                  {googleLoading ? "Redirecting..." : "Google"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setForgotMode(true);
                    setFpEmail(siEmail);
                    setFpError(null);
                    setFpSent(false);
                  }}
                  className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors duration-200 hover:bg-gray-50"
                >
                  <Mail className="h-4 w-4 text-slate-500" />
                  Email link
                </button>
              </div>

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
                    onChange={(e) => {
                      setSiEmail(e.target.value);
                      if (siEmailError) setSiEmailError(null);
                    }}
                    onBlur={() => setSiEmailError(validateEmail(siEmail))}
                    placeholder="you@agency.com"
                    className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 ${
                      siEmailError
                        ? "border-red-300 focus:border-red-400"
                        : "border-gray-200 focus:border-blue-500"
                    }`}
                  />
                  <FieldError msg={siEmailError} />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-600">
                    Password
                  </label>
                  <PasswordField
                    value={siPassword}
                    onChange={setSiPassword}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setForgotMode(true);
                      setFpEmail(siEmail);
                      setFpError(null);
                      setFpSent(false);
                    }}
                    className="mt-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                  >
                    Forgot password?
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={siLoading}
                  className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                  {siLoading ? "Signing in..." : "Sign in"}
                </button>
              </form>

              <p className="text-center text-xs text-slate-500">
                No account?{" "}
                <button
                  type="button"
                  onClick={() => setTab("signup")}
                  className="font-medium text-blue-600 hover:text-blue-700"
                >
                  Create one
                </button>
              </p>
              </FadeIn>
            )}

            {tab === "signin" && forgotMode && (
              <FadeIn key="forgot-pane" className="space-y-4">

          {/* ── Forgot password (inline magic link) ── */}
          
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-gray-900">
                  Sign in with email link
                </h1>
                <p className="mt-0.5 text-xs text-slate-500">
                  We&apos;ll send a one-time link to your inbox. No password needed.
                </p>
              </div>

              {fpError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
                  {fpError}
                </div>
              )}

              {fpSent ? (
                <FadeIn className="space-y-5">
                  <div className="rounded-xl border border-gray-200 bg-white px-5 py-6 text-center shadow-sm">
                    <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-blue-50">
                      <Mail className="h-5 w-5 text-blue-600" />
                    </div>
                    <p className="text-sm font-medium text-green-800">
                      Check your email
                    </p>
                    <p className="mt-1 text-xs text-green-700">
                      We sent a sign-in link to{" "}
                      <span className="font-medium">{fpEmail}</span>.
                      <br />
                      Click the link and you&apos;ll be signed in instantly.
                    </p>
                    <p className="mt-2 text-xs text-green-600/70">
                      Don&apos;t see it? Check your spam folder.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotMode(false);
                      setFpSent(false);
                    }}
                    className="flex w-full cursor-pointer items-center justify-center gap-1 text-xs font-medium text-slate-400 transition-colors duration-200 hover:text-slate-600"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    Back to sign in
                  </button>
                </FadeIn>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-gray-600">
                      Email
                    </label>
                    <input
                      type="email"
                      autoComplete="email"
                      required
                      value={fpEmail}
                      onChange={(e) => setFpEmail(e.target.value)}
                      placeholder="you@agency.com"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={fpLoading}
                    className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                  >
                    {fpLoading ? "Sending..." : "Send sign-in link"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setForgotMode(false)}
                    className="flex w-full cursor-pointer items-center justify-center gap-1 text-xs font-medium text-slate-400 transition-colors duration-200 hover:text-slate-600"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    Back to sign in
                  </button>
                </form>
              )}
              </FadeIn>
            )}
          </AnimatePresence>

          {/* ── Sign up ── */}
          {tab === "signup" && (
            <form onSubmit={handleSignUp} className="space-y-3">
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-gray-900">
                  {cfg.title}
                </h1>
                <p className="mt-0.5 text-xs text-slate-500">{cfg.sub}</p>
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
                  onChange={(e) => {
                    setSuEmail(e.target.value);
                    if (suEmailError) setSuEmailError(null);
                  }}
                  onBlur={() => setSuEmailError(validateEmail(suEmail))}
                  placeholder="you@agency.com"
                  className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 ${
                    suEmailError
                      ? "border-red-300 focus:border-red-400"
                      : "border-gray-200 focus:border-blue-500"
                  }`}
                />
                <FieldError msg={suEmailError} />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-600">
                  Password
                </label>
                <PasswordField
                  value={suPassword}
                  onChange={(v) => {
                    setSuPassword(v);
                    if (suPasswordError) setSuPasswordError(null);
                  }}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  onBlur={() =>
                    setSuPasswordError(validateSignupPassword(suPassword))
                  }
                  error={suPasswordError}
                />
                {/* Password strength meter */}
                {suPassword.length > 0 && (
                  <div className="pt-1.5">
                    <div className="h-1 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${strength.color}`}
                        style={{ width: strength.width }}
                      />
                    </div>
                    <p
                      className={`mt-1 text-xs ${
                        strength.score === 0
                          ? "text-red-500"
                          : strength.score === 1
                            ? "text-amber-500"
                            : "text-green-600"
                      }`}
                    >
                      {strength.label}
                    </p>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={suLoading}
                className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {suLoading ? "Creating account..." : cfg.btnText}
              </button>

              {cfg.btnSub && (
                <p className="text-center text-xs text-slate-500">{cfg.btnSub}</p>
              )}

              <div className="flex items-center gap-2 py-1">
                <div className="h-px flex-1 bg-gray-100" />
                <span className="text-xs text-slate-500">
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

              <p className="text-center text-xs text-slate-500">
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
