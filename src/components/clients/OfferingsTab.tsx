"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Globe, Copy, Check } from "lucide-react";
import { SurfaceBadge } from "@/components/offerings/SurfaceBadge";
import { AccessBadge } from "@/components/offerings/AccessBadge";

interface AssignedOffering {
  id: string;
  name: string;
  surface_type: string;
  access_type: string;
  platform_type: string | null;
  token: string | null;
  slug: string | null;
  status: string;
  last_viewed_at: string | null;
}

interface UnassignedOffering {
  id: string;
  name: string;
  surface_type: string;
  access_type: string;
  platform_type: string | null;
  status: string;
}

interface OfferingsTabProps {
  clientId: string;
  assignedOfferings: AssignedOffering[];
  onChanged: () => void;
}

function formatRelative(iso: string | null): string {
  if (!iso) return "Never viewed";
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function OfferingsTab({ clientId, assignedOfferings, onChanged }: OfferingsTabProps) {
  const [unassigned, setUnassigned] = useState<UnassignedOffering[]>([]);
  const [loadingUnassigned, setLoadingUnassigned] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [hubUrl, setHubUrl] = useState<string | null>(null);
  const [loadingHub, setLoadingHub] = useState(false);
  const [copiedHub, setCopiedHub] = useState(false);

  useEffect(() => {
    const fetchUnassigned = async () => {
      setLoadingUnassigned(true);
      const res = await fetch("/api/client-portals");
      if (res.ok) {
        const data = await res.json();
        const all = data.offerings ?? [];
        const assignedIds = new Set(assignedOfferings.map((o) => o.id));
        setUnassigned(
          all.filter(
            (o: { id: string; status: string; client_id: string | null }) =>
              !assignedIds.has(o.id) && o.status !== "archived" && (!o.client_id || o.client_id === null),
          ),
        );
      }
      setLoadingUnassigned(false);
    };
    void fetchUnassigned();
  }, [assignedOfferings]);

  const handleAssign = async (offeringId: string) => {
    setActionLoading(offeringId);
    await fetch(`/api/client-portals/${offeringId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId }),
    });
    setActionLoading(null);
    onChanged();
  };

  const handleUnassign = async (offeringId: string) => {
    setActionLoading(offeringId);
    await fetch(`/api/client-portals/${offeringId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: null }),
    });
    setActionLoading(null);
    onChanged();
  };

  const handleGetHubLink = async () => {
    setLoadingHub(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/hub-token`, {
        method: "POST",
      });
      if (res.ok) {
        const json = await res.json();
        setHubUrl(`${window.location.origin}/client/hub/${json.hubToken}`);
      }
    } finally {
      setLoadingHub(false);
    }
  };

  const handleCopyHub = async () => {
    if (!hubUrl) return;
    await navigator.clipboard.writeText(hubUrl);
    setCopiedHub(true);
    setTimeout(() => setCopiedHub(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-1 flex items-center gap-2">
          <Globe className="h-4 w-4 text-blue-600" />
          <p className="text-sm font-semibold text-slate-900">Client Hub Link</p>
        </div>
        <p className="mb-3 text-xs text-slate-600">
          One URL for your client to access all their dashboards — no login needed.
        </p>

        <AnimatePresence mode="wait">
          {!hubUrl ? (
            <motion.button
              key="generate"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleGetHubLink}
              disabled={loadingHub}
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors duration-200 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Globe className="h-4 w-4" />
              {loadingHub ? "Generating..." : "Get Hub Link"}
            </motion.button>
          ) : (
            <motion.div
              key="url"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-1.5"
            >
              <code className="flex-1 truncate px-2 text-xs text-slate-600">
                {hubUrl}
              </code>
              <button
                onClick={handleCopyHub}
                className="flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-colors duration-200 hover:bg-gray-100"
              >
                {copiedHub ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-500" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy
                  </>
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900">Assigned Portals ({assignedOfferings.length})</h3>
        {assignedOfferings.length === 0 ? (
          <div className="mt-2 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
            No portals assigned to this client yet.
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            {assignedOfferings.map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
              >
                <div className="min-w-0">
                  <Link
                    href={`/control-panel/client-portals/${o.id}`}
                    className="text-sm font-semibold text-gray-900 hover:text-blue-600"
                  >
                    {o.name}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <SurfaceBadge surfaceType={o.surface_type} />
                    <AccessBadge accessType={o.access_type} />
                    {o.platform_type && (
                      <span className="text-xs capitalize text-gray-400">{o.platform_type}</span>
                    )}
                    <span className="text-xs text-gray-400">Last viewed: {formatRelative(o.last_viewed_at)}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleUnassign(o.id)}
                  disabled={actionLoading === o.id}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                >
                  {actionLoading === o.id ? (
                    <div className="h-3 w-3 animate-spin rounded-full border border-gray-400 border-t-transparent" />
                  ) : (
                    <X className="h-3 w-3" />
                  )}
                  Unassign
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900">
          Available to assign ({loadingUnassigned ? "..." : unassigned.length})
        </h3>
        {loadingUnassigned ? (
          <div className="mt-2 rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-400">
            Loading...
          </div>
        ) : unassigned.length === 0 ? (
          <div className="mt-2 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
            All portals are assigned or none exist.
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            {unassigned.map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
              >
                <div className="min-w-0">
                  <span className="text-sm font-semibold text-gray-900">{o.name}</span>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <SurfaceBadge surfaceType={o.surface_type} />
                    <AccessBadge accessType={o.access_type} />
                    {o.platform_type && (
                      <span className="text-xs capitalize text-gray-400">{o.platform_type}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleAssign(o.id)}
                  disabled={actionLoading === o.id}
                  className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
                >
                  {actionLoading === o.id ? (
                    <div className="h-3 w-3 animate-spin rounded-full border border-blue-400 border-t-transparent" />
                  ) : (
                    <Plus className="h-3 w-3" />
                  )}
                  Assign
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Link
        href={`/control-panel/client-portals/create?client_id=${clientId}`}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-blue-700"
      >
        <Plus className="h-4 w-4" />
        Create Portal for This Client
      </Link>
    </div>
  );
}
