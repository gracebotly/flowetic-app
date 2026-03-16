"use client";

import { useEffect, useState, useRef, type ComponentType } from "react";
import {
  DollarSign,
  TrendingUp,
  Users,
  Zap,
  CreditCard,
  Activity,
  ArrowRight,
  ArrowUpRight,
  Clock,
  Eye,
} from "lucide-react";
import { AreaChart } from "@tremor/react";
import { motion } from "framer-motion";
import Link from "next/link";

/* ─── Types ─── */

interface RevenueOverview {
  total_revenue_cents: number;
  total_customers: number;
  active_subscriptions: number;
  total_executions: number;
  mrr_cents: number;
}

interface OfferingRevenue {
  portal_id: string;
  portal_name: string;
  pricing_type: string;
  revenue_cents: number;
  customers: number;
  executions: number;
  surface_type?: string;
  view_count?: number;
  published_at?: string;
}

interface TimelinePoint {
  date: string;
  revenue_cents: number;
}

interface PaymentEvent {
  customer_email: string;
  portal_name: string;
  amount_cents: number;
  paid_at: string;
}

interface AnalyticsData {
  overview: RevenueOverview;
  per_offering: OfferingRevenue[];
  revenue_timeline: TimelinePoint[];
  recent_payments: PaymentEvent[];
}

/* ─── Helpers ─── */

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatCompact(cents: number): string {
  const val = cents / 100;
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}k`;
  return formatCents(cents);
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function daysSince(dateStr: string | undefined | null): number | null {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

const PRICING_LABELS: Record<string, string> = {
  free: "Free",
  per_run: "Per Run",
  monthly: "Monthly",
  usage_based: "Usage",
};

const SURFACE_LABELS: Record<string, string> = {
  analytics: "Portal",
  runner: "Product",
  both: "Portal + Product",
};

/* ─── Animation ─── */

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.97 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

/* ─── Period Selector ─── */

const PERIODS = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
] as const;

function PeriodSelector({
  value,
  onChange,
  loading,
}: {
  value: string;
  onChange: (p: string) => void;
  loading: boolean;
}) {
  return (
    <div className="relative flex items-center rounded-lg bg-slate-100 p-0.5">
      {PERIODS.map((p) => (
        <button
          key={p.key}
          onClick={() => onChange(p.key)}
          disabled={loading && value !== p.key}
          className={`relative z-10 rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors duration-200 ${
            value === p.key
              ? "text-slate-900"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {p.label}
          {value === p.key && (
            <motion.div
              layoutId="period-pill"
              className="absolute inset-0 rounded-md bg-white shadow-sm ring-1 ring-slate-200/60"
              style={{ zIndex: -1 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}
        </button>
      ))}
    </div>
  );
}

/* ─── Metric Card (left-border accent, inline icon) ─── */

const BORDER_COLORS: Record<string, string> = {
  revenue: "border-l-emerald-500",
  mrr: "border-l-blue-500",
  customers: "border-l-violet-500",
  executions: "border-l-amber-500",
};

function MetricCard({
  icon: Icon,
  label,
  value,
  change,
  accentKey,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  change: number | null;
  accentKey: string;
}) {
  const borderColor = BORDER_COLORS[accentKey] || "border-l-slate-300";

  return (
    <motion.div
      variants={fadeUp}
      className={`rounded-lg border border-gray-200 bg-white p-4 border-l-[3px] ${borderColor}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <Icon className="h-3.5 w-3.5" />
            {label}
          </div>
          <p className="text-xl font-semibold tracking-tight text-slate-900">
            {value}
          </p>
        </div>
        {change !== null && (
          <span
            className={`flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
              change >= 0
                ? "bg-emerald-50 text-emerald-700"
                : "bg-red-50 text-red-600"
            }`}
          >
            <ArrowUpRight
              className={`h-3 w-3 ${change < 0 ? "rotate-90" : ""}`}
            />
            {change >= 0 ? "+" : ""}
            {change}%
          </span>
        )}
      </div>
    </motion.div>
  );
}

/* ─── Chart Tabs ─── */

type ChartMode = "revenue" | "customers" | "executions";

function ChartTabs({
  value,
  onChange,
}: {
  value: ChartMode;
  onChange: (m: ChartMode) => void;
}) {
  const tabs: { key: ChartMode; label: string }[] = [
    { key: "revenue", label: "Revenue" },
    { key: "customers", label: "Customers" },
    { key: "executions", label: "Executions" },
  ];

  return (
    <div className="flex items-center gap-0.5 rounded-md bg-slate-100 p-0.5">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors duration-200 ${
            value === t.key
              ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/60"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ─── Offering Row ─── */

function OfferingRow({ offering }: { offering: OfferingRevenue }) {
  const pricingLabel =
    PRICING_LABELS[offering.pricing_type] || offering.pricing_type;
  const days = daysSince(offering.published_at);
  const views = offering.view_count || 0;

  const pricingColor =
    offering.pricing_type === "monthly"
      ? "bg-blue-50 text-blue-700"
      : offering.pricing_type === "per_run"
        ? "bg-violet-50 text-violet-700"
        : offering.pricing_type === "usage_based"
          ? "bg-amber-50 text-amber-700"
          : "bg-slate-100 text-slate-600";

  return (
    <div className="group flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3.5 transition-colors duration-200 hover:border-slate-300">
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-medium text-slate-900">
          {offering.portal_name}
        </h3>
        <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {offering.customers}
          </span>
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3" />
            {offering.executions.toLocaleString()}
          </span>
          {views > 0 && (
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {views.toLocaleString()}
            </span>
          )}
          {days !== null && (
            <span>{days}d live</span>
          )}
        </div>
      </div>
      <div className="ml-4 text-right">
        <p className="text-sm font-semibold text-slate-900">
          {formatCents(offering.revenue_cents)}
        </p>
        <span
          className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${pricingColor}`}
        >
          {pricingLabel}
        </span>
      </div>
    </div>
  );
}

