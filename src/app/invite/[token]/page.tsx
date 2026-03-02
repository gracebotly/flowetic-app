"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, CheckCircle2, XCircle, LogIn } from "lucide-react";

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  const [status, setStatus] = useState<"loading" | "accepting" | "success" | "error" | "login_required">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) return;

    (async () => {
      // Step 1: Validate the token
      const res = await fetch(`/api/invite/${token}`);
      const json = await res.json();

      if (!json.ok) {
        if (json.code === "AUTH_REQUIRED") {
          // User not logged in — redirect to login with return URL
          setStatus("login_required");
          setMessage("Please sign in to accept this invite.");
          return;
        }
        setStatus("error");
        setMessage(
          json.code === "INVITE_NOT_FOUND"
            ? "This invite link is invalid or has expired."
            : json.code === "ALREADY_ACTIVE"
              ? "This invite has already been accepted."
              : json.message || "Something went wrong."
        );
        return;
      }

      // Step 2: Accept the invite
      setStatus("accepting");
      const acceptRes = await fetch(`/api/invite/${token}`, { method: "POST" });
      const acceptJson = await acceptRes.json();

      if (acceptJson.ok) {
        setStatus("success");
        setMessage(`You've joined ${acceptJson.tenant_name || "the workspace"}!`);
        // Redirect to control panel after short delay
        setTimeout(() => {
          router.push("/control-panel/settings?tab=team");
        }, 2000);
      } else {
        setStatus("error");
        setMessage(
          acceptJson.code === "ALREADY_MEMBER"
            ? "You're already a member of this workspace."
            : acceptJson.message || "Failed to accept invite."
        );
      }
    })();
  }, [token, router]);

  const handleLogin = () => {
    // Redirect to login with return URL back to this invite page
    const returnUrl = encodeURIComponent(`/invite/${token}`);
    router.push(`/login?redirect=${returnUrl}`);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        {status === "loading" || status === "accepting" ? (
          <>
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-blue-500" />
            <p className="mt-4 text-sm text-gray-600">
              {status === "loading" ? "Validating invite..." : "Joining workspace..."}
            </p>
          </>
        ) : status === "success" ? (
          <>
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
            <h2 className="mt-4 text-lg font-semibold text-gray-900">You&apos;re in!</h2>
            <p className="mt-1 text-sm text-gray-600">{message}</p>
            <p className="mt-3 text-xs text-gray-400">Redirecting to dashboard...</p>
          </>
        ) : status === "login_required" ? (
          <>
            <LogIn className="mx-auto h-10 w-10 text-blue-500" />
            <h2 className="mt-4 text-lg font-semibold text-gray-900">Sign in required</h2>
            <p className="mt-1 text-sm text-gray-600">{message}</p>
            <div className="mt-6 flex flex-col gap-2">
              <button
                onClick={handleLogin}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
              >
                Sign In
              </button>
              <button
                onClick={() => router.push(`/signup?redirect=${encodeURIComponent(`/invite/${token}`)}`)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Create Account
              </button>
            </div>
          </>
        ) : (
          <>
            <XCircle className="mx-auto h-10 w-10 text-red-500" />
            <h2 className="mt-4 text-lg font-semibold text-gray-900">Invite Error</h2>
            <p className="mt-1 text-sm text-gray-600">{message}</p>
            <button
              onClick={() => router.push("/login")}
              className="mt-6 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Go to Login
            </button>
          </>
        )}
      </div>
    </div>
  );
}
