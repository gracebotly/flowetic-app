"use client";

import { useState, useEffect, useCallback } from "react";
import { Link2, CreditCard, UserPlus, ChevronDown, Search, Repeat, CalendarCheck, BarChart3 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { OfferingCard } from "./OfferingCard";
import { validateEmail } from "@/lib/validation/email";

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
  customPath: string;
  onCustomPathChange: (value: string) => void;
  customDomainInfo?: { domain: string; verified: boolean } | null;
  onAccessChange: (accessType: AccessType) => void;
  onPricingChange: (pricingType: PricingType, priceCents: number) => void;
  // Stripe status (fetched by parent)
  stripeConnected: boolean;
  // Context badges
  platform: string | null;
  surfaceType: string;
  // Error
  submitError: string | null;
};

type MonetizationOption = {
  value: PricingType;
  title: string;
  description: string;
  icon: typeof Link2;
  color: string;
  accessType: AccessType;
};

const MONETIZATION_OPTIONS: MonetizationOption[] = [
  {
    value: "free",
    title: "Free Link",
    description:
      "Generate a unique link — anyone with the link can access. No login, no payment. Best for client retention and proving ROI.",
    icon: Link2,
    color: "sky",
    accessType: "magic_link",
  },
  {
    value: "per_run",
    title: "Per Run",
    description:
      "Charge each time the workflow executes. Revenue goes to your Stripe account.",
    icon: Repeat,
    color: "amber",
    accessType: "stripe_gate",
  },
  {
    value: "monthly",
    title: "Monthly",
    description:
      "Flat monthly subscription fee. Predictable recurring revenue via Stripe.",
    icon: CalendarCheck,
    color: "emerald",
    accessType: "stripe_gate",
  },
  {
    value: "usage_based",
    title: "Usage Based",
    description:
      "Variable pricing based on usage volume. Flexible billing through Stripe.",
    icon: BarChart3,
    color: "violet",
    accessType: "stripe_gate",
  },
];

