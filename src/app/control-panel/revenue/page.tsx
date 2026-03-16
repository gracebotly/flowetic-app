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
  BarChart3,
  Rocket,
} from "lucide-react";
import { AreaChart } from "@tremor/react";
import { motion, AnimatePresence } from "framer-motion";

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
  if (val >= 1000) return `$${(val / 1000).toFixed(1)}k`;
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

/* ─── Animation variants ─── */

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.95 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

/* ─── Period Selector (segmented control) ─── */

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
    <div className="relative flex items-center rounded-xl bg-gray-100 p-1">
      {PERIODS.map((p) => (
        <button
          key={p.key}
          onClick={() => onChange(p.key)}
          disabled={loading && value !== p.key}
          className={`relative z-10 rounded-lg px-4 py-2 text-sm font-semibold transition-colors duration-200 ${
            value === p.key
              ? "text-gray-900"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {p.label}
          {value === p.key && (
            <motion.div
              layoutId="period-pill"
              className="absolute inset-0 rounded-lg bg-white shadow-sm"
              style={{ zIndex: -1 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}
        </button>
      ))}
    </div>
  );
}

/* ─── Metric Card ─── */

function MetricCard({
  icon: Icon,
  label,
  value,
  change,
  gradient,
  delay = 0,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  change: number | null;
  gradient: string;
  delay?: number;
}) {
  return (
    <motion.div
      variants={fadeUp}
      custom={delay}
      className="group relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm transition-shadow duration-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <div>
          <div
            className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl ${gradient}`}
          >
            <Icon className="h-5 w-5 text-white" />
          </div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-gray-900">
            {value}
          </p>
        </div>
        {change !== null && (
          <div
            className={`mt-1 flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
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
          </div>
        )}
      </div>
      {/* Decorative gradient orb */}
      <div
        className={`absolute -bottom-6 -right-6 h-24 w-24 rounded-full opacity-[0.07] blur-2xl ${gradient}`}
      />
    </motion.div>
  );
}

/* ─── Offering Row ─── */

function OfferingRow({ offering }: { offering: OfferingRevenue }) {
  const pricingLabel =
    PRICING_LABELS[offering.pricing_type] || offering.pricing_type;
  const surfaceLabel =
    SURFACE_LABELS[offering.surface_type || "analytics"] || "Portal";
  const days = daysSince(offering.published_at);
  const views = offering.view_count || 0;
  const conversionRate =
    views > 0 ? ((offering.customers / views) * 100).toFixed(1) : null;

  return (
    <div className="group flex items-center justify-between rounded-xl bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-md">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-gray-900">
            {offering.portal_name}
          </h3>
          <span className="shrink-0 rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            {surfaceLabel}
          </span>
        </div>
        <div className="mt-1.5 flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {offering.customers} customer{offering.customers !== 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3" />
            {offering.executions.toLocaleString()} run
            {offering.executions !== 1 ? "s" : ""}
          </span>
          {views > 0 && (
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {views.toLocaleString()} view{views !== 1 ? "s" : ""}
            </span>
          )}
          {days !== null && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {days}d live
            </span>
          )}
          {conversionRate && (
            <span className="font-medium text-emerald-600">
              {conversionRate}% conv.
            </span>
          )}
        </div>
      </div>
      <div className="ml-4 text-right">
        <p className="text-lg font-bold text-gray-900">
          {formatCents(offering.revenue_cents)}
        </p>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
            offering.pricing_type === "monthly"
              ? "bg-blue-50 text-blue-600"
              : offering.pricing_type === "per_run"
                ? "bg-violet-50 text-violet-600"
                : offering.pricing_type === "usage_based"
                  ? "bg-amber-50 text-amber-600"
                  : "bg-gray-100 text-gray-500"
          }`}
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
  const hue = (payment.customer_email.charCodeAt(0) * 37) % 360;
  return (
    <div className="flex items-center justify-between px-5 py-3.5 transition-colors duration-150 hover:bg-gray-50">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold"
          style={{
            background: `linear-gradient(135deg, hsl(${hue}, 60%, 88%), hsl(${hue + 30}, 55%, 82%))`,
            color: `hsl(${hue}, 50%, 35%)`,
          }}
        >
          {initial}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">
            {payment.customer_email}
          </p>
          <p className="text-xs text-gray-500">{payment.portal_name}</p>
        </div>
      </div>
      <div className="ml-3 shrink-0 text-right">
        <p className="text-sm font-bold text-emerald-600">
          +{formatCents(payment.amount_cents)}
        </p>
        <p className="text-[11px] text-gray-400">{timeAgo(payment.paid_at)}</p>
      </div>
    </div>
  );
}

/* ─── Stat Row ─── */

function StatRow({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="flex items-center gap-2.5 text-sm text-gray-500">
        <Icon className="h-4 w-4 text-gray-400" />
        {label}
      </span>
      <span className="text-sm font-semibold text-gray-900">{value}</span>
    </div>
  );
}

/* ─── Skeleton loader ─── */

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-3 h-10 w-10 rounded-xl bg-gray-100" />
      <div className="h-3 w-20 rounded bg-gray-100" />
      <div className="mt-2 h-7 w-24 rounded bg-gray-100" />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-32 animate-pulse rounded-lg bg-gray-100" />
          <div className="mt-2 h-4 w-64 animate-pulse rounded bg-gray-100" />
        </div>
        <div className="h-10 w-56 animate-pulse rounded-xl bg-gray-100" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <div className="h-72 animate-pulse rounded-2xl bg-white shadow-sm" />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="h-48 animate-pulse rounded-2xl bg-white shadow-sm" />
        <div className="h-48 animate-pulse rounded-2xl bg-white shadow-sm" />
      </div>
    </div>
  );
}

/* ─── Empty State ─── */

function EmptyRevenue() {
  return (
    <div className="flex flex-col items-center py-20 text-center">
      <div className="relative mb-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-100 to-teal-50">
          <Rocket className="h-9 w-9 text-emerald-600" />
        </div>
        <div className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg">
          <DollarSign className="h-3 w-3" />
        </div>
      </div>
      <h3 className="text-lg font-bold text-gray-900">
        Your revenue dashboard is ready
      </h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-gray-500">
        Publish a paid portal or product and share it with customers.
        Revenue, payments, and analytics will appear here in real time.
      </p>
      <a
        href="/control-panel/client-portals/create"
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-gray-800 hover:shadow-md"
      >
        Create your first portal
        <ArrowRight className="h-4 w-4" />
      </a>
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
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Cancel any in-flight request
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

  /* ── Loading state: skeleton, not spinner ── */
  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-1">
        <LoadingSkeleton />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-6xl px-1">
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
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
    <div className="mx-auto max-w-6xl px-1">
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
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Revenue
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Track your earnings across all portals and products
            </p>
          </div>
          <PeriodSelector
            value={period}
            onChange={setPeriod}
            loading={switching}
          />
        </motion.div>

        {/* ── Metrics ── */}
        <motion.div
          variants={stagger}
          className={`grid grid-cols-2 gap-4 lg:grid-cols-4 ${switching ? "pointer-events-none opacity-60" : ""}`}
          style={{ transition: "opacity 0.2s ease" }}
        >
          <MetricCard
            icon={DollarSign}
            label="Total Revenue"
            value={formatCents(overview.total_revenue_cents)}
            change={prevRev}
            gradient="bg-gradient-to-br from-emerald-500 to-teal-600"
          />
          <MetricCard
            icon={TrendingUp}
            label="Monthly Recurring"
            value={formatCents(overview.mrr_cents)}
            change={prevMrr}
            gradient="bg-gradient-to-br from-blue-500 to-indigo-600"
            delay={0.04}
          />
          <MetricCard
            icon={Users}
            label="Customers"
            value={String(overview.total_customers)}
            change={prevCust}
            gradient="bg-gradient-to-br from-violet-500 to-purple-600"
            delay={0.08}
          />
          <MetricCard
            icon={Zap}
            label="Executions"
            value={overview.total_executions.toLocaleString()}
            change={prevExec}
            gradient="bg-gradient-to-br from-amber-500 to-orange-600"
            delay={0.12}
          />
        </motion.div>

        {/* ── Revenue Chart ── */}
        {chartData.length > 1 && (
          <motion.div
            variants={fadeUp}
            className="overflow-hidden rounded-2xl bg-white p-6 shadow-sm"
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  Revenue Over Time
                </h2>
                <p className="mt-0.5 text-xs text-gray-500">
                  Daily revenue for the selected period
                </p>
              </div>
              <p className="text-xl font-bold tracking-tight text-emerald-600">
                {formatCents(overview.total_revenue_cents)}
              </p>
            </div>
            <AreaChart
              className="h-64"
              data={chartData}
              index="date"
              categories={["Revenue"]}
              colors={["emerald"]}
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
          <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
            {/* Left: Offerings */}
            <motion.div variants={fadeUp}>
              <div className="mb-4 flex items-center justify-between px-1">
                <h2 className="text-base font-semibold text-gray-900">
                  Portal & Product Revenue
                </h2>
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
                  {per_offering.length} active
                </span>
              </div>
              {per_offering.length > 0 ? (
                <div className="space-y-3">
                  {per_offering.map((o) => (
                    <OfferingRow key={o.portal_id} offering={o} />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl bg-white p-12 text-center shadow-sm">
                  <EmptyRevenue />
                </div>
              )}
            </motion.div>

            {/* Right: Payments + Stats */}
            <motion.div variants={fadeUp} className="space-y-4">
              {/* Recent Payments */}
              <div>
                <h2 className="mb-4 px-1 text-base font-semibold text-gray-900">
                  Recent Payments
                </h2>
                <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
                  {recent_payments.length === 0 ? (
                    <div className="px-5 py-14 text-center">
                      <CreditCard className="mx-auto h-8 w-8 text-gray-300" />
                      <p className="mt-3 text-sm font-medium text-gray-500">
                        No payments yet
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
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
                      <div className="flex items-center gap-2 border-t border-gray-100 px-5 py-2.5">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                        </span>
                        <span className="text-[11px] text-gray-400">
                          Updated in real-time
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Quick Stats */}
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <h3 className="mb-2 text-sm font-semibold text-gray-900">
                  Quick Stats
                </h3>
                <div className="divide-y divide-gray-100">
                  <StatRow
                    icon={Activity}
                    label="Active Subscriptions"
                    value={String(overview.active_subscriptions)}
                  />
                  <StatRow
                    icon={Users}
                    label="Avg Revenue / Customer"
                    value={formatCents(
                      Math.round(
                        overview.total_revenue_cents /
                          Math.max(overview.total_customers, 1)
                      )
                    )}
                  />
                  <StatRow
                    icon={Zap}
                    label="Avg Runs / Customer"
                    value={String(
                      Math.round(
                        overview.total_executions /
                          Math.max(overview.total_customers, 1)
                      )
                    )}
                  />
                  <StatRow
                    icon={ArrowRight}
                    label="Revenue / Execution"
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
            className="rounded-2xl bg-white shadow-sm"
          >
            <EmptyRevenue />
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
