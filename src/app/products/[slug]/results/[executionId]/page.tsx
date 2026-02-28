// ============================================================================
// Level 4: Results Page
// /products/[slug]/results/[executionId]
// ============================================================================

import { createClient as createServiceClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { ResultsDisplay } from "@/components/products/ResultsDisplay";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface PageProps {
  params: Promise<{ slug: string; executionId: string }>;
}

export default async function ResultsPage({ params }: PageProps) {
  const { slug, executionId } = await params;
  const supabase = createServiceClient(supabaseUrl, serviceKey);

  // Load product for design tokens
  const { data: product } = await supabase
    .from("workflow_products")
    .select("id, name, slug, design_tokens")
    .eq("slug", slug)
    .maybeSingle();

  if (!product) notFound();

  // Load execution
  const { data: execution } = await supabase
    .from("workflow_executions")
    .select("id, status, mapped_results, error_message, duration_ms, started_at, completed_at")
    .eq("id", executionId)
    .eq("product_id", product.id)
    .maybeSingle();

  if (!execution) notFound();

  return (
    <ResultsDisplay
      executionId={execution.id}
      initialStatus={execution.status}
      initialResults={execution.mapped_results as Record<string, unknown> | null}
      initialError={execution.error_message}
      initialDuration={execution.duration_ms}
      productName={product.name}
      productSlug={product.slug}
      designTokens={product.design_tokens as Record<string, any>}
    />
  );
}
