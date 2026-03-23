"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { LogoUploader } from "@/components/settings/LogoUploader";
import { ColorPicker } from "@/components/settings/ColorPicker";
import { BrandingPreview } from "@/components/settings/BrandingPreview";
import { DomainCard } from "@/components/settings/DomainCard";

type Branding = {
  name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  welcome_message: string;
  brand_footer: string;
};

export function BrandingTab() {
  const [branding, setBranding] = useState<Branding | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit state
  const [primaryColor, setPrimaryColor] = useState("#059669");
  const [secondaryColor, setSecondaryColor] = useState("#065F46");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [brandFooter, setBrandFooter] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Load branding ─────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const res = await fetch("/api/settings/branding");
      const json = await res.json();
      if (json.ok && json.branding) {
        const b = json.branding as Branding;
        setBranding(b);
        setPrimaryColor(b.primary_color);
        setSecondaryColor(b.secondary_color);
        setWelcomeMessage(b.welcome_message);
        setBrandFooter(b.brand_footer);
        setLogoUrl(b.logo_url);
      }
      setLoading(false);
    })();
  }, []);

  // ── Save branding (colors + text only — logo is saved separately) ──
  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const res = await fetch("/api/settings/branding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        welcome_message: welcomeMessage,
        brand_footer: brandFooter,
      }),
    });
    const json = await res.json();

    if (json.ok && json.branding) {
      const b = json.branding as Branding;
      setBranding(b);
      setPrimaryColor(b.primary_color);
      setSecondaryColor(b.secondary_color);
      setWelcomeMessage(b.welcome_message);
      setBrandFooter(b.brand_footer);
      setLogoUrl(b.logo_url);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } else {
      setSaveError(json.code || "Save failed");
    }
    setSaving(false);
  };

  // ── Logo callbacks ────────────────────────────────────────
  const handleLogoUploaded = (url: string) => {
    setLogoUrl(url);
  };

  const handleLogoRemoved = () => {
    setLogoUrl(null);
  };

  const hasChanges =
    branding &&
    (primaryColor !== branding.primary_color ||
      secondaryColor !== branding.secondary_color ||
      welcomeMessage !== branding.welcome_message ||
      brandFooter !== branding.brand_footer);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!branding) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-600">
        Failed to load branding settings.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Logo */}
      <div>
        <label className="block text-xs font-medium uppercase tracking-wider text-gray-400">
          Logo
        </label>
        <div className="mt-2">
          <LogoUploader
            currentUrl={logoUrl}
            onUploaded={handleLogoUploaded}
            onRemoved={handleLogoRemoved}
          />
        </div>
      </div>

      {/* Colors */}
      <div>
        <label className="block text-xs font-medium uppercase tracking-wider text-gray-400">
          Accent Colors
        </label>
        <p className="mt-1 text-xs text-gray-500">
          These colors appear as accent highlights in your client portals — gradient bars, KPI icons, and badges. Your clients can toggle between light and dark mode independently.
        </p>
        <div className="mt-3 flex flex-wrap gap-6">
          <ColorPicker
            label="Primary"
            value={primaryColor}
            onChange={setPrimaryColor}
          />
          <ColorPicker
            label="Secondary"
            value={secondaryColor}
            onChange={setSecondaryColor}
          />
        </div>
      </div>

      {/* Portal Text */}
      <div>
        <label className="block text-xs font-medium uppercase tracking-wider text-gray-400">
          Portal Text
        </label>
        <div className="mt-2">
          <label className="block text-sm font-medium text-gray-700">Welcome Message</label>
          <p className="mt-0.5 text-xs text-gray-500">Shown in the portal header beneath your logo.</p>
          <input
            type="text"
            value={welcomeMessage}
            onChange={(e) => setWelcomeMessage(e.target.value)}
            placeholder="Welcome to your dashboard"
            className="mt-1 w-full max-w-lg rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700">Footer Text</label>
          <p className="mt-0.5 text-xs text-gray-500">Appears at the bottom of all portals and product pages.</p>
          <input
            type="text"
            value={brandFooter}
            onChange={(e) => setBrandFooter(e.target.value)}
            placeholder="Powered by Getflowetic"
            className="mt-1 w-full max-w-lg rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>

      {/* Custom Domain */}
      <div>
        <label className="block text-xs font-medium uppercase tracking-wider text-gray-400">
          Custom Domain
        </label>
        <div className="mt-2">
          <DomainCard />
        </div>
      </div>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition ${
            hasChanges && !saving
              ? "bg-blue-600 hover:bg-blue-700"
              : "cursor-not-allowed bg-gray-300"
          }`}
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? "Saving..." : "Save Branding"}
        </button>
        {saveSuccess && (
          <span className="text-sm font-medium text-emerald-600">Saved!</span>
        )}
        {saveError && (
          <span className="text-sm font-medium text-red-600">{saveError}</span>
        )}
      </div>

      {/* Live Preview */}
      <div>
        <label className="block text-xs font-medium uppercase tracking-wider text-gray-400">
          Live Preview
        </label>
        <div className="mt-2">
          <BrandingPreview
            tenantName={branding?.name || "Getflowetic"}
            logoUrl={logoUrl}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            welcomeMessage={welcomeMessage}
            brandFooter={brandFooter}
          />
        </div>
      </div>
    </div>
  );
}
