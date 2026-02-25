#!/usr/bin/env tsx
// scripts/audit-specs.ts
//
// Phase 5: Batch compliance audit for existing interface_versions.
// Run: npx tsx scripts/audit-specs.ts
// Read-only. Does NOT modify data.

import { createClient } from "@supabase/supabase-js";

const KNOWN_TYPES = new Set([
  "MetricCard", "LineChart", "BarChart", "PieChart", "DonutChart", "DataTable",
  "TimeseriesChart", "AreaChart", "InsightCard", "StatusFeed",
  "HeroSection", "FeatureGrid", "PricingCards", "CTASection",
  "PageHeader", "FilterBar", "CRUDTable", "AuthForm", "EmptyStateCard",
]);

const TYPE_ALIASES: Record<string, string> = {
  "kpi-card": "MetricCard", kpi_card: "MetricCard", kpi: "MetricCard",
  "metric-card": "MetricCard", MetricCard: "MetricCard",
  "line-chart": "LineChart", line_chart: "LineChart", LineChart: "LineChart",
  chart: "LineChart",
  "bar-chart": "BarChart", bar_chart: "BarChart", BarChart: "BarChart",
  "pie-chart": "PieChart", pie_chart: "PieChart", PieChart: "PieChart",
  "donut-chart": "DonutChart", donut_chart: "DonutChart", DonutChart: "DonutChart",
  "data-table": "DataTable", data_table: "DataTable", DataTable: "DataTable",
  table: "DataTable",
  "timeseries-chart": "TimeseriesChart", TimeseriesChart: "TimeseriesChart",
  "area-chart": "AreaChart", AreaChart: "AreaChart",
  "insight-card": "InsightCard", InsightCard: "InsightCard",
  "status-feed": "StatusFeed", StatusFeed: "StatusFeed",
  "empty-state": "EmptyStateCard", EmptyStateCard: "EmptyStateCard",
  "hero-section": "HeroSection", HeroSection: "HeroSection",
  "feature-grid": "FeatureGrid", FeatureGrid: "FeatureGrid",
  "pricing-cards": "PricingCards", PricingCards: "PricingCards",
  "cta-section": "CTASection", CTASection: "CTASection",
  "page-header": "PageHeader", PageHeader: "PageHeader",
  "filter-bar": "FilterBar", FilterBar: "FilterBar",
  "crud-table": "CRUDTable", CRUDTable: "CRUDTable",
  "auth-form": "AuthForm", AuthForm: "AuthForm",
  "brand-visual": "BrandVisual", BrandVisual: "BrandVisual",
  "social-proof-bar": "SocialProofBar", SocialProofBar: "SocialProofBar",
};

function resolveType(raw: string): string | null {
  if (TYPE_ALIASES[raw]) return TYPE_ALIASES[raw];
  if (KNOWN_TYPES.has(raw)) return raw;
  const normalized = raw.toLowerCase().replace(/[-_\s]/g, "");
  for (const [alias, canonical] of Object.entries(TYPE_ALIASES)) {
    if (alias.toLowerCase().replace(/[-_\s]/g, "") === normalized) return canonical;
  }
  return null;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key);
  console.log("\n🔍 Getflowetic — Phase 5 Spec Compliance Audit\n");
  console.log("═".repeat(60));

  const { data: versions, error } = await supabase
    .from("interface_versions")
    .select("id, interface_id, spec_json, created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) { console.error("❌ DB error:", error.message); process.exit(1); }
  if (!versions?.length) { console.log("✅ No specs to audit."); return; }

  let totalSpecs = 0, compliant = 0, withUnknown = 0, totalUnknown = 0;
  let noComponents = 0, missingLayout = 0;
  const unknownTypes = new Map<string, number>();
  const flagged: { id: string; iface: string; issues: string[] }[] = [];

  for (const v of versions) {
    totalSpecs++;
    const spec = v.spec_json;
    const issues: string[] = [];

    if (!spec || typeof spec !== "object") {
      issues.push("Null/invalid spec"); flagged.push({ id: v.id, iface: v.interface_id, issues }); continue;
    }
    if (!spec.layout) { missingLayout++; issues.push("Missing layout"); }
    if (!Array.isArray(spec.components) || spec.components.length === 0) {
      noComponents++; issues.push("No components");
      flagged.push({ id: v.id, iface: v.interface_id, issues }); continue;
    }

    let hasUnknown = false;
    for (const comp of spec.components) {
      if (!comp?.type) { issues.push(`Component "${comp?.id}" has no type`); continue; }
      if (!resolveType(comp.type)) {
        hasUnknown = true; totalUnknown++;
        unknownTypes.set(comp.type, (unknownTypes.get(comp.type) ?? 0) + 1);
        issues.push(`Unknown: "${comp.type}" (${comp.id})`);
      }
    }

    if (hasUnknown) withUnknown++;
    if (issues.length === 0) compliant++;
    else flagged.push({ id: v.id, iface: v.interface_id, issues });
  }

  console.log(`\n📊 Results (${totalSpecs} specs):\n`);
  console.log(`   ✅ Compliant:       ${compliant}/${totalSpecs} (${Math.round(compliant / totalSpecs * 100)}%)`);
  console.log(`   ⚠️  Unknown types:   ${withUnknown} specs (${totalUnknown} components)`);
  console.log(`   🗂️  Missing layout:  ${missingLayout}`);
  console.log(`   🫙 No components:   ${noComponents}`);

  if (unknownTypes.size > 0) {
    console.log(`\n🔍 Unknown types:\n`);
    for (const [t, c] of [...unknownTypes.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`   "${t}" × ${c}`);
    }
  }

  if (flagged.length > 0) {
    console.log(`\n🚩 Flagged (${flagged.length}):\n`);
    for (const f of flagged.slice(0, 20)) {
      console.log(`   ${f.id} → ${f.issues.slice(0, 3).join(", ")}`);
    }
    if (flagged.length > 20) console.log(`   ... +${flagged.length - 20} more`);
  }

  console.log("\n" + "═".repeat(60));
  console.log(compliant === totalSpecs
    ? "🏆 All specs compliant. Phase 5 enforcement is safe.\n"
    : `⚡ ${totalSpecs - compliant} spec(s) need attention. validateBeforeRender handles this at render time.\n`
  );
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
