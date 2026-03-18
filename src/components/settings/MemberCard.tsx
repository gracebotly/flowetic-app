"use client";

import { useState } from "react";
import { Trash2, Loader2, Clock, Shield, User, Eye } from "lucide-react";

type TeamMember = {
  id: string;
  user_id: string;
  email: string;
  name: string | null;
  role: string;
  invite_status: string;
  created_at: string;
  expires_at?: string;
  is_you: boolean;
  is_invite?: boolean;
};

const VALID_ROLES = ["admin", "client", "viewer"] as const;

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  client: "Client",
  viewer: "Viewer",
};

const ROLE_ICONS: Record<string, typeof Shield> = {
  admin: Shield,
  client: User,
  viewer: Eye,
};

interface MemberCardProps {
  member: TeamMember;
  onRoleChange: (
    memberId: string,
    newRole: string
  ) => Promise<{ ok: boolean; code?: string }>;
  onRemove: (
    memberId: string
  ) => Promise<{ ok: boolean; code?: string }>;
  isPending?: boolean;
}

export function MemberCard({
  member,
  onRoleChange,
  onRemove,
  isPending,
}: MemberCardProps) {
  const [changingRole, setChangingRole] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRoleChange = async (newRole: string) => {
    if (newRole === member.role) return;
    setChangingRole(true);
    setError(null);
    const result = await onRoleChange(member.id, newRole);
    if (!result.ok) {
      setError(
        result.code === "CANNOT_CHANGE_OWN_ROLE"
          ? "You cannot change your own role."
          : result.code || "Failed to update role."
      );
    }
    setChangingRole(false);
  };

  const handleRemove = async () => {
    const confirmMsg = isPending
      ? `Revoke invite for ${member.email}?`
      : `Remove ${member.email} from this workspace?`;
    if (!confirm(confirmMsg)) return;
    setRemoving(true);
    setError(null);
    const result = await onRemove(member.id);
    if (!result.ok) {
      setError(
        result.code === "LAST_ADMIN"
          ? "Cannot remove the only admin."
          : result.code || "Failed to remove member."
      );
      setRemoving(false);
    }
  };

  const joinedDate = new Date(member.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  // Expiry for pending invites
  const expiresLabel = member.expires_at
    ? (() => {
        const days = Math.ceil(
          (new Date(member.expires_at).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        );
        if (days <= 0) return "Expired";
        if (days === 1) return "Expires tomorrow";
        return `Expires in ${days} days`;
      })()
    : null;

  const RoleIcon = ROLE_ICONS[member.role] || User;

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-5 py-4">
      <div className="flex items-center justify-between gap-4">
        {/* Left: avatar + email + meta */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {/* Avatar */}
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
              isPending
                ? "bg-amber-50"
                : member.is_you
                  ? "bg-blue-50"
                  : "bg-gray-100"
            }`}
          >
            {isPending ? (
              <Clock className="h-4 w-4 text-amber-600" />
            ) : (
              <RoleIcon
                className={`h-4 w-4 ${
                  member.is_you ? "text-blue-600" : "text-slate-600"
                }`}
              />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-medium text-slate-900">
                {member.name || member.email}
              </p>
              {member.is_you && (
                <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
                  You
                </span>
              )}
              {isPending && (
                <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                  Pending
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-600">
              {member.name ? member.email : ""}
              {member.name ? " · " : ""}
              {ROLE_LABELS[member.role] || member.role}
              {" · "}
              {isPending ? `Invited ${joinedDate}` : `Joined ${joinedDate}`}
              {isPending && expiresLabel && (
                <span
                  className={`ml-1 ${
                    expiresLabel === "Expired"
                      ? "text-red-600"
                      : "text-slate-600"
                  }`}
                >
                  · {expiresLabel}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          {/* Role dropdown — not shown for yourself or pending */}
          {!member.is_you && !isPending && (
            <select
              value={member.role}
              onChange={(e) => handleRoleChange(e.target.value)}
              disabled={changingRole}
              className="cursor-pointer rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 shadow-sm transition-colors duration-200 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              {VALID_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          )}

          {/* Remove/Revoke button — not shown for yourself */}
          {!member.is_you && (
            <button
              onClick={handleRemove}
              disabled={removing}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-sm text-red-600 transition-colors duration-200 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {removing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              {isPending ? "Revoke" : "Remove"}
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
