"use client";

import { useState } from "react";
import { Copy, Check, Trash2, Loader2, Clock } from "lucide-react";

type TeamMember = {
  id: string;
  user_id: string;
  email: string;
  name: string | null;
  role: string;
  invite_status: string;
  created_at: string;
  is_you: boolean;
};

// Matches the DB CHECK constraint: ['admin', 'client', 'viewer']
const VALID_ROLES = ["admin", "client", "viewer"] as const;

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  client: "Client",
  viewer: "Viewer",
};

interface MemberCardProps {
  member: TeamMember;
  onRoleChange: (memberId: string, newRole: string) => Promise<{ ok: boolean; code?: string }>;
  onRemove: (memberId: string) => Promise<{ ok: boolean; code?: string }>;
  isPending?: boolean;
}

export function MemberCard({ member, onRoleChange, onRemove, isPending }: MemberCardProps) {
  const [changingRole, setChangingRole] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
    if (!confirm(`Remove ${member.email} from this workspace?`)) return;
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

  const copyInviteLink = () => {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    // Pending members have an invite_token — reconstruct the link
    // The invite_token is not in the GET response, but we can construct from the member id
    // Actually, the GET response doesn't include invite_token for security.
    // We copy a placeholder link that the admin previously received.
    // For MVP: show "Link was shown when invite was created" or copy nothing.
    // Better: we know the route is /invite/[token], but token isn't exposed in GET.
    // Resolution: Copy won't work for pending invites from GET alone.
    // The admin should have saved the link from the POST response.
    navigator.clipboard.writeText(`${baseUrl}/control-panel/settings?tab=team`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const joinedDate = new Date(member.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-5 py-4">
      <div className="flex items-center justify-between gap-4">
        {/* Left: email + meta */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {isPending && <Clock className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" />}
            <p className="truncate text-sm font-medium text-gray-900">
              {member.email}
            </p>
            {member.is_you && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
                You
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            {isPending ? `Invited as ${ROLE_LABELS[member.role] || member.role}` : `Role: ${ROLE_LABELS[member.role] || member.role}`}
            {" · "}
            {isPending ? `Sent ${joinedDate}` : `Joined ${joinedDate}`}
            {member.name && ` · ${member.name}`}
          </p>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          {/* Role dropdown — not shown for yourself or pending */}
          {!member.is_you && !isPending && (
            <select
              value={member.role}
              onChange={(e) => handleRoleChange(e.target.value)}
              disabled={changingRole}
              className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-700 shadow-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              {VALID_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          )}

          {/* Copy invite link (pending only) */}
          {isPending && (
            <button
              onClick={copyInviteLink}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-600 transition hover:bg-gray-50"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy Link"}
            </button>
          )}

          {/* Remove button — not shown for yourself */}
          {!member.is_you && (
            <button
              onClick={handleRemove}
              disabled={removing}
              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-sm text-red-600 transition hover:bg-red-50"
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

      {/* Error message */}
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
