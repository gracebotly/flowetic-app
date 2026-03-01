"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MakeLogo, N8nLogo } from "@/components/connections/platform-icons";
import { CheckCircle2, Search } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type IndexedEntity = {
  id: string;
  source_id: string;
  display_name: string;
  external_id: string;
  entity_kind: string;
  source_type?: string;
  source_name?: string;
};

type PricingModel = "free" | "per_run" | "monthly" | "usage_based";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function icon(type: string) {
  const props = { className: "h-5 w-5" };
  if (type === "n8n") return <N8nLogo {...props} />;
  return <MakeLogo {...props} />;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

/* ------------------------------------------------------------------ */
/* Page Component                                                      */
/* ------------------------------------------------------------------ */

export default function CreateProductPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<"scenario" | "details" | "success">("scenario");
  const [entities, setEntities] = useState<IndexedEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Step 1 selection
  const [selectedEntity, setSelectedEntity] = useState<IndexedEntity | null>(null);

  // Step 2 fields
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [pricingModel, setPricingModel] = useState<PricingModel>("free");
  const [priceCents, setPriceCents] = useState(0);

  // Step 3
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);

  /* ---------------------------------------------------------------- */
  /* Load entities (only Make + n8n workflows for products)            */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        setError("Please log in.");
        setLoading(false);
        return;
      }

      const { data: membership } = await supabase
        .from("memberships")
        .select("tenant_id")
        .eq("user_id", authData.user.id)
        .single();

      if (!membership) {
        setError("No tenant membership found.");
        setLoading(false);
        return;
      }

      const tenantId = membership.tenant_id;

      // Only Make and n8n sources are valid for products
      const { data: sourcesData } = await supabase
        .from("sources")
        .select("id, name, type, status")
        .eq("tenant_id", tenantId)
        .eq("status", "active")
        .in("type", ["make", "n8n"]);

      const sourceMap = new Map(
        (sourcesData ?? []).map((s: { id: string; name: string; type: string; status: string }) => [s.id, s])
      );

      const sourceIds = (sourcesData ?? []).map((s) => s.id);

      if (sourceIds.length === 0) {
        setEntities([]);
        setLoading(false);
        return;
      }

      const { data: entitiesData } = await supabase
        .from("source_entities")
        .select("id, source_id, display_name, external_id, entity_kind, enabled_for_analytics")
        .eq("tenant_id", tenantId)
        .in("source_id", sourceIds);

      const enriched: IndexedEntity[] = (entitiesData ?? []).map((entity: IndexedEntity) => {
        const source = sourceMap.get(entity.source_id);
        return {
          ...entity,
          source_type: source?.type ?? "make",
          source_name: source?.name ?? "Unknown",
        };
      });

      setEntities(enriched);
      setLoading(false);
    })();
  }, [supabase]);

  /* ---------------------------------------------------------------- */
  /* Select scenario                                                   */
  /* ---------------------------------------------------------------- */

  function selectScenario(entity: IndexedEntity) {
    setSelectedEntity(entity);
    setProductName(entity.display_name);
    setSlug(slugify(entity.display_name));
    setStep("details");
  }

  /* ---------------------------------------------------------------- */
  /* Create product                                                    */
  /* ---------------------------------------------------------------- */

  async function createProduct() {
    if (!selectedEntity || !productName.trim() || !slug.trim()) return;
    setLoading(true);
    setError(null);

    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      setError("Please log in.");
      setLoading(false);
      return;
    }

    const { data: membership } = await supabase
      .from("memberships")
      .select("tenant_id")
      .eq("user_id", authData.user.id)
      .single();

    if (!membership) {
      setError("No tenant membership found.");
      setLoading(false);
      return;
    }

    const { data: existing } = await supabase
      .from("workflow_products")
      .select("id")
      .eq("slug", slug.trim())
      .maybeSingle();

    if (existing) {
      setError("A product with this slug already exists. Choose a different name.");
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from("workflow_products").insert({
      tenant_id: membership.tenant_id,
      name: productName.trim(),
      slug: slug.trim(),
      description: description.trim() || null,
      source_id: selectedEntity.source_id,
      scenario_id: selectedEntity.external_id,
      pricing_model: pricingModel,
      price_cents: pricingModel === "free" ? 0 : priceCents,
      status: "draft",
      input_schema: [], // Will be populated when extractInputSchema is implemented
    });

    if (insertError) {
      setError(insertError.message || "Failed to create product.");
      setLoading(false);
      return;
    }

    setCreatedSlug(slug.trim());
    setStep("success");
    setLoading(false);
  }

  /* ---------------------------------------------------------------- */
  /* Filtered entities                                                 */
  /* ---------------------------------------------------------------- */

  const filteredEntities = entities.filter((e) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      e.display_name.toLowerCase().includes(q) ||
      (e.source_name ?? "").toLowerCase().includes(q)
    );
  });

  /* ---------------------------------------------------------------- */
  /* Render                                                            */
  /* ---------------------------------------------------------------- */

  return (
    <div className="flex min-h-[80vh] items-start justify-center pt-12">
      <div className="w-full max-w-xl rounded-2xl border border-gray-200 bg-white shadow-sm">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4">
          <h1 className="text-lg font-semibold text-gray-900">Create Product</h1>
          <p className="text-sm text-gray-500">
            Step {step === "scenario" ? "1" : step === "details" ? "2" : "3"} of 3
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          {/* ── Step 1: Pick a Scenario ── */}
          {step === "scenario" && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">
                Which workflow should power this product?
              </h2>
              <p className="text-sm text-gray-500">
                Pick a Make scenario or n8n workflow to turn into a sellable product.
              </p>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search scenarios..."
                  className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {loading && <p className="text-sm text-gray-500">Loading workflows...</p>}

              {!loading && entities.length === 0 && (
                <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
                  <p className="text-sm text-gray-600">
                    No Make scenarios or n8n workflows found. Connect a platform and
                    index some workflows first.
                  </p>
                  <Link
                    href="/control-panel/connections"
                    className="mt-3 inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    Go to Connections →
                  </Link>
                </div>
              )}

              {!loading && filteredEntities.length > 0 && (
                <div className="max-h-[400px] space-y-2 overflow-y-auto">
                  {filteredEntities.map((entity) => (
                    <button
                      key={entity.id}
                      onClick={() => selectScenario(entity)}
                      className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left transition hover:border-blue-300 hover:bg-blue-50"
                    >
                      {icon(entity.source_type ?? "make")}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {entity.display_name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {entity.entity_kind === "scenario" ? "Scenario" : "Workflow"} ·{" "}
                          {(entity.source_type ?? "").toUpperCase()} · {entity.source_name}
                        </p>
                      </div>
                      <span className="text-xs font-medium text-blue-600">Select</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Name + Price ── */}
          {step === "details" && selectedEntity && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Product details</h2>

              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <div className="flex items-center gap-2">
                  {icon(selectedEntity.source_type ?? "make")}
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedEntity.display_name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(selectedEntity.source_type ?? "").toUpperCase()} ·{" "}
                      {selectedEntity.source_name}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Product Name
                </label>
                <input
                  value={productName}
                  onChange={(e) => {
                    setProductName(e.target.value);
                    setSlug(slugify(e.target.value));
                  }}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Lead Qualifier AI"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="What does this product do for your customers?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Slug</label>
                <div className="mt-1 flex items-center gap-1 text-sm text-gray-500">
                  <span>/products/</span>
                  <input
                    value={slug}
                    onChange={(e) => setSlug(slugify(e.target.value))}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Pricing Model
                </label>
                <select
                  value={pricingModel}
                  onChange={(e) => setPricingModel(e.target.value as PricingModel)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="free">Free</option>
                  <option value="per_run">Per Run</option>
                  <option value="monthly">Monthly</option>
                  <option value="usage_based">Usage Based</option>
                </select>
              </div>

              {pricingModel !== "free" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Price ($)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={priceCents / 100}
                    onChange={(e) =>
                      setPriceCents(Math.round(parseFloat(e.target.value || "0") * 100))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="29.00"
                  />
                </div>
              )}
            </div>
          )}

          {/* ── Step 3: Success ── */}
          {step === "success" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle2 className="h-5 w-5" />
                <h2 className="text-xl font-semibold">Product Created!</h2>
              </div>
              <p className="text-sm text-gray-600">
                Your product has been saved as a <strong>draft</strong>. You can publish
                it from the product settings page.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => router.push("/control-panel/products")}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  ← Back to Products
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white"
                >
                  Create Another
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
          <button
            onClick={() => router.push("/control-panel/products")}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
          <div className="flex gap-2">
            {step === "details" && (
              <button
                onClick={() => setStep("scenario")}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                Back
              </button>
            )}
            {step === "details" && (
              <button
                onClick={() => void createProduct()}
                disabled={loading || !productName.trim() || !slug.trim()}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-60"
              >
                {loading ? "Creating..." : "Create Product (Draft)"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
