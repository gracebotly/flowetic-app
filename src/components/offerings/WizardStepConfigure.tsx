"use client";

import { useState, useEffect, useCallback } from "react";
import { Link2, CreditCard, UserPlus, ChevronDown, Search, Loader2, ExternalLink, CheckCircle2 } from "lucide-react";
import { OfferingCard } from "./OfferingCard";

type AccessType = "magic_link" | "stripe_gate";
type PricingType = "free" | "per_run" | "monthly" | "usage_based";

type ClientOption = {
  id: string;
  name: string;
  company: string | null;
};

type Props = {
  // Name/Description
  name: string;
  description: string;
  onChange: (field: "name" | "description" | "clientId" | "slug", value: string) => void;
  // Client
  clientId: string;
  prefilledClientId: string;
  // Access + Pricing
  accessType: AccessType;
  pricingType: PricingType;
  priceCents: number;
  slug: string;
  onAccessChange: (accessType: AccessType) => void;
  onPricingChange: (pricingType: PricingType, priceCents: number) => void;
  // Stripe status (fetched by parent)
  stripeConnected: boolean;
  onStripeConnected?: () => void;
  // Context badges
  platform: string | null;
  surfaceType: string;
  // Error
  submitError: string | null;
};

const ACCESS_OPTIONS: Array<{
  value: AccessType;
  title: string;
  description: string;
  icon: typeof Link2;
  color: string;
}> = [
  {
    value: "magic_link",
    title: "Free Link",
    description:
      "Generate a unique link — anyone with the link can access. No login, no payment. Best for client retention and proving ROI.",
    icon: Link2,
    color: "sky",
  },
  {
    value: "stripe_gate",
    title: "Paid Access",
    description:
      "Client pays before they can access. Supports per-run, monthly, and usage-based pricing. Revenue goes to your Stripe account.",
    icon: CreditCard,
    color: "amber",
  },
];

const PRICING_MODELS: Array<{ value: PricingType; label: string; hint: string }> = [
  { value: "free", label: "Free", hint: "No charge — for demos or included clients" },
  { value: "per_run", label: "Per Run", hint: "Charge each time the workflow executes" },
  { value: "monthly", label: "Monthly", hint: "Flat monthly subscription fee" },
  { value: "usage_based", label: "Usage Based", hint: "Variable pricing by usage" },
];

const SURFACE_LABELS: Record<string, string> = {
  analytics: "Analytics Dashboard",
  runner: "SaaS Product",
  both: "Dashboard + Product",
};

