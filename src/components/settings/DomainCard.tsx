"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Globe,
  Loader2,
  ArrowRight,
  ExternalLink,
  Copy,
  RefreshCw,
  Check,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────

type DomainStatus = {
  domain: string | null;
  verified: boolean;
  verification_data: unknown;
  added_at: string | null;
  verified_at: string | null;
  plan_allows_domain: boolean;
  plan_reason: string | null;
};

type AddDomainResponse = {
  ok: boolean;
  domain?: string;
  verified?: boolean;
  dns_instructions?: { type: string; name: string; value: string };
  code?: string;
  error?: string;
};

// ── Component ────────────────────────────────────────────────

export function DomainCard() {
  const [status, setStatus] = useState<DomainStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add domain state
  const [domainInput, setDomainInput] = useState("");
  const [adding, setAdding] = useState(false);

  // Verify polling state
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Remove state
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  // DNS instructions (returned by POST, shown in pending state)
  const [dnsInstructions, setDnsInstructions] = useState<{
    type: string;
    name: string;
    value: string;
  } | null>(null);

  // ── Fetch current status ───────────────────────────────────

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/domains");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      if (data.ok) {
        setStatus(data as DomainStatus);
      }
    } catch {
      setError("Unable to load domain status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  // ── Auto-poll when pending ─────────────────────────────────

  useEffect(() => {
    if (status?.domain && !status.verified) {
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch("/api/settings/domains/verify");
          if (!res.ok) return;
          const data = await res.json();
          if (data.ok && data.verified) {
            // Domain just got verified — refresh full status
            void fetchStatus();
          }
        } catch {
          // Silent — polling failures are expected during DNS propagation
        }
      }, 30_000);

      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }
  }, [status?.domain, status?.verified, fetchStatus]);

  // ── Add domain ─────────────────────────────────────────────

  const handleAddDomain = async () => {
    const domain = domainInput.trim().toLowerCase();
    if (!domain) return;

    setAdding(true);
    setError(null);

    try {
      const res = await fetch("/api/settings/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      const data: AddDomainResponse = await res.json();

      if (data.ok) {
        if (data.dns_instructions) {
          setDnsInstructions(data.dns_instructions);
        }
        setDomainInput("");
        void fetchStatus();
      } else {
        setError(data.error || data.code || "Failed to add domain");
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setAdding(false);
    }
  };

  // ── Check verification (manual) ────────────────────────────

  const handleCheckNow = async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/settings/domains/verify");
      if (!res.ok) return;
      const data = await res.json();
      if (data.ok && data.verified) {
        void fetchStatus();
      }
    } catch {
      // Silent
    } finally {
      setChecking(false);
    }
  };

  // ── Copy DNS record ────────────────────────────────────────

  const handleCopy = () => {
    if (!dnsInstructions && !status?.domain) return;
    const name = dnsInstructions?.name || status?.domain?.split(".")[0] || "";
    const text = `Type: CNAME
Name: ${name}
Value: cname.vercel-dns.com`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Remove domain ──────────────────────────────────────────

  const handleRemove = async () => {
    setRemoving(true);
    setError(null);

    try {
      const res = await fetch("/api/settings/domains", { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        setDnsInstructions(null);
        setConfirmRemove(false);
        void fetchStatus();
      } else {
        setError(data.error || "Failed to remove domain");
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setRemoving(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  // ── State 1: Free trial — upgrade nudge ────────────────────

  if (status && !status.plan_allows_domain) {
    return (
      <div className="rounded-lg border border-gray-200 border-l-[3px] border-l-slate-300 bg-white p-5">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
          <Globe className="h-4 w-4" />
          Custom domain
          <span className="ml-1 inline-flex items-center gap-1.5 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            {status.plan_reason === "TRIAL_ACTIVE"
              ? "Paid plans only"
              : "Upgrade required"}
          </span>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
          Connect your own domain so clients see your brand in every URL.
          Available on all paid plans.
        </p>
        <a
          href="/control-panel/settings?tab=billing"
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-gray-700"
        >
          <ArrowRight className="h-3.5 w-3.5" />
          Subscribe to unlock
        </a>
      </div>
    );
  }

  // ── State 4: Connected and verified ────────────────────────

  if (status?.domain && status.verified) {
    const connectedDate = status.verified_at
      ? new Date(status.verified_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : null;

    return (
      <div className="rounded-lg border border-gray-200 border-l-[3px] border-l-emerald-500 bg-white p-5">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
          <Globe className="h-4 w-4" />
          Custom domain
          <span className="ml-1 inline-flex items-center gap-1.5 rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Connected
          </span>
        </div>
        <p className="mt-1.5 text-[13px] font-medium text-slate-900">
          {status.domain}
        </p>

        <div className="mt-2 flex gap-6">
          <div>
            <p className="text-[11px] text-slate-500">SSL</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-slate-900">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Active
            </p>
          </div>
          {connectedDate && (
            <div>
              <p className="text-[11px] text-slate-500">Connected</p>
              <p className="mt-0.5 text-xs font-medium text-slate-900">
                {connectedDate}
              </p>
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center gap-3">
          <a
            href={`https://${status.domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 transition-colors duration-200 hover:bg-slate-50"
          >
            Test domain
            <ExternalLink className="h-3 w-3" />
          </a>
          {confirmRemove ? (
            <span className="flex items-center gap-2 text-xs">
              <button
                onClick={handleRemove}
                disabled={removing}
                className="font-medium text-red-600 transition-colors duration-200 hover:text-red-800"
              >
                {removing ? "Removing..." : "Confirm remove"}
              </button>
              <button
                onClick={() => setConfirmRemove(false)}
                className="text-slate-500 transition-colors duration-200 hover:text-slate-700"
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              onClick={() => setConfirmRemove(true)}
              className="text-xs text-red-500 transition-colors duration-200 hover:text-red-700"
            >
              Remove
            </button>
          )}
        </div>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  // ── State 3: Pending DNS verification ──────────────────────

  if (status?.domain && !status.verified) {
    const name =
      dnsInstructions?.name || status.domain.split(".")[0] || "portal";

    return (
      <div className="rounded-lg border border-gray-200 border-l-[3px] border-l-blue-500 bg-white p-5">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
          <Globe className="h-4 w-4" />
          Custom domain
          <span className="ml-1 inline-flex items-center gap-1.5 rounded bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            Waiting for DNS
          </span>
        </div>
        <p className="mt-1.5 text-[13px] font-medium text-slate-900">
          {status.domain}
        </p>

        {/* DNS Instructions */}
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="mb-2 text-xs text-slate-600">
            Add this record at your domain provider:
          </p>
          <div className="grid grid-cols-[80px_80px_1fr] gap-x-4 gap-y-1 text-xs">
            <span className="text-slate-400">Type</span>
            <span className="text-slate-400">Name</span>
            <span className="text-slate-400">Value</span>
            <span className="font-mono font-medium text-slate-700">CNAME</span>
            <span className="font-mono font-medium text-slate-700">{name}</span>
            <span className="font-mono font-medium text-slate-700">
              cname.vercel-dns.com
            </span>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors duration-200 hover:bg-slate-50"
          >
            {copied ? (
              <Check className="h-3 w-3 text-emerald-600" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            {copied ? "Copied!" : "Copy record"}
          </button>
          <button
            onClick={handleCheckNow}
            disabled={checking}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors duration-200 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3 w-3 ${checking ? "animate-spin" : ""}`}
            />
            {checking ? "Checking..." : "Check now"}
          </button>
          <span className="text-[11px] text-slate-400">
            Auto-checking every 30s
          </span>
          {confirmRemove ? (
            <span className="ml-auto flex items-center gap-2 text-xs">
              <button
                onClick={handleRemove}
                disabled={removing}
                className="font-medium text-red-600 transition-colors duration-200 hover:text-red-800"
              >
                {removing ? "Removing..." : "Confirm"}
              </button>
              <button
                onClick={() => setConfirmRemove(false)}
                className="text-slate-500 transition-colors duration-200 hover:text-slate-700"
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              onClick={() => setConfirmRemove(true)}
              className="ml-auto text-xs text-red-500 transition-colors duration-200 hover:text-red-700"
            >
              Remove
            </button>
          )}
        </div>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  // ── State 2: Not configured — domain input ─────────────────

  return (
    <div className="rounded-lg border border-gray-200 border-l-[3px] border-l-slate-300 bg-white p-5">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
        <Globe className="h-4 w-4" />
        Custom domain
        <span className="ml-1 inline-flex items-center gap-1.5 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
          Not configured
        </span>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
        Your portals currently use{" "}
        <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600">
          app.getflowetic.com
        </code>
      </p>

      <div className="mt-3 flex items-center gap-2">
        <input
          type="text"
          value={domainInput}
          onChange={(e) => {
            setDomainInput(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleAddDomain();
          }}
          placeholder="portal.youragency.com"
          className="w-full max-w-xs rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
        <button
          onClick={handleAddDomain}
          disabled={adding || !domainInput.trim()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {adding ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ArrowRight className="h-3.5 w-3.5" />
          )}
          {adding ? "Connecting..." : "Connect domain"}
        </button>
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
        Your clients will see your domain in all portal and product URLs.
      </p>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
