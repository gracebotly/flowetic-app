"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function EmailConfirmBanner() {
  const [confirmed, setConfirmed] = useState<boolean | null>(null);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!active) return;
      if (!user) return setConfirmed(true);
      setConfirmed(!!user.email_confirmed_at);
    });
    return () => {
      active = false;
    };
  }, []);

  if (confirmed === null || confirmed === true) return null;

  const handleResend = async () => {
    setResending(true);
    try {
      const res = await fetch("/api/auth/resend-confirmation", {
        method: "POST",
      });
      const body = await res.json();
      if (body.ok) setResent(true);
    } catch {
      // Silently fail — user can try again
    }
    setResending(false);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex items-center gap-3 border-b border-blue-200 bg-blue-50 px-6 py-2.5"
      >
        <Mail className="h-4 w-4 shrink-0 text-blue-600" />
        <p className="flex-1 text-sm text-slate-900">
          Verify your email to unlock all features.{" "}
          <span className="text-slate-600">
            Check your inbox for a confirmation link.
          </span>
        </p>
        {resent ? (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700"
          >
            <CheckCircle2 className="h-4 w-4" />
            Sent
          </motion.span>
        ) : (
          <button
            onClick={handleResend}
            disabled={resending}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors duration-200 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {resending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
            Resend link
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
