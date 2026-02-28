// ============================================================================
// Level 4: Product Run Page (Form Wizard)
// /products/[slug]/run → Multi-step form wizard
// ============================================================================

import { createClient as createServiceClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { FormWizard } from "@/components/products/FormWizard";
import type { WorkflowProduct } from "@/lib/products/types";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function ProductRunPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = createServiceClient(supabaseUrl, serviceKey);

  const { data: product } = await supabase
    .from("workflow_products")
    .select("id, name, slug, input_schema, design_tokens, pricing_model, price_cents")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (!product) notFound();

  return (
    <FormWizard
      productId={product.id}
      productName={product.name}
      productSlug={product.slug}
      inputSchema={product.input_schema as WorkflowProduct["input_schema"]}
      designTokens={product.design_tokens as Record<string, any>}
    />
  );
}
