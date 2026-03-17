"use client";

import { useState, useEffect } from "react";
import { Loader2, UserPlus, Users } from "lucide-react";
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
  expires_at?: string;
  is_you: boolean;
  is_invite?: boolean;
};

export function TeamTab() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);

  const loadTeam = async () => {
    try {
      const res = await fetch("/api/settings/team");
      const json = await res.json();
      if (json.ok && json.members) {
        setMembers(json.members);
        setError(null);
      } else {
        setError("Failed to load team members.");
      }
    } catch {
      setError("Network error loading team.");
    }
    setLoading(false);
  };

  useEffect(() => {
    let active = true;
    const init = async () => {
      try {
        const res = await fetch("/api/settings/team");
        const json = await res.json();
        if (!active) return;
        if (json.ok && json.members) {
          setMembers(json.members);
          setError(null);
        } else {
          setError("Failed to load team members.");
        }
      } catch {
        if (!active) return;
        setError("Network error loading team.");
      }
      setLoading(false);
    };
    void init();
    return () => {
      active = false;
    };
  }, []);

  const handleRoleChange = async (memberId: string, newRole: string) => {
    const res = await fetch(`/api/settings/team/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    const json = await res.json();
    if (json.ok) await loadTeam();
    return json;
  };

  const handleRemove = async (memberId: string) => {
    const res = await fetch(`/api/settings/team/${memberId}`, {
      method: "DELETE",
    });
    const json = await res.json();
    if (json.ok) await loadTeam();
    return json;
  };

  const handleInvited = () => {
    setShowInvite(false);
    loadTeam();
  };

  const activeMembers = members.filter((m) => m.invite_status === "active");
  const pendingMembers = members.filter((m) => m.invite_status === "pending");

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active members */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-slate-600" />
            <h3 className="text-xs font-medium uppercase tracking-wider text-slate-600">
              Team Members
            </h3>
          </div>
          <span className="text-xs text-slate-600">
            {activeMembers.length} member{activeMembers.length !== 1 ? "s" : ""}
          </span>
        </div>
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
      </div>

      {/* Pending invites */}
      {pendingMembers.length > 0 && (
        <div>
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-600">
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
        className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-blue-700"
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