/* ─── Payment Row ─── */

function PaymentRow({ payment }: { payment: PaymentEvent }) {
  const initial = payment.customer_email[0]?.toUpperCase() || "?";

  return (
    <div className="flex items-center justify-between px-3.5 py-3 transition-colors duration-150 hover:bg-slate-50">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-medium text-slate-600">
          {initial}
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-slate-900">
            {payment.customer_email}
          </p>
          <p className="text-[11px] text-slate-500">{payment.portal_name}</p>
        </div>
      </div>
      <div className="ml-3 shrink-0 text-right">
        <p className="text-xs font-medium text-emerald-600">
          +{formatCents(payment.amount_cents)}
        </p>
        <p className="text-[10px] text-slate-400">{timeAgo(payment.paid_at)}</p>
      </div>
    </div>
  );
}

/* ─── Stat Row ─── */

function StatRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-xs font-medium text-slate-900">{value}</span>
    </div>
  );
}

/* ─── Skeleton ─── */

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-2 h-3 w-20 rounded bg-slate-100" />
      <div className="h-6 w-24 rounded bg-slate-100" />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-6 w-28 animate-pulse rounded bg-slate-100" />
          <div className="mt-2 h-4 w-56 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="h-9 w-48 animate-pulse rounded-lg bg-slate-100" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <div className="h-64 animate-pulse rounded-lg border border-gray-200 bg-white" />
    </div>
  );
}

/* ─── Empty State ─── */