export function WizardStepConfigure({
  name,
  description,
  onChange,
  clientId,
  prefilledClientId,
  accessType,
  pricingType,
  priceCents,
  slug,
  onAccessChange,
  onPricingChange,
  stripeConnected,
  onStripeConnected,
  platform,
  surfaceType,
  submitError,
}: Props) {
  void prefilledClientId;

  // ── Stripe Connect in-wizard state ────────────────────────
  const [stripeConnecting, setStripeConnecting] = useState(false);
  const [stripeWaiting, setStripeWaiting] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [stripeJustConnected, setStripeJustConnected] = useState(false);

  // Open Stripe onboarding in a new tab
  const handleStripeConnect = useCallback(async () => {
    setStripeConnecting(true);
    setStripeError(null);
    try {
      const res = await fetch("/api/stripe/connect", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to start Stripe onboarding");
      }
      const { url } = await res.json();
      window.open(url, "_blank", "noopener,noreferrer");
      setStripeWaiting(true);
    } catch (err) {
      setStripeError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setStripeConnecting(false);
    }
  }, []);

  // Poll Stripe status (called on tab focus or manual click)
  const checkStripeStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/stripe/connect/status");
      if (!res.ok) return;
      const data = await res.json();
      if (data.charges_enabled) {
        setStripeWaiting(false);
        setStripeJustConnected(true);
        onStripeConnected?.();
        // Clear the success flash after 2 seconds
        setTimeout(() => setStripeJustConnected(false), 2000);
      }
    } catch {
      // silent — user can retry manually
    }
  }, [onStripeConnected]);

  // Auto-poll on tab visibility change (user returns from Stripe tab)
  useEffect(() => {
    if (!stripeWaiting) return;

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void checkStripeStatus();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [stripeWaiting, checkStripeStatus]);

  // ── Client picker state ─────────────────────────────────
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  void clientsLoading;
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
  const [creatingClient, setCreatingClient] = useState(false);
  const [priceDisplay, setPriceDisplay] = useState(
    priceCents > 0 ? (priceCents / 100).toFixed(2) : ""
  );

  // Load clients on mount
  useEffect(() => {
    async function loadClients() {
      try {
        const res = await fetch("/api/clients");
        const json = await res.json();
        if (json.ok && json.clients) {
          setClients(
            json.clients.map((c: { id: string; name: string; company: string | null }) => ({
              id: c.id,
              name: c.name,
              company: c.company,
            }))
          );
        }
      } catch {
        // Non-fatal
      } finally {
        setClientsLoading(false);
      }
    }
    loadClients();
  }, []);

  // Selected client display
  const selectedClient = clients.find((c) => c.id === clientId);
  const filteredClients = clientSearch.trim()
    ? clients.filter(
        (c) =>
          c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
          (c.company?.toLowerCase().includes(clientSearch.toLowerCase()) ?? false)
      )
    : clients;

  // Inline create client
  const handleCreateClient = useCallback(async () => {
    if (!newClientName.trim() || newClientName.trim().length < 2) return;
    setCreatingClient(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newClientName.trim(),
          contactEmail: newClientEmail.trim() || undefined,
          contactPhone: newClientPhone.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (json.ok && json.client) {
        const newOpt: ClientOption = {
          id: json.client.id,
          name: json.client.name,
          company: json.client.company,
        };
        setClients((prev) => [newOpt, ...prev]);
        onChange("clientId", json.client.id);
        setShowNewClientForm(false);
        setShowClientDropdown(false);
        setNewClientName("");
        setNewClientEmail("");
        setNewClientPhone("");
      }
    } catch {
      // Handle silently
    } finally {
      setCreatingClient(false);
    }
  }, [newClientName, newClientEmail, newClientPhone, onChange]);

  // Auto-generate slug from name — only if user hasn't manually edited slug
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  useEffect(() => {
    if (accessType === "stripe_gate" && name.trim() && !slugManuallyEdited) {
      const autoSlug = name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      onChange("slug", autoSlug);
    }
  }, [name, accessType, onChange, slugManuallyEdited]);

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900">
        Name, assign & price
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        Name it, assign to a client, and set access rules.
      </p>

      {/* Summary badges */}
      <div className="mt-5 flex flex-wrap gap-2">
        {platform && platform.split(", ").map((p) => (
          <span key={p} className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 capitalize">
            {p}
          </span>
        ))}
        <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
          {SURFACE_LABELS[surfaceType] ?? surfaceType}
        </span>
      </div>

      {/* ── Name Input ─────────────────────────────────── */}
      <div className="mt-6">
        <label className="block text-sm font-medium text-gray-700">
          Portal Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => onChange("name", e.target.value)}
          placeholder="e.g. Smith Dental — Voice Agent Dashboard"
          className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
          autoFocus
        />
        <p className="mt-1 text-xs text-gray-400">
          Min 3 characters. Your client will see this name.
        </p>
      </div>

      {/* ── Description ────────────────────────────────── */}
      <div className="mt-5">
        <label className="block text-sm font-medium text-gray-700">
          Description <span className="font-normal text-gray-400">(optional)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => onChange("description", e.target.value)}
          placeholder="Brief description of what this portal provides…"
          rows={2}
          className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
        />
      </div>

      {/* ── Client Picker ──────────────────────────────── */}
      <div className="mt-5">
        <label className="block text-sm font-medium text-gray-700">
          Assign to Client <span className="font-normal text-gray-400">(optional)</span>
        </label>

        {!showNewClientForm ? (
          <div className="relative mt-1.5">
            <button
              type="button"
              onClick={() => setShowClientDropdown(!showClientDropdown)}
              className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-left transition hover:border-gray-300 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              <span className={selectedClient ? "text-gray-900" : "text-gray-400"}>
                {selectedClient
                  ? `${selectedClient.name}${selectedClient.company ? ` — ${selectedClient.company}` : ""}`
                  : "Select a client…"}
              </span>
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </button>

            {showClientDropdown && (
              <div className="absolute z-10 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg">
                {/* Search */}
                <div className="border-b border-gray-100 p-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      placeholder="Search clients…"
                      className="w-full rounded-md border-0 bg-gray-50 py-2 pl-9 pr-3 text-sm outline-none focus:bg-white focus:ring-1 focus:ring-blue-200"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Client list */}
                <div className="max-h-48 overflow-y-auto py-1">
                  {/* Unassign option */}
                  <button
                    type="button"
                    onClick={() => {
                      onChange("clientId", "");
                      setShowClientDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-400 hover:bg-gray-50"
                  >
                    No client (unassigned)
                  </button>

                  {filteredClients.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        onChange("clientId", c.id);
                        setShowClientDropdown(false);
                        setClientSearch("");
                      }}
                      className={`w-full px-4 py-2 text-left text-sm transition hover:bg-gray-50 ${
                        c.id === clientId ? "bg-blue-50 text-blue-700" : "text-gray-900"
                      }`}
                    >
                      {c.name}
                      {c.company && (
                        <span className="ml-1 text-xs text-gray-400">— {c.company}</span>
                      )}
                    </button>
                  ))}

                  {filteredClients.length === 0 && (
                    <p className="px-4 py-3 text-sm text-gray-400">No clients found.</p>
                  )}
                </div>

                {/* New client button */}
                <div className="border-t border-gray-100 p-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowClientDropdown(false);
                      setShowNewClientForm(true);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-50"
                  >
                    <UserPlus className="h-4 w-4" />
                    Create New Client
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Inline new client form */
          <div className="mt-1.5 rounded-xl border border-blue-200 bg-blue-50/50 p-4">
            <h4 className="text-sm font-semibold text-gray-900">New Client</h4>
            <div className="mt-3 space-y-3">
              <input
                type="text"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                placeholder="Client name *"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                autoFocus
              />
              <input
                type="email"
                value={newClientEmail}
                onChange={(e) => setNewClientEmail(e.target.value)}
                placeholder="email@example.com"
                pattern="[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 invalid:border-red-300"
              />
              <input
                type="tel"
                value={newClientPhone}
                onChange={(e) => setNewClientPhone(formatPhone(e.target.value))}
                placeholder="(555) 000-0000"
                maxLength={14}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handleCreateClient}
                disabled={creatingClient || newClientName.trim().length < 2}
                className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-40"
              >
                {creatingClient ? "Creating…" : "Create & Assign"}
              </button>
              <button
                type="button"
                onClick={() => setShowNewClientForm(false)}
                className="rounded-lg border border-gray-200 bg-white px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Access Type (Free / Paid) — ALWAYS visible ──── */}
      <div className="mt-8">
        <h3 className="text-sm font-semibold text-slate-900">Access</h3>
        <p className="mt-1 text-xs text-slate-600">
          Free link or paid — you can change this later.
        </p>
        <div className="mt-3 grid gap-3">
          {ACCESS_OPTIONS.map((option) => (
            <OfferingCard
              key={option.value}
              title={option.title}
              description={option.description}
              icon={option.icon}
              color={option.color}
              selected={accessType === option.value}
              onClick={() => onAccessChange(option.value)}
            />
          ))}
        </div>

        {/* Stripe not connected + paid selected → inline connect prompt */}
        {accessType === "stripe_gate" && !stripeConnected && !stripeJustConnected && (
          <div className="mt-4 rounded-xl border border-gray-200 bg-white px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                <CreditCard className="h-4 w-4 text-slate-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900">
                  Connect Stripe to accept payments
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Paid access requires a connected Stripe account. Your clients
                  pay you directly — Getflowetic is invisible in the billing.
                </p>

                {stripeError && (
                  <p className="mt-2 text-xs text-red-600">{stripeError}</p>
                )}

                {!stripeWaiting ? (
                  <button
                    type="button"
                    onClick={handleStripeConnect}
                    disabled={stripeConnecting}
                    className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-slate-800 disabled:opacity-50"
                  >
                    {stripeConnecting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ExternalLink className="h-4 w-4" />
                    )}
                    {stripeConnecting ? "Opening Stripe…" : "Connect Stripe in new tab"}
                  </button>
                ) : (
                  <div className="mt-3">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                      <span>Waiting for Stripe connection…</span>
                    </div>
                    <button
                      type="button"
                      onClick={checkStripeStatus}
                      className="mt-2 cursor-pointer text-xs font-medium text-blue-600 underline decoration-blue-300 underline-offset-2 transition-colors duration-200 hover:text-blue-700"
                    >
                      Check connection status
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Stripe just connected — brief success flash */}
        {accessType === "stripe_gate" && stripeJustConnected && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <p className="text-sm font-medium text-emerald-800">
              Stripe connected — you can now configure pricing below.
            </p>
          </div>
        )}

        {/* Pricing config — only when paid AND Stripe connected */}
        {accessType === "stripe_gate" && stripeConnected && (
          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-5">
            <h3 className="text-sm font-semibold text-slate-900">Pricing Model</h3>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {PRICING_MODELS.map((model) => (
                <button
                  key={model.value}
                  type="button"
                  onClick={() => onPricingChange(model.value, priceCents)}
                  className={`cursor-pointer rounded-lg border px-3 py-2.5 text-left transition-colors duration-200 ${
                    pricingType === model.value
                      ? "border-blue-500 bg-blue-50 ring-1 ring-blue-200"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <span className="block text-sm font-medium text-slate-900">
                    {model.label}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-slate-600">
                    {model.hint}
                  </span>
                </button>
              ))}
            </div>

            {pricingType !== "free" && (
              <>
                <div className="mt-4">
                  <label className="block text-xs font-medium text-slate-600">
                    Price (USD)
                  </label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-600">
                      $
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={priceDisplay}
                      onChange={(e) => {
                        let raw = e.target.value.replace(/[^0-9.]/g, "");
                        const parts = raw.split(".");
                        if (parts.length > 2) raw = parts[0] + "." + parts.slice(1).join("");
                        if (parts.length === 2 && parts[1].length > 2) {
                          raw = parts[0] + "." + parts[1].slice(0, 2);
                        }
                        const num = parseFloat(raw) || 0;
                        if (num > 9999.99) return;
                        setPriceDisplay(raw);
                        onPricingChange(pricingType, Math.round(num * 100));
                      }}
                      onBlur={() => {
                        if (priceDisplay) {
                          const dollars = parseFloat(priceDisplay) || 0;
                          setPriceDisplay(dollars > 0 ? dollars.toFixed(2) : "");
                        }
                      }}
                      placeholder="0.00"
                      className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-8 pr-4 text-sm text-slate-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>

                {/* Slug input */}
                <div className="mt-4">
                  <div className="flex items-baseline justify-between">
                    <label className="block text-xs font-medium text-slate-600">
                      Product URL Slug
                    </label>
                    <span className={`text-[11px] ${slug.length > 50 ? "text-amber-600" : "text-slate-600"}`}>
                      {slug.length}/60
                    </span>
                  </div>
                  <div className="mt-1 flex items-center rounded-lg border border-gray-200 bg-white text-sm">
                    <span className="flex-shrink-0 px-3 text-slate-600">/products/</span>
                    <input
                      type="text"
                      value={slug}
                      maxLength={60}
                      onChange={(e) => {
                        setSlugManuallyEdited(true);
                        onChange(
                          "slug",
                          e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9-]/g, "-")
                            .replace(/-+/g, "-")
                            .replace(/^-/, "")
                        );
                      }}
                      placeholder="smith-dental-voice"
                      className="w-full border-0 bg-transparent py-2 pr-3 text-sm text-slate-900 outline-none"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Error */}
      {submitError && (
        <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {submitError}
        </div>
      )}
    </div>
  );
}
