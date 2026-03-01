"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getSkeletonDescription, getSkeletonDisplayName, getSkeletonForPlatform } from "@/lib/portals/platformToSkeleton";
import { ActivepiecesLogo, MakeLogo, N8nLogo, RetellLogo, VapiLogo } from "@/components/connections/platform-icons";
import { CheckCircle2, ChevronDown, Copy, ExternalLink } from "lucide-react";

type Source = { id: string; name: string; type: string; status: string; eventCount: number };

const SKELETONS = ["voice-performance", "workflow-operations", "roi-summary", "combined-overview"] as const;

function icon(type: string) {
  const props = { className: "h-5 w-5" };
  if (type === "vapi") return <VapiLogo {...props} />;
  if (type === "retell") return <RetellLogo {...props} />;
  if (type === "n8n") return <N8nLogo {...props} />;
  if (type === "make") return <MakeLogo {...props} />;
  return <ActivepiecesLogo {...props} />;
}

export default function CreatePortalPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<"source" | "configure" | "success">("source");
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedSource, setSelectedSource] = useState<Source | null>(null);
  const [portalName, setPortalName] = useState("");
  const [clientId, setClientId] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [skeletonId, setSkeletonId] = useState<string>("workflow-operations");
  const [expiry, setExpiry] = useState("never");

  const [createdToken, setCreatedToken] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        setError("Please log in.");
        setLoading(false);
        return;
      }

      const { data: membership } = await supabase.from("memberships").select("tenant_id").eq("user_id", authData.user.id).single();
      if (!membership) {
        setError("No tenant membership found.");
        setLoading(false);
        return;
      }
      const { data: activeSources } = await supabase
        .from("sources")
        .select("id, name, type, status")
        .eq("tenant_id", membership.tenant_id)
        .eq("status", "active");

      const { data: events } = await supabase.from("events").select("source_id").eq("tenant_id", membership.tenant_id);
      const counts = new Map<string, number>();
      (events ?? []).forEach((e: { source_id: string }) => counts.set(e.source_id, (counts.get(e.source_id) ?? 0) + 1));

      setSources(
        (activeSources ?? []).map((s: { id: string; name: string; type: string; status: string }) => ({
          ...s,
          eventCount: counts.get(s.id) ?? 0,
        }))
      );
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectSource(source: Source) {
    setSelectedSource(source);
    setSkeletonId(getSkeletonForPlatform(source.type));
    if (!portalName) setPortalName(`${source.name} Portal`);
    setStep("configure");
  }

  function expiresAtFromOption(option: string): string | null {
    if (option === "never") return null;
    const now = new Date();
    const days = option === "30" ? 30 : option === "90" ? 90 : 365;
    now.setDate(now.getDate() + days);
    return now.toISOString();
  }

  async function createPortal() {
    if (!selectedSource) return;
    if (portalName.trim().length < 3) {
      setError("Portal name must be at least 3 characters.");
      return;
    }

    setLoading(true);
    setError(null);

    const response = await fetch("/api/portals/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: portalName.trim(),
        sourceId: selectedSource.id,
        clientId: clientId.trim() || null,
        skeletonId,
        expiresAt: expiresAtFromOption(expiry),
      }),
    });

    const json = await response.json();
    if (!response.ok) {
      setError(json.error ?? "Failed to create portal.");
      setLoading(false);
      return;
    }

    setCreatedToken(json.portal.token);
    setStep("success");
    setLoading(false);
  }

  const url = createdToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/client/${createdToken}`
    : "";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 p-4 md:p-8">
      <div className="mx-auto flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-gray-200 px-6 py-4">
          <h1 className="text-lg font-semibold text-gray-900">Create Portal</h1>
          <p className="mt-1 text-sm text-gray-600">Step {step === "source" ? "1" : step === "configure" ? "2" : "3"} of 3</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error ? <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

          {step === "source" && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Which source should this portal display?</h2>
              {loading ? <p className="text-sm text-gray-500">Loading sources...</p> : null}
              {sources.length === 0 && !loading ? (
                <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                  <p className="text-sm text-gray-700">No sources connected yet.</p>
                  <Link href="/control-panel/connections" className="mt-3 inline-flex text-sm font-medium text-blue-600 hover:underline">Connect one now →</Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {sources.map((source) => (
                    <div key={source.id} className="flex items-center justify-between rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center gap-3">
                        {icon(source.type)}
                        <div>
                          <p className="font-medium text-gray-900">{source.type.toUpperCase()} — {source.name}</p>
                          <p className="text-sm text-gray-500">{source.eventCount.toLocaleString()} events synced</p>
                        </div>
                      </div>
                      <button onClick={() => selectSource(source)} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700">Select</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === "configure" && selectedSource && (
            <div className="space-y-5">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Portal Name</label>
                <input value={portalName} onChange={(e) => setPortalName(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Client (optional)</label>
                <input value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" placeholder="acme@dental.com" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Dashboard Type</label>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">{getSkeletonDisplayName(getSkeletonForPlatform(selectedSource.type))}</div>
              </div>

              <button onClick={() => setShowAdvanced((v) => !v)} className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                Advanced <ChevronDown className="h-4 w-4" />
              </button>

              {showAdvanced ? (
                <div className="space-y-4 rounded-xl border border-gray-200 p-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Skeleton Override</label>
                    <select className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={skeletonId} onChange={(e) => setSkeletonId(e.target.value)}>
                      {SKELETONS.map((skel) => <option value={skel} key={skel}>{skel}</option>)}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">{getSkeletonDescription(skeletonId)}</p>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Expires</label>
                    <select className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={expiry} onChange={(e) => setExpiry(e.target.value)}>
                      <option value="never">Never</option>
                      <option value="30">30 days</option>
                      <option value="90">90 days</option>
                      <option value="365">1 year</option>
                    </select>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {step === "success" && createdToken && selectedSource ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-700"><CheckCircle2 className="h-5 w-5" /><h2 className="text-xl font-semibold">Portal Created!</h2></div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="break-all text-sm text-gray-800">{url}</p>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => navigator.clipboard.writeText(url)} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"><Copy className="h-4 w-4" />Copy Link</button>
                  <a href={`/client/${createdToken}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700"><ExternalLink className="h-4 w-4" />Open Portal</a>
                </div>
              </div>
              <p className="text-sm text-gray-600">Dashboard will show live data from: {selectedSource.name} ({selectedSource.type.toUpperCase()}).</p>
              <div className="flex gap-3">
                <button onClick={() => router.push("/control-panel/portals")} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">← Back to Portals</button>
                <button onClick={() => window.location.reload()} className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white">Create Another</button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
          <button onClick={() => router.push("/control-panel/portals")} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
          <div className="flex gap-2">
            {step === "configure" ? <button onClick={() => setStep("source")} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">Back</button> : null}
            {step === "configure" ? <button onClick={() => void createPortal()} disabled={loading} className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-60">{loading ? "Creating..." : "Create Portal"}</button> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
