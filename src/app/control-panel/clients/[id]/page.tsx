"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  LayoutDashboard,
  Link2,
  Clock,
  Building2,
} from "lucide-react";
import { HealthBar } from "@/components/clients/HealthBar";
import { TagBadge } from "@/components/clients/TagBadge";
import { OverviewTab } from "@/components/clients/OverviewTab";
import { OfferingsTab } from "@/components/clients/OfferingsTab";
import { AccessTab } from "@/components/clients/AccessTab";
import { ActivityTab } from "@/components/clients/ActivityTab";

type Client = {
  id: string;
  name: string;
  company: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  tags: string[];
  status: "active" | "paused";
  health_score: number | null;
  last_seen_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

type AssignedOffering = {
  id: string;
  name: string;
  surface_type: string;
  access_type: string;
  platform_type: string | null;
  token: string | null;
  slug: string | null;
  status: string;
  last_viewed_at: string | null;
};

type TabKey = "overview" | "offerings" | "access" | "activity";

const TABS: { key: TabKey; label: string; icon: typeof User }[] = [
  { key: "overview", label: "Overview", icon: User },
  { key: "offerings", label: "Offerings", icon: LayoutDashboard },
  { key: "access", label: "Access", icon: Link2 },
  { key: "activity", label: "Activity", icon: Clock },
];

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [client, setClient] = useState<Client | null>(null);
  const [assignedOfferings, setAssignedOfferings] = useState<AssignedOffering[]>([]);
  const [totalOfferings, setTotalOfferings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const loadClient = useCallback(async () => {
    const res = await fetch(`/api/clients/${id}`);
    const json = await res.json();
    if (json.ok) {
      setClient(json.client);
      setAssignedOfferings(json.assigned_offerings ?? []);
      setTotalOfferings(json.total_offerings ?? 0);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadClient();
  }, [loadClient]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-8">
        <p className="text-gray-500">Client not found.</p>
        <Link href="/control-panel/clients" className="mt-2 text-sm text-blue-600 hover:text-blue-700">
          ← Back to Clients
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <Link
        href="/control-panel/clients"
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Clients
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            {client.company && (
              <span className="inline-flex items-center gap-1 text-sm text-gray-500">
                <Building2 className="h-3.5 w-3.5" />
                {client.company}
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                client.status === "active"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  client.status === "active" ? "bg-emerald-500" : "bg-gray-400"
                }`}
              />
              {client.status.charAt(0).toUpperCase() + client.status.slice(1)}
            </span>
          </div>
          {client.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {client.tags.map((tag) => (
                <TagBadge key={tag} tag={tag} />
              ))}
            </div>
          )}
        </div>

        <div className="w-40">
          <div className="text-xs font-medium uppercase tracking-wider text-gray-400">Health Score</div>
          <div className="mt-1">
            <HealthBar score={client.health_score ?? 0} />
          </div>
        </div>
      </div>

      <div className="mt-6 border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-1.5 border-b-2 px-1 py-3 text-sm font-medium transition ${
                  isActive
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="mt-6">
        {activeTab === "overview" && (
          <OverviewTab
            client={client}
            assignedOfferingsCount={assignedOfferings.length}
            totalOfferings={totalOfferings}
            onUpdated={loadClient}
          />
        )}
        {activeTab === "offerings" && (
          <OfferingsTab
            clientId={client.id}
            assignedOfferings={assignedOfferings}
            onChanged={loadClient}
          />
        )}
        {activeTab === "access" && <AccessTab assignedOfferings={assignedOfferings} />}
        {activeTab === "activity" && <ActivityTab clientId={client.id} />}
      </div>
    </div>
  );
}
