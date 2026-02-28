// ============================================================================
// Level 4: Public Product Page
// /products/[slug] → Landing page with CTA → form
// Zero Getflowetic branding. Uses product's design_tokens.
// ============================================================================

import { createClient as createServiceClient } from "@supabase/supabase-js";
import { redirect, notFound } from "next/navigation";
import type { WorkflowProduct } from "@/lib/products/types";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function ProductLandingPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = createServiceClient(supabaseUrl, serviceKey);

  const { data: product } = await supabase
    .from("workflow_products")
    .select("*")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (!product) notFound();

  const wp = product as WorkflowProduct;
  const colors = (wp.design_tokens as Record<string, any>)?.colors ?? {};
  const primary = colors.primary ?? "#6366f1";
  const background = colors.background ?? "#ffffff";
  const text = colors.text ?? "#111827";
  const surface = colors.surface ?? "#f9fafb";

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: background, color: text }}
    >
      {/* Hero */}
      <main className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="max-w-2xl w-full text-center space-y-8">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight" style={{ color: text }}>
            {wp.name}
          </h1>
          {wp.description && (
            <p className="text-lg opacity-80 max-w-xl mx-auto leading-relaxed">
              {wp.description}
            </p>
          )}

          {/* Pricing badge */}
          {wp.pricing_model !== "free" && wp.price_cents > 0 && (
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
              style={{ backgroundColor: surface }}
            >
              <span>
                ${(wp.price_cents / 100).toFixed(2)}
                {wp.pricing_model === "per_run" && " per run"}
                {wp.pricing_model === "monthly" && "/month"}
              </span>
            </div>
          )}

          {/* CTA */}
          <div className="pt-4">
            <a
              href={`/products/${slug}/run`}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-lg font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg"
              style={{ backgroundColor: primary }}
            >
              Get Started →
            </a>
          </div>

          {/* Input preview */}
          {wp.input_schema && Array.isArray(wp.input_schema) && wp.input_schema.length > 0 && (
            <div className="pt-8 opacity-60 text-sm">
              {wp.input_schema.length} quick question{wp.input_schema.length !== 1 ? "s" : ""} · Results in seconds
            </div>
          )}
        </div>
      </main>

      {/* Minimal footer — no Getflowetic branding */}
      <footer className="py-6 text-center text-xs opacity-40">
        Powered by AI
      </footer>
    </div>
  );
}
