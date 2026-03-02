"use client";

import { useState, useEffect } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { MemberCard } from "@/components/settings/MemberCard";
import { InviteModal } from "@/components/settings/InviteModal";

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

export function TeamTab() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);

  // ── Load team ─────────────────────────────────────────────
  const loadTeam = async () => {
    const res = await fetch("/api/settings/team");
    const json = await res.json();
    if (json.ok && json.members) {
      setMembers(json.members);
      setError(null);
    } else {
      setError("Failed to load team members.");
    }
    setLoading(false);
  };

  useEffect(() => {
    let active = true;

    const init = async () => {
      const res = await fetch("/api/settings/team");
      const json = await res.json();
      if (!active) return;

      if (json.ok && json.members) {
        setMembers(json.members);
        setError(null);
      } else {
        setError("Failed to load team members.");
      }
      setLoading(false);
    };

    void init();

    return () => {
      active = false;
    };
  }, []);

  // ── Role change ───────────────────────────────────────────
  const handleRoleChange = async (memberId: string, newRole: string) => {
    const res = await fetch(`/api/settings/team/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    const json = await res.json();
    if (json.ok) {
      // Reload to get fresh data
      await loadTeam();
    }
    return json;
  };

  // ── Remove member ─────────────────────────────────────────
  const handleRemove = async (memberId: string) => {
    const res = await fetch(`/api/settings/team/${memberId}`, {
      method: "DELETE",
    });
    const json = await res.json();
    if (json.ok) {
      await loadTeam();
    }
    return json;
  };

  // ── After invite ──────────────────────────────────────────
  const handleInvited = () => {
    setShowInvite(false);
    loadTeam();
  };

  // Split into active and pending
  const activeMembers = members.filter((m) => m.invite_status === "active");
  const pendingMembers = members.filter((m) => m.invite_status === "pending");

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-600">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active members */}
      <div className="space-y-3">
        {activeMembers.map((member) => (
          <MemberCard
            key={member.id}
            member={member}
            onRoleChange={handleRoleChange}
            onRemove={handleRemove}
          />
        ))}
      </div>

      {/* Pending invites */}
      {pendingMembers.length > 0 && (
        <div>
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-400">
            Pending Invites
          </h3>
          <div className="space-y-3">
            {pendingMembers.map((member) => (
              <MemberCard
                key={member.id}
                member={member}
                onRoleChange={handleRoleChange}
                onRemove={handleRemove}
                isPending
              />
            ))}
          </div>
        </div>
      )}

      {/* Invite button */}
      <button
        onClick={() => setShowInvite(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
      >
        <UserPlus className="h-4 w-4" />
        Invite Team Member
      </button>

      {/* Invite modal */}
      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onInvited={handleInvited}
        />
      )}
    </div>
  );
}