function EmptyRevenue() {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
        <DollarSign className="h-5 w-5 text-slate-500" />
      </div>
      <h3 className="text-base font-semibold text-slate-900">
        Your revenue dashboard is ready
      </h3>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-slate-500">
        Publish a paid portal or product and share it with customers.
        Revenue, payments, and analytics will appear here in real time.
      </p>
      <Link
        href="/control-panel/client-portals/create"
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-slate-800"
      >
        Create your first portal
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

/* ─── Main Page ─── */

export default function RevenuePage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [prevOverview, setPrevOverview] = useState<RevenueOverview | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState("30d");
  const [chartMode, setChartMode] = useState<ChartMode>("revenue");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const isInitial = data === null;
    if (!isInitial) setSwitching(true);
    else setLoading(true);

    const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - days);

    const currentFetch = fetch(
      `/api/client-portals/analytics?period=${period}`,
      { signal: controller.signal }
    ).then((r) => r.json());

    const prevFetch = fetch(
      `/api/client-portals/analytics?period=${period}&before=${periodStart.toISOString()}`,
      { signal: controller.signal }
    )
      .then((r) => r.json())
      .catch(() => null);

    Promise.all([currentFetch, prevFetch])
      .then(([current, previous]) => {
        if (controller.signal.aborted) return;
        if (current.error) {
          setError(current.error);
        } else {
          setData(current);
          if (previous && !previous.error) {
            setPrevOverview(previous.overview);
          }
          setError(null);
        }
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setError("Failed to load analytics");
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        setLoading(false);
        setSwitching(false);
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10">
        <LoadingSkeleton />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <p className="text-sm text-red-600">
            {error || "No data available"}
          </p>
        </div>
      </div>
    );
  }

  const { overview, per_offering, revenue_timeline, recent_payments } = data;

  const prevRev = prevOverview
    ? pctChange(overview.total_revenue_cents, prevOverview.total_revenue_cents)
    : null;
  const prevMrr = prevOverview
    ? pctChange(overview.mrr_cents, prevOverview.mrr_cents)
    : null;
  const prevCust = prevOverview
    ? pctChange(overview.total_customers, prevOverview.total_customers)
    : null;
  const prevExec = prevOverview
    ? pctChange(overview.total_executions, prevOverview.total_executions)
    : null;

  const chartData = revenue_timeline.map((d) => ({
    date: new Date(d.date + "T12:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    Revenue: d.revenue_cents / 100,
  }));

  const hasRevenue =
    overview.total_revenue_cents > 0 ||
    overview.total_customers > 0 ||
    overview.total_executions > 0;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="space-y-6"
      >
        {/* ── Header ── */}
        <motion.div
          variants={fadeUp}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">
              Revenue
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Track earnings across all portals and products
            </p>
          </div>
          <PeriodSelector
            value={period}
            onChange={setPeriod}
            loading={switching}
          />
        </motion.div>

        {/* ── Metrics (left-border accent cards) ── */}
        <motion.div
          variants={stagger}
          className={`grid grid-cols-2 gap-3 lg:grid-cols-4 ${switching ? "pointer-events-none opacity-60" : ""}`}
          style={{ transition: "opacity 0.2s ease" }}
        >
          <MetricCard
            icon={DollarSign}
            label="Total revenue"
            value={formatCents(overview.total_revenue_cents)}
            change={prevRev}
            accentKey="revenue"
          />
          <MetricCard
            icon={TrendingUp}
            label="Monthly recurring"
            value={formatCents(overview.mrr_cents)}
            change={prevMrr}
            accentKey="mrr"
          />
          <MetricCard
            icon={Users}
            label="Customers"
            value={String(overview.total_customers)}
            change={prevCust}
            accentKey="customers"
          />
          <MetricCard
            icon={Zap}
            label="Executions"
            value={overview.total_executions.toLocaleString()}
            change={prevExec}
            accentKey="executions"
          />
        </motion.div>

        {/* ── Revenue Chart ── */}
        {chartData.length > 1 && (
          <motion.div
            variants={fadeUp}
            className="overflow-hidden rounded-lg border border-gray-200 bg-white p-5"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-medium text-slate-900">
                Revenue over time
              </h2>
              <ChartTabs value={chartMode} onChange={setChartMode} />
            </div>
            <AreaChart
              className="h-56"
              data={chartData}
              index="date"
              categories={["Revenue"]}
              colors={["blue"]}
              valueFormatter={(v: number) =>
                `$${Intl.NumberFormat("us").format(v)}`
              }
              yAxisWidth={56}
              showAnimation={true}
              curveType="monotone"
              showGridLines={false}
              showLegend={false}
            />
          </motion.div>
        )}

        {/* ── Main Content ── */}
        {hasRevenue ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            {/* Left: Offerings */}
            <motion.div variants={fadeUp}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-medium text-slate-900">
                  Portal and product revenue
                </h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                  {per_offering.length} active
                </span>
              </div>
              {per_offering.length > 0 ? (
                <div className="space-y-2">
                  {per_offering.map((o) => (
                    <OfferingRow key={o.portal_id} offering={o} />
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-gray-200 bg-white p-10 text-center">
                  <EmptyRevenue />
                </div>
              )}
            </motion.div>

            {/* Right: Payments + Stats */}
            <motion.div variants={fadeUp} className="space-y-4">
              {/* Recent Payments */}
              <div>
                <h2 className="mb-3 text-sm font-medium text-slate-900">
                  Recent payments
                </h2>
                <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                  {recent_payments.length === 0 ? (
                    <div className="px-4 py-10 text-center">
                      <CreditCard className="mx-auto h-5 w-5 text-slate-300" />
                      <p className="mt-2 text-xs font-medium text-slate-500">
                        No payments yet
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        Payments will appear here in real time
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="divide-y divide-gray-100">
                        {recent_payments.map((p, i) => (
                          <PaymentRow key={i} payment={p} />
                        ))}
                      </div>
                      <div className="flex items-center gap-2 border-t border-gray-100 px-3.5 py-2">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Updated in real-time
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Quick Stats */}
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <h3 className="mb-1 text-xs font-medium text-slate-900">
                  Quick stats
                </h3>
                <div className="divide-y divide-gray-100">
                  <StatRow
                    label="Active subscriptions"
                    value={String(overview.active_subscriptions)}
                  />
                  <StatRow
                    label="Avg revenue / customer"
                    value={formatCents(
                      Math.round(
                        overview.total_revenue_cents /
                          Math.max(overview.total_customers, 1)
                      )
                    )}
                  />
                  <StatRow
                    label="Avg runs / customer"
                    value={String(
                      Math.round(
                        overview.total_executions /
                          Math.max(overview.total_customers, 1)
                      )
                    )}
                  />
                  <StatRow
                    label="Revenue / execution"
                    value={formatCents(
                      Math.round(
                        overview.total_revenue_cents /
                          Math.max(overview.total_executions, 1)
                      )
                    )}
                  />
                </div>
              </div>
            </motion.div>
          </div>
        ) : (
          <motion.div
            variants={scaleIn}
            className="rounded-lg border border-gray-200 bg-white"
          >
            <EmptyRevenue />
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
