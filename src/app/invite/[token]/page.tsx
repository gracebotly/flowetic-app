"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  LogIn,
  UserPlus,
  Shield,
  Building2,
  AlertTriangle,
  LogOut,
} from "lucide-react";

type InviteStatus =
  | "loading"
  | "ready"
  | "accepting"
  | "success"
  | "error"
  | "login_required"
  | "wrong_account";

type InviteInfo = {
  tenant_name: string;
  role: string;
  email: string;
  is_authenticated: boolean;
  user_email: string | null;
  email_match: boolean | null;
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  client: "Client",
  viewer: "Viewer",
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: "Full access including team and billing",
  client: "Can create and edit client portals",
  viewer: "Read-only access to the workspace",
};

const FadeIn = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, ease: "easeOut" }}
    className={className}
  >
    {children}
  </motion.div>
);

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [status, setStatus] = useState<InviteStatus>("loading");
  const [message, setMessage] = useState("");
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`/api/invite/${token}`);
        const data = await res.json();

        if (!data.ok) {
          setStatus("error");
          const messages: Record<string, string> = {
            INVITE_NOT_FOUND: "This invite link is invalid or has expired.",
            ALREADY_ACCEPTED: "This invite has already been accepted.",
            INVITE_REVOKED: "This invite has been revoked by the admin.",
            INVITE_EXPIRED: "This invite has expired. Ask the admin to send a new one.",
          };
          setMessage(messages[data.code] || "Something went wrong.");
          return;
        }

        setInviteInfo(data);

        if (!data.is_authenticated) {
          setStatus("login_required");
        } else if (data.email_match === false) {
          setStatus("wrong_account");
        } else {
          setStatus("ready");
        }
      } catch {
        setStatus("error");
        setMessage("Failed to validate invite. Please try again.");
      }
    })();
  }, [token]);

  const handleAccept = async () => {
    setStatus("accepting");
    try {
      const res = await fetch(`/api/invite/${token}`, { method: "POST" });
      const data = await res.json();

      if (data.ok) {
        setStatus("success");
        setMessage(data.tenant_name || "the workspace");
        setTimeout(() => router.push("/control-panel/connections"), 2500);
      } else {
        if (data.code === "EMAIL_MISMATCH") {
          setInviteInfo((prev) =>
            prev ? { ...prev, email: data.invite_email || prev.email, user_email: data.current_email || prev.user_email, email_match: false } : prev
          );
          setStatus("wrong_account");
          return;
        }
        setStatus("error");
        const messages: Record<string, string> = {
          AUTH_REQUIRED: "Please sign in first.",
          ALREADY_MEMBER: "You're already a member of this workspace.",
          INVITE_NOT_FOUND: "This invite link is invalid or has expired.",
          INVITE_EXPIRED: "This invite has expired. Ask the admin to send a new one.",
          ACCEPT_FAILED: "Failed to join. Please try again.",
        };
        setMessage(messages[data.code] || data.message || "Failed to accept.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    const returnUrl = encodeURIComponent(`/invite/${token}`);
    router.push(`/login?next=${returnUrl}`);
  };

  const handleSignIn = () => {
    const returnUrl = encodeURIComponent(`/invite/${token}`);
    router.push(`/login?next=${returnUrl}`);
  };

  const handleSignUp = () => {
    const returnUrl = encodeURIComponent(`/invite/${token}`);
    router.push(`/signup?next=${returnUrl}`);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">

        {(status === "loading" || status === "accepting") && (
          <FadeIn>
            <div className="rounded-2xl border border-gray-200 bg-white px-8 py-10 text-center shadow-sm">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
              <p className="mt-4 text-sm text-slate-600">
                {status === "loading" ? "Validating invite..." : "Joining workspace..."}
              </p>
            </div>
          </FadeIn>
        )}

        {status === "wrong_account" && inviteInfo && (
          <FadeIn>
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-8 py-6 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50">
                  <AlertTriangle className="h-6 w-6 text-amber-600" />
                </div>
                <h1 className="text-lg font-semibold tracking-tight text-slate-900">Wrong Account</h1>
                <p className="mt-2 text-sm text-slate-600">This invite was sent to</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-900">{inviteInfo.email}</p>
              </div>
              <div className="space-y-3 px-8 py-6">
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-sm text-amber-800">
                    You&apos;re signed in as <span className="font-semibold">{inviteInfo.user_email}</span>.
                    Please sign out and sign in with <span className="font-semibold">{inviteInfo.email}</span> to accept.
                  </p>
                </div>
                <button
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-blue-700 disabled:opacity-50"
                >
                  {signingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                  {signingOut ? "Signing out..." : "Sign Out & Switch Account"}
                </button>
                <button
                  onClick={() => router.push("/control-panel/connections")}
                  className="w-full cursor-pointer rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors duration-200 hover:bg-gray-50"
                >
                  Go to Dashboard
                </button>
              </div>
            </div>
          </FadeIn>
        )}

        {status === "ready" && inviteInfo && (
          <FadeIn>
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-8 py-6 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
                  <Building2 className="h-6 w-6 text-blue-600" />
                </div>
                <h1 className="text-lg font-semibold tracking-tight text-slate-900">Join {inviteInfo.tenant_name}</h1>
                <p className="mt-1 text-sm text-slate-600">You&apos;ve been invited to join this workspace</p>
              </div>
              <div className="space-y-4 px-8 py-6">
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm">
                      <Shield className="h-4 w-4 text-slate-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{ROLE_LABELS[inviteInfo.role] || inviteInfo.role}</p>
                      <p className="text-xs text-slate-600">{ROLE_DESCRIPTIONS[inviteInfo.role] || "Team member access"}</p>
                    </div>
                  </div>
                </div>
                {inviteInfo.user_email && (
                  <p className="text-center text-xs text-slate-600">
                    Signed in as <span className="font-medium text-slate-900">{inviteInfo.user_email}</span>
                  </p>
                )}
              </div>
              <div className="border-t border-gray-100 px-8 py-5">
                <button onClick={handleAccept} className="w-full cursor-pointer rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-blue-700">
                  Accept Invite
                </button>
                <button onClick={() => router.push("/control-panel/connections")} className="mt-2 w-full cursor-pointer rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors duration-200 hover:bg-gray-50">
                  Decline
                </button>
              </div>
            </div>
          </FadeIn>
        )}

        {status === "login_required" && inviteInfo && (
          <FadeIn>
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-8 py-6 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
                  <Building2 className="h-6 w-6 text-blue-600" />
                </div>
                <h1 className="text-lg font-semibold tracking-tight text-slate-900">Join {inviteInfo.tenant_name}</h1>
                <p className="mt-1 text-sm text-slate-600">
                  You&apos;ve been invited as <span className="font-medium text-slate-900">{ROLE_LABELS[inviteInfo.role] || inviteInfo.role}</span>
                </p>
              </div>
              <div className="space-y-3 px-8 py-6">
                <p className="text-center text-sm text-slate-600">Sign in or create an account to continue</p>
                <button onClick={handleSignIn} className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-blue-700">
                  <LogIn className="h-4 w-4" />
                  Sign In
                </button>
                <button onClick={handleSignUp} className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition-colors duration-200 hover:bg-gray-50">
                  <UserPlus className="h-4 w-4" />
                  Create Account
                </button>
              </div>
              <div className="border-t border-gray-100 px-8 py-4">
                <p className="text-center text-xs text-slate-600">
                  Invite sent to <span className="font-medium text-slate-900">{inviteInfo.email}</span>
                </p>
              </div>
            </div>
          </FadeIn>
        )}

        {status === "success" && (
          <FadeIn>
            <div className="rounded-2xl border border-gray-200 bg-white px-8 py-10 text-center shadow-sm">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}>
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
              </motion.div>
              <h2 className="mt-4 text-lg font-semibold text-slate-900">You&apos;re in!</h2>
              <p className="mt-1 text-sm text-slate-600">Welcome to {message}</p>
              <p className="mt-4 text-xs text-slate-600">Redirecting to your dashboard...</p>
            </div>
          </FadeIn>
        )}

        {status === "error" && (
          <FadeIn>
            <div className="rounded-2xl border border-gray-200 bg-white px-8 py-10 text-center shadow-sm">
              <XCircle className="mx-auto h-10 w-10 text-red-400" />
              <h2 className="mt-4 text-lg font-semibold text-slate-900">Invite Error</h2>
              <p className="mt-1 text-sm text-slate-600">{message}</p>
              <button onClick={() => router.push("/login")} className="mt-6 cursor-pointer rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors duration-200 hover:bg-gray-50">
                Go to Sign In
              </button>
            </div>
          </FadeIn>
        )}
      </div>
    </div>
  );
}