const FREE_ONLY_OPTION = MONETIZATION_OPTIONS[0];

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
  customPath,
  onCustomPathChange,
  customDomainInfo,
  onAccessChange,
  onPricingChange,
  stripeConnected,
  platform,
  surfaceType,
  submitError,
}: Props) {
  void prefilledClientId;

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
  const [newClientEmailError, setNewClientEmailError] = useState<string | null>(null);
  const [newClientEmailTypo, setNewClientEmailTypo] = useState<string | null>(null);
  const [newClientPhoneError, setNewClientPhoneError] = useState<string | null>(null);
  const [newClientCreateError, setNewClientCreateError] = useState<string | null>(null);

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function validatePhone(raw: string): string | null {
  if (!raw.trim()) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7) return "Phone number is too short.";
  if (digits.length > 15) return "Phone number is too long.";
  return null;
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

    // Validate email if provided
    if (newClientEmail.trim()) {
      const emailResult = validateEmail(newClientEmail);
      if (!emailResult.valid) {
        if (emailResult.code === "TYPO_DETECTED") {
          setNewClientEmailTypo(emailResult.suggestion);
        } else {
          setNewClientEmailError(emailResult.message);
        }
        return;
      }
    }

    // Validate phone if provided
    const phoneErr = validatePhone(newClientPhone);
    if (phoneErr) {
      setNewClientPhoneError(phoneErr);
      return;
    }

    setCreatingClient(true);
    setNewClientCreateError(null);
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
        setNewClientEmailError(null);
        setNewClientEmailTypo(null);
        setNewClientPhoneError(null);
      } else {
        setNewClientCreateError("Failed to create client. Please try again.");
      }
    } catch {
      setNewClientCreateError("Network error. Please try again.");
    } finally {
      setCreatingClient(false);
    }
  }, [newClientName, newClientEmail, newClientPhone, onChange]);

  // Auto-generate slug from name — only if user hasn't manually edited slug
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [pathManuallyEdited, setPathManuallyEdited] = useState(false);

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

  // Auto-generate customPath from name (for clean URLs on custom domains)
  useEffect(() => {
    if (name.trim() && !pathManuallyEdited) {
      const autoPath = name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 60);
      onCustomPathChange(autoPath);
    }
  }, [name, onCustomPathChange, pathManuallyEdited]);

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
              {/* Name */}
              <input
                type="text"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                placeholder="Client name *"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                autoFocus
              />

              {/* Email */}
              <div>
                <input
                  type="email"
                  value={newClientEmail}
                  onChange={(e) => {
                    setNewClientEmail(e.target.value);
                    if (newClientEmailError) setNewClientEmailError(null);
                    if (newClientEmailTypo) setNewClientEmailTypo(null);
                  }}
                  onBlur={() => {
                    if (!newClientEmail.trim()) return;
                    const result = validateEmail(newClientEmail);
                    if (!result.valid) {
                      if (result.code === "TYPO_DETECTED") {
                        setNewClientEmailTypo(result.suggestion);
                        setNewClientEmailError(null);
                      } else {
                        setNewClientEmailError(result.message);
                        setNewClientEmailTypo(null);
                      }
                    } else {
                      setNewClientEmailError(null);
                      setNewClientEmailTypo(null);
                    }
                  }}
                  placeholder="email@example.com"
                  className={`w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100 ${
                    newClientEmailError
                      ? "border-red-300 focus:border-red-400"
                      : "border-gray-200 focus:border-blue-300"
                  }`}
                />
                {newClientEmailError && (
                  <p className="mt-1 text-xs text-red-600">{newClientEmailError}</p>
                )}
                {newClientEmailTypo && (
                  <p className="mt-1 text-xs text-amber-700">
                    Did you mean{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setNewClientEmail(newClientEmailTypo);
                        setNewClientEmailTypo(null);
                      }}
                      className="font-semibold underline decoration-amber-400 underline-offset-2 hover:text-amber-600"
                    >
                      {newClientEmailTypo}
                    </button>
                    ?
                  </p>
                )}
              </div>

              {/* Phone */}
              <div>
                <input
                  type="tel"
                  value={newClientPhone}
                  onChange={(e) => {
                    setNewClientPhone(formatPhone(e.target.value));
                    if (newClientPhoneError) setNewClientPhoneError(null);
                  }}
                  onBlur={() => setNewClientPhoneError(validatePhone(newClientPhone))}
                  placeholder="(555) 000-0000"
                  maxLength={14}
                  className={`w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100 ${
                    newClientPhoneError
                      ? "border-red-300 focus:border-red-400"
                      : "border-gray-200 focus:border-blue-300"
                  }`}
                />
                {newClientPhoneError && (
                  <p className="mt-1 text-xs text-red-600">{newClientPhoneError}</p>
                )}
              </div>
            </div>

            {/* Create error */}
            {newClientCreateError && (
              <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {newClientCreateError}
              </div>
            )}

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
                onClick={() => {
                  setShowNewClientForm(false);
                  setNewClientEmailError(null);
                  setNewClientEmailTypo(null);
                  setNewClientPhoneError(null);
                  setNewClientCreateError(null);
                }}
                className="rounded-lg border border-gray-200 bg-white px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Monetization ─────────────────────────────────── */}
      <div className="mt-8">
        <h3 className="text-sm font-semibold text-slate-900">Access</h3>
        <p className="mt-1 text-xs text-slate-600">
          {stripeConnected
            ? "Choose how clients access this portal — you can change this later."
            : "Share via a free link. Connect Stripe in Settings to unlock paid access."}
        </p>

        {stripeConnected ? (
          <>
            {/* Flat monetization list */}
            <div className="mt-3 grid gap-3">
              {MONETIZATION_OPTIONS.map((opt) => (
                <OfferingCard
                  key={opt.value}
                  title={opt.title}
                  description={opt.description}
                  icon={opt.icon}
                  color={opt.color}
                  selected={
                    pricingType === opt.value &&
                    accessType === opt.accessType
                  }
                  onClick={() => {
                    onAccessChange(opt.accessType);
                    onPricingChange(opt.value, opt.value === "free" ? 0 : priceCents);
                  }}
                />
              ))}
            </div>

            {/* Price + slug — animated reveal for paid options */}
            <AnimatePresence>
              {accessType === "stripe_gate" && pricingType !== "free" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
                    <div>
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

                    {/* URL Path input — domain-aware */}
                    <div className="mt-4">
                      <div className="flex items-baseline justify-between">
                        <label className="block text-xs font-medium text-slate-600">
                          {customDomainInfo?.verified ? "URL Path" : "Product URL Slug"}
                        </label>
                        <span className={`text-[11px] ${(customDomainInfo?.verified ? customPath : slug).length > 50 ? "text-amber-600" : "text-slate-600"}`}>
                          {(customDomainInfo?.verified ? customPath : slug).length}/60
                        </span>
                      </div>
                      {customDomainInfo?.verified ? (
                        <>
                          <div className="mt-1 flex items-center rounded-lg border border-gray-200 bg-white text-sm">
                            <span className="flex-shrink-0 rounded-l-lg border-r border-gray-200 bg-gray-50 px-3 py-2 text-xs text-slate-500">
                              {customDomainInfo.domain}/
                            </span>
                            <input
                              type="text"
                              value={customPath}
                              maxLength={60}
                              onChange={(e) => {
                                setPathManuallyEdited(true);
                                setSlugManuallyEdited(true);
                                const cleaned = e.target.value
                                  .toLowerCase()
                                  .replace(/[^a-z0-9-]/g, "-")
                                  .replace(/-+/g, "-")
                                  .replace(/^-/, "");
                                onCustomPathChange(cleaned);
                                onChange("slug", cleaned);
                              }}
                              placeholder="lead-qualifier"
                              className="w-full border-0 bg-transparent py-2 pr-3 text-sm text-slate-900 outline-none"
                            />
                          </div>
                          <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600">
                            <span className="h-1 w-1 rounded-full bg-emerald-500" />
                            Using your custom domain
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="mt-1 flex items-center rounded-lg border border-gray-200 bg-white text-sm">
                            <span className="flex-shrink-0 px-3 text-slate-600">/p/</span>
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
                          {!customDomainInfo && (
                            <p className="mt-1.5 text-[11px] text-slate-400">
                              Add a custom domain in{" "}
                              <a href="/control-panel/settings?tab=branding" className="text-blue-500 hover:text-blue-600">
                                Settings → Branding
                              </a>{" "}
                              for cleaner URLs
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* URL Path input — always visible for all portal types */}
            {accessType === "magic_link" && (
              <div className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
                <div className="flex items-baseline justify-between">
                  <label className="block text-xs font-medium text-slate-600">
                    {customDomainInfo?.verified ? "URL Path" : "Portal URL Path"}
                  </label>
                  <span className={`text-[11px] ${customPath.length > 50 ? "text-amber-600" : "text-slate-600"}`}>
                    {customPath.length}/60
                  </span>
                </div>
                {customDomainInfo?.verified ? (
                  <>
                    <div className="mt-1 flex items-center rounded-lg border border-gray-200 bg-white text-sm">
                      <span className="flex-shrink-0 rounded-l-lg border-r border-gray-200 bg-gray-50 px-3 py-2 text-xs text-slate-500">
                        {customDomainInfo.domain}/
                      </span>
                      <input
                        type="text"
                        value={customPath}
                        maxLength={60}
                        onChange={(e) => {
                          setPathManuallyEdited(true);
                          onCustomPathChange(
                            e.target.value
                              .toLowerCase()
                              .replace(/[^a-z0-9-]/g, "-")
                              .replace(/-+/g, "-")
                              .replace(/^-/, "")
                          );
                        }}
                        placeholder="client-dashboard"
                        className="w-full border-0 bg-transparent py-2 pr-3 text-sm text-slate-900 outline-none"
                      />
                    </div>
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600">
                      <span className="h-1 w-1 rounded-full bg-emerald-500" />
                      Using your custom domain
                    </p>
                  </>
                ) : (
                  <>
                    <div className="mt-1 flex items-center rounded-lg border border-gray-200 bg-white text-sm">
                      <span className="flex-shrink-0 px-3 text-slate-600">/client/</span>
                      <input
                        type="text"
                        value={customPath}
                        maxLength={60}
                        onChange={(e) => {
                          setPathManuallyEdited(true);
                          onCustomPathChange(
                            e.target.value
                              .toLowerCase()
                              .replace(/[^a-z0-9-]/g, "-")
                              .replace(/-+/g, "-")
                              .replace(/^-/, "")
                          );
                        }}
                        placeholder="smith-dental-dashboard"
                        className="w-full border-0 bg-transparent py-2 pr-3 text-sm text-slate-900 outline-none"
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-400">
                      This path is auto-generated from the portal name. You can customize it.
                    </p>
                  </>
                )}
              </div>
            )}

          </>
        ) : (
          <>
            {/* Stripe NOT connected — Free Link only */}
            <div className="mt-3 grid gap-3">
              <OfferingCard
                title={FREE_ONLY_OPTION.title}
                description={FREE_ONLY_OPTION.description}
                icon={FREE_ONLY_OPTION.icon}
                color={FREE_ONLY_OPTION.color}
                selected={true}
                onClick={() => {
                  onAccessChange("magic_link");
                  onPricingChange("free", 0);
                }}
              />
            </div>

            {/* URL Path input — visible for free portals */}
            {accessType === "magic_link" && (
              <div className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
                <div className="flex items-baseline justify-between">
                  <label className="block text-xs font-medium text-slate-600">
                    {customDomainInfo?.verified ? "URL Path" : "Portal URL Path"}
                  </label>
                  <span className={`text-[11px] ${customPath.length > 50 ? "text-amber-600" : "text-slate-600"}`}>
                    {customPath.length}/60
                  </span>
                </div>
                {customDomainInfo?.verified ? (
                  <>
                    <div className="mt-1 flex items-center rounded-lg border border-gray-200 bg-white text-sm">
                      <span className="flex-shrink-0 rounded-l-lg border-r border-gray-200 bg-gray-50 px-3 py-2 text-xs text-slate-500">
                        {customDomainInfo.domain}/
                      </span>
                      <input
                        type="text"
                        value={customPath}
                        maxLength={60}
                        onChange={(e) => {
                          setPathManuallyEdited(true);
                          onCustomPathChange(
                            e.target.value
                              .toLowerCase()
                              .replace(/[^a-z0-9-]/g, "-")
                              .replace(/-+/g, "-")
                              .replace(/^-/, "")
                          );
                        }}
                        placeholder="client-dashboard"
                        className="w-full border-0 bg-transparent py-2 pr-3 text-sm text-slate-900 outline-none"
                      />
                    </div>
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600">
                      <span className="h-1 w-1 rounded-full bg-emerald-500" />
                      Using your custom domain
                    </p>
                  </>
                ) : (
                  <>
                    <div className="mt-1 flex items-center rounded-lg border border-gray-200 bg-white text-sm">
                      <span className="flex-shrink-0 px-3 text-slate-600">/client/</span>
                      <input
                        type="text"
                        value={customPath}
                        maxLength={60}
                        onChange={(e) => {
                          setPathManuallyEdited(true);
                          onCustomPathChange(
                            e.target.value
                              .toLowerCase()
                              .replace(/[^a-z0-9-]/g, "-")
                              .replace(/-+/g, "-")
                              .replace(/^-/, "")
                          );
                        }}
                        placeholder="smith-dental-dashboard"
                        className="w-full border-0 bg-transparent py-2 pr-3 text-sm text-slate-900 outline-none"
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-400">
                      This path is auto-generated from the portal name. You can customize it.
                    </p>
                  </>
                )}
              </div>
            )}

            <div className="mt-3 flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3">
              <CreditCard className="h-4 w-4 shrink-0 text-slate-600" />
              <p className="text-xs text-slate-600">
                Want to charge for this portal?{" "}
                <a
                  href="/control-panel/settings?tab=billing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-blue-600 underline decoration-blue-200 underline-offset-2 transition-colors duration-200 hover:text-blue-700"
                >
                  Connect Stripe in Settings
                </a>{" "}
                first, then come back to enable paid access.
              </p>
            </div>
          </>
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
