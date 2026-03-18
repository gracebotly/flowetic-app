"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  LogIn,
  UserPlus,
  Shield,
  Building2,
} from "lucide-react";

type InviteStatus =
  | "loading"
  | "ready"
  | "accepting"
  | "success"
  | "error"
  | "login_required";

type InviteInfo = {
  tenant_name: string;
  role: string;
  email: string;
  is_authenticated: boolean;
  user_email: string | null;
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

const FadeIn = ({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, ease: "easeOut", delay }}
    className={className}
  >
    {children}
  </motion.div>
);

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  const [status, setStatus] = useState<InviteStatus>("loading");
  const [message, setMessage] = useState("");
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);

  // Step 1: Validate the token (no auth required)
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
            INVITE_EXPIRED:
              "This invite has expired. Ask the admin to send a new one.",
          };
          setMessage(messages[data.code] || "Something went wrong.");
          return;
        }

        setInviteInfo(data);

        if (data.is_authenticated) {
          setStatus("ready");
        } else {
          setStatus("login_required");
        }
      } catch {
        setStatus("error");
        setMessage("Failed to validate invite. Please try again.");
      }
    })();
  }, [token]);

  // Step 2: Accept the invite
  const handleAccept = async () => {
    setStatus("accepting");
    try {
      const res = await fetch(`/api/invite/${token}`, { method: "POST" });
      const data = await res.json();

      if (data.ok) {
        setStatus("success");
        setMessage(data.tenant_name || "the workspace");
        setTimeout(() => {
          router.push("/control-panel/connections");
        }, 2500);
      } else {
        setStatus("error");
        const messages: Record<string, string> = {
          AUTH_REQUIRED: "Please sign in first.",
          ALREADY_MEMBER: "You're already a member of this workspace.",
          INVITE_EXPIRED:
            "This invite has expired. Ask the admin to send a new one.",
          ACCEPT_FAILED: "Failed to join. Please try again.",
        };
        setMessage(messages[data.code] || data.message || "Failed to accept.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  };

  const handleSignIn = () => {
    const returnUrl = encodeURIComponent(`/invite/${token}`);
    router.push(`/login?next=/invite/${returnUrl}`);
  };

  const handleSignUp = () => {
    const returnUrl = encodeURIComponent(`/invite/${token}`);
    router.push(`/signup?next=/invite/${returnUrl}`);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        {/* Loading */}
        {(status === "loading" || status === "accepting") && (
          <FadeIn>
            <div className="rounded-2xl border border-gray-200 bg-white px-8 py-10 text-center shadow-sm">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
              <p className="mt-4 text-sm text-slate-600">
                {status === "loading"
                  ? "Validating invite..."
                  : "Joining workspace..."}
              </p>
            </div>
          </FadeIn>
        )}

        {/* Ready — show invite details + accept button */}
        {status === "ready" && inviteInfo && (
          <FadeIn>
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
              {/* Header */}
              <div className="border-b border-gray-100 px-8 py-6 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
                  <Building2 className="h-6 w-6 text-blue-600" />
                </div>
                <h1 className="text-lg font-semibold tracking-tight text-slate-900">
                  Join {inviteInfo.tenant_name}
                </h1>
                <p className="mt-1 text-sm text-slate-600">
                  You&apos;ve been invited to join this workspace
                </p>
              </div>

              {/* Details */}
              <div className="space-y-4 px-8 py-6">
                {/* Role card */}
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm">
                      <Shield className="h-4 w-4 text-slate-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {ROLE_LABELS[inviteInfo.role] || inviteInfo.role}
                      </p>
                      <p className="text-xs text-slate-600">
                        {ROLE_DESCRIPTIONS[inviteInfo.role] || "Team member access"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Signed in as */}
                {inviteInfo.user_email && (
                  <p className="text-center text-xs text-slate-600">
                    Signed in as{" "}
                    <span className="font-medium text-slate-900">
                      {inviteInfo.user_email}
                    </span>
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="border-t border-gray-100 px-8 py-5">
                <button
                  onClick={handleAccept}
                  className="w-full cursor-pointer rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-blue-700"
                >
                  Accept Invite
                </button>
                <button
                  onClick={() => router.push("/control-panel/connections")}
                  className="mt-2 w-full cursor-pointer rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors duration-200 hover:bg-gray-50"
                >
                  Decline
                </button>
              </div>
            </div>
          </FadeIn>
        )}

        {/* Login required — show invite preview + auth buttons */}
        {status === "login_required" && inviteInfo && (
          <FadeIn>
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
              {/* Header */}
              <div className="border-b border-gray-100 px-8 py-6 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
                  <Building2 className="h-6 w-6 text-blue-600" />
                </div>
                <h1 className="text-lg font-semibold tracking-tight text-slate-900">
                  Join {inviteInfo.tenant_name}
                </h1>
                <p className="mt-1 text-sm text-slate-600">
                  You&apos;ve been invited as{" "}
                  <span className="font-medium text-slate-900">
                    {ROLE_LABELS[inviteInfo.role] || inviteInfo.role}
                  </span>
                </p>
              </div>

              {/* Auth buttons */}
              <div className="space-y-3 px-8 py-6">
                <p className="text-center text-sm text-slate-600">
                  Sign in or create an account to continue
                </p>

                <button
                  onClick={handleSignIn}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-blue-700"
                >
                  <LogIn className="h-4 w-4" />
                  Sign In
                </button>

                <button
                  onClick={handleSignUp}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition-colors duration-200 hover:bg-gray-50"
                >
                  <UserPlus className="h-4 w-4" />
                  Create Account
                </button>
              </div>

              <div className="border-t border-gray-100 px-8 py-4">
                <p className="text-center text-xs text-slate-600">
                  Invite sent to{" "}
                  <span className="font-medium text-slate-900">
                    {inviteInfo.email}
                  </span>
                </p>
              </div>
            </div>
          </FadeIn>
        )}

        {/* Success */}
        {status === "success" && (
          <FadeIn>
            <div className="rounded-2xl border border-gray-200 bg-white px-8 py-10 text-center shadow-sm">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 200,
                  damping: 15,
                  delay: 0.1,
                }}
              >
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
              </motion.div>
              <h2 className="mt-4 text-lg font-semibold text-slate-900">
                You&apos;re in!
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Welcome to {message}
              </p>
              <p className="mt-4 text-xs text-slate-600">
                Redirecting to your dashboard...
              </p>
            </div>
          </FadeIn>
        )}

        {/* Error */}
        {status === "error" && (
          <FadeIn>
            <div className="rounded-2xl border border-gray-200 bg-white px-8 py-10 text-center shadow-sm">
              <XCircle className="mx-auto h-10 w-10 text-red-400" />
              <h2 className="mt-4 text-lg font-semibold text-slate-900">
                Invite Error
              </h2>
              <p className="mt-1 text-sm text-slate-600">{message}</p>
              <button
                onClick={() => router.push("/login")}
                className="mt-6 cursor-pointer rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors duration-200 hover:bg-gray-50"
              >
                Go to Sign In
              </button>
            </div>
          </FadeIn>
        )}
      </div>
    </div>
  );
}
