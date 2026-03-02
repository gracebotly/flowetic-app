"use client";

import { ShieldAlert } from "lucide-react";

interface RoleGateProps {
  allowed: boolean;
  children: React.ReactNode;
  /** Optional: override the default denied message */
  message?: string;
}

/**
 * Wraps a settings section. If `allowed` is false, renders a
 * read-only overlay message instead of children.
 */
export function RoleGate({ allowed, children, message }: RoleGateProps) {
  if (allowed) return <>{children}</>;

  return (
    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
      <ShieldAlert className="mx-auto h-8 w-8 text-gray-300" />
      <p className="mt-3 text-sm font-medium text-gray-500">
        {message ?? "Contact your admin to change these settings."}
      </p>
    </div>
  );
}
