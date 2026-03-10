"use client";

import { useEffect, useState, type ComponentType } from "react";
import {
  DollarSign,
  TrendingUp,
  Users,
  Zap,
  Loader2,
  BarChart3,
  CreditCard,
  Activity,
  Eye,
  Clock,
  ArrowRight,
} from "lucide-react";
import {
  Card,
  AreaChart,
  BadgeDelta,
  Badge,
  SparkAreaChart,
} from "@tremor/react";
import { motion } from "framer-motion";
import type { DeltaType } from "@tremor/react";

interface RevenueOverview {
  total_revenue_cents: number;
  total_customers: number;
  active_subscriptions: number;
  total_executions: number;
  mrr_cents: number;
}

interface OfferingRevenue {
  offering_id: string;
  offering_name: string;
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
  offering_name: string;
  amount_cents: number;
  paid_at: string;
}

interface AnalyticsData {
  overview: RevenueOverview;
  per_offering: OfferingRevenue[];
  revenue_timeline: TimelinePoint[];
  recent_payments: PaymentEvent[];
}

const PRICING_LABELS: Record<string, string> = {
  free: "Free",
  per_run: "Per Run",
  monthly: "Monthly",
  usage_based: "Usage",
};

const PRICING_COLORS: Record<string, string> = {
  free: "gray",
  per_run: "violet",
  monthly: "blue",
  usage_based: "amber",
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getDeltaType(change: number | null): DeltaType {
  if (change === null) return "unchanged";
  if (change > 20) return "increase";
  if (change > 0) return "moderateIncrease";
  if (change === 0) return "unchanged";
  if (change > -20) return "moderateDecrease";
  return "decrease";
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

function periodToDays(period: string): number {
  if (period === "7d") return 7;
  if (period === "90d") return 90;
  return 30;
}

const stagger = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

function SurfaceIcon({ type }: { type: string }) {
  switch (type) {
    case "analytics":
      return <BarChart3 className="h-3.5 w-3.5" />;
    case "runner":
      return <Zap className="h-3.5 w-3.5" />;
    case "both":
      return (
        <span className="flex items-center gap-0.5">
          <BarChart3 className="h-3 w-3" />
          <Zap className="h-3 w-3" />
        </span>
      );
    default:
      return <BarChart3 className="h-3.5 w-3.5" />;
  }
}

const SURFACE_LABELS: Record<string, string> = {
  analytics: "Portal",
  runner: "Product",
  both: "Portal + Product",
};

function MetricCard({
  icon: Icon,
  label,
  value,
  change,
  sparkData,
  iconColor,
  sparkColor,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  change: number | null;
  sparkData?: { idx: string; value: number }[];
  iconColor: string;
  sparkColor: "emerald" | "blue" | "violet" | "amber";
}) {
  return (
    <Card className="cursor-default transition-shadow duration-200 hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconColor}`}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-tremor-default font-medium text-tremor-content dark:text-dark-tremor-content">
              {label}
            </p>
            <p className="mt-0.5 text-2xl font-bold tracking-tight text-tremor-content-strong dark:text-dark-tremor-content-strong">
              {value}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {change !== null && (
            <BadgeDelta
              deltaType={getDeltaType(change)}
              isIncreasePositive={true}
              size="xs"
            >
              {change >= 0 ? "+" : ""}
              {change}%
            </BadgeDelta>
          )}
          {sparkData && sparkData.length > 1 && (
            <SparkAreaChart
              data={sparkData}
              categories={["value"]}
              index="idx"
              colors={[sparkColor]}
              className="h-8 w-20"
              curveType="monotone"
            />
          )}
        </div>
      </div>
    </Card>
  );
}

function OfferingCard({ offering }: { offering: OfferingRevenue }) {
  const pricingLabel =
    PRICING_LABELS[offering.pricing_type] || offering.pricing_type;
  const pricingColor = PRICING_COLORS[offering.pricing_type] || "gray";
  const surfaceLabel =
    SURFACE_LABELS[offering.surface_type || "analytics"] || "Portal";
  const days = daysSince(offering.published_at);
  const revenuePerDay =
    days && days > 0 ? Math.round(offering.revenue_cents / days) : null;
  const views = offering.view_count || 0;
  const conversionRate =
    views > 0 ? ((offering.customers / views) * 100).toFixed(1) : null;

  return (
    <Card className="cursor-pointer transition-all duration-200 hover:border-tremor-brand hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-tremor-default font-semibold text-tremor-content-strong dark:text-dark-tremor-content-strong">
            {offering.offering_name}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge size="xs" color={pricingColor as "gray"}>
              {pricingLabel}
            </Badge>
            <Badge size="xs" color="gray">
              <span className="flex items-center gap-1">
                <SurfaceIcon type={offering.surface_type || "analytics"} />
                {surfaceLabel}
              </span>
            </Badge>
          </div>
        </div>
        <p className="flex-shrink-0 text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
          {formatCents(offering.revenue_cents)}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-0 rounded-tremor-default bg-tremor-background-subtle p-3 dark:bg-dark-tremor-background-subtle">
        <div>
          <p className="text-base font-bold text-tremor-content-strong dark:text-dark-tremor-content-strong">
            {offering.customers}
          </p>
          <p className="text-xs font-medium text-tremor-content dark:text-dark-tremor-content">
            Customers
          </p>
        </div>
        <div className="border-l border-tremor-border pl-3 dark:border-dark-tremor-border">
          <p className="text-base font-bold text-tremor-content-strong dark:text-dark-tremor-content-strong">
            {offering.executions.toLocaleString()}
          </p>
          <p className="text-xs font-medium text-tremor-content dark:text-dark-tremor-content">
            Runs
          </p>
        </div>
        <div className="border-l border-tremor-border pl-3 dark:border-dark-tremor-border">
          <p className="text-base font-bold text-tremor-content-strong dark:text-dark-tremor-content-strong">
            {views.toLocaleString()}
          </p>
          <p className="text-xs font-medium text-tremor-content dark:text-dark-tremor-content">
            Views
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-tremor-content dark:text-dark-tremor-content">
          {days !== null && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Live {days}d
            </span>
          )}
          {revenuePerDay !== null && (
            <span className="font-medium text-tremor-content-emphasis dark:text-dark-tremor-content-emphasis">
              {formatCents(revenuePerDay)}/day
            </span>
          )}
        </div>
        {conversionRate && (
          <Badge
            size="xs"
            color={
              parseFloat(conversionRate) >= 3
                ? "emerald"
                : parseFloat(conversionRate) >= 1
                  ? "amber"
                  : "red"
            }
          >
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {conversionRate}% conversion
            </span>
          </Badge>
        )}
      </div>
    </Card>
  );
}

export default function RevenuePage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [prevOverview, setPrevOverview] = useState<RevenueOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState("30d");

  useEffect(() => {
    const days = periodToDays(period);
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - days);

    const currentFetch = fetch(
      `/api/client-portals/analytics?period=${period}`
    ).then((r) => r.json());

    const prevFetch = fetch(
      `/api/client-portals/analytics?period=${period}&before=${periodStart.toISOString()}`
    )
      .then((r) => r.json())
      .catch(() => null);

    Promise.all([currentFetch, prevFetch])
      .then(([current, previous]) => {
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
      .catch(() => setError("Failed to load analytics"))
      .finally(() => setLoading(false));
  }, [period]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-tremor-content" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card className="text-center">
        <p className="text-sm text-red-600 dark:text-red-400">
          {error || "No data available"}
        </p>
      </Card>
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

  const sparkData = revenue_timeline.map((d, i) => ({
    idx: String(i),
    value: d.revenue_cents / 100,
  }));

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      <motion.div
        variants={fadeUp}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-xl font-bold text-tremor-content-strong dark:text-dark-tremor-content-strong">
            Revenue
          </h1>
          <p className="mt-1 text-sm text-tremor-content dark:text-dark-tremor-content">
            Track your earnings across all portals and products
          </p>
        </div>
        <div className="flex rounded-tremor-default border border-tremor-border bg-tremor-background p-1 dark:border-dark-tremor-border dark:bg-dark-tremor-background">
          {(["7d", "30d", "90d"] as const).map((p) => (
            <button
              key={p}
              onClick={() => {
                if (p !== period) {
                  setLoading(true);
                  setError(null);
                  setPeriod(p);
                }
              }}
              className={`cursor-pointer rounded-tremor-small px-4 py-1.5 text-sm font-medium transition-colors duration-200 ${
                period === p
                  ? "bg-tremor-background-subtle text-tremor-content-strong dark:bg-dark-tremor-background-subtle dark:text-dark-tremor-content-strong"
                  : "text-tremor-content hover:text-tremor-content-emphasis dark:text-dark-tremor-content dark:hover:text-dark-tremor-content-emphasis"
              }`}
            >
              {p === "7d" ? "7 days" : p === "30d" ? "30 days" : "90 days"}
            </button>
          ))}
        </div>
      </motion.div>

      <motion.div
        variants={fadeUp}
        className="grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        <MetricCard
          icon={DollarSign}
          label="Total Revenue"
          value={formatCents(overview.total_revenue_cents)}
          change={prevRev}
          sparkData={sparkData}
          iconColor="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
          sparkColor="emerald"
        />
        <MetricCard
          icon={TrendingUp}
          label="Monthly Recurring"
          value={formatCents(overview.mrr_cents)}
          change={prevMrr}
          iconColor="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          sparkColor="blue"
        />
        <MetricCard
          icon={Users}
          label="Customers"
          value={String(overview.total_customers)}
          change={prevCust}
          iconColor="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
          sparkColor="violet"
        />
        <MetricCard
          icon={Zap}
          label="Executions"
          value={overview.total_executions.toLocaleString()}
          change={prevExec}
          iconColor="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
          sparkColor="amber"
        />
      </motion.div>

      {chartData.length > 1 && (
        <motion.div variants={fadeUp}>
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-tremor-default font-semibold text-tremor-content-strong dark:text-dark-tremor-content-strong">
                  Revenue Over Time
                </h2>
                <p className="mt-0.5 text-xs text-tremor-content dark:text-dark-tremor-content">
                  Daily revenue for the selected period
                </p>
              </div>
              <p className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                {formatCents(overview.total_revenue_cents)}
              </p>
            </div>
            <AreaChart
              className="h-60"
              data={chartData}
              index="date"
              categories={["Revenue"]}
              colors={["emerald"]}
              valueFormatter={(v: number) => `$${Intl.NumberFormat("us").format(v)}`}
              yAxisWidth={56}
              showAnimation={true}
              curveType="monotone"
            />
          </Card>
        </motion.div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <motion.div variants={fadeUp}>
          <div className="mb-4 flex items-center justify-between px-1">
            <h2 className="text-tremor-default font-semibold text-tremor-content-strong dark:text-dark-tremor-content-strong">
              Portal & Product Revenue
            </h2>
            <span className="text-xs text-tremor-content dark:text-dark-tremor-content">
              {per_offering.length} active
            </span>
          </div>
          {per_offering.length > 0 ? (
            <div className="space-y-3">
              {per_offering.map((o) => (
                <OfferingCard key={o.offering_id} offering={o} />
              ))}
            </div>
          ) : (
            <Card className="py-16 text-center">
              <div className="flex flex-col items-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-tremor-background-subtle dark:bg-dark-tremor-background-subtle">
                  <DollarSign className="h-7 w-7 text-tremor-content dark:text-dark-tremor-content" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-tremor-content-strong dark:text-dark-tremor-content-strong">
                  No revenue yet
                </h3>
                <p className="mt-1 max-w-xs text-sm text-tremor-content dark:text-dark-tremor-content">
                  Publish a paid portal or product and share it with customers
                  to start earning.
                </p>
              </div>
            </Card>
          )}
        </motion.div>

        <motion.div variants={fadeUp} className="space-y-4">
          <div>
            <h2 className="mb-4 px-1 text-tremor-default font-semibold text-tremor-content-strong dark:text-dark-tremor-content-strong">
              Recent Payments
            </h2>
            <Card className="overflow-hidden !p-0">
              {recent_payments.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <CreditCard className="mx-auto h-8 w-8 text-tremor-content dark:text-dark-tremor-content" />
                  <p className="mt-2 text-sm text-tremor-content dark:text-dark-tremor-content">
                    No payments yet
                  </p>
                </div>
              ) : (
                <>
                  <div className="divide-y divide-tremor-border dark:divide-dark-tremor-border">
                    {recent_payments.map((p, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between px-5 py-3.5 transition-colors duration-150 hover:bg-tremor-background-subtle dark:hover:bg-dark-tremor-background-subtle"
                      >
                        <div className="min-w-0 flex items-center gap-3">
                          <div
                            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold"
                            style={{
                              backgroundColor: `hsl(${(p.customer_email.charCodeAt(0) * 37) % 360}, 45%, 90%)`,
                              color: `hsl(${(p.customer_email.charCodeAt(0) * 37) % 360}, 50%, 35%)`,
                            }}
                          >
                            {p.customer_email[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-tremor-content-strong dark:text-dark-tremor-content-strong">
                              {p.customer_email}
                            </p>
                            <p className="text-xs text-tremor-content dark:text-dark-tremor-content">
                              {p.offering_name}
                            </p>
                          </div>
                        </div>
                        <div className="ml-3 flex-shrink-0 text-right">
                          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                            +{formatCents(p.amount_cents)}
                          </p>
                          <p className="text-[11px] text-tremor-content dark:text-dark-tremor-content">
                            {timeAgo(p.paid_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 border-t border-tremor-border px-5 py-2.5 dark:border-dark-tremor-border">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                    </span>
                    <span className="text-[11px] text-tremor-content dark:text-dark-tremor-content">
                      Updated in real-time
                    </span>
                  </div>
                </>
              )}
            </Card>
          </div>

          <Card>
            <h3 className="mb-3 text-sm font-semibold text-tremor-content-strong dark:text-dark-tremor-content-strong">
              Quick Stats
            </h3>
            <div className="space-y-3">
              {[
                {
                  icon: Activity,
                  label: "Active Subscriptions",
                  value: String(overview.active_subscriptions),
                },
                {
                  icon: Users,
                  label: "Avg Revenue / Customer",
                  value: formatCents(
                    Math.round(
                      overview.total_revenue_cents /
                        Math.max(overview.total_customers, 1)
                    )
                  ),
                },
                {
                  icon: Zap,
                  label: "Avg Runs / Customer",
                  value: String(
                    Math.round(
                      overview.total_executions /
                        Math.max(overview.total_customers, 1)
                    )
                  ),
                },
                {
                  icon: ArrowRight,
                  label: "Revenue / Execution",
                  value: formatCents(
                    Math.round(
                      overview.total_revenue_cents /
                        Math.max(overview.total_executions, 1)
                    )
                  ),
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="flex items-center gap-2 text-tremor-content dark:text-dark-tremor-content">
                    <stat.icon className="h-4 w-4" />
                    {stat.label}
                  </span>
                  <span className="font-semibold text-tremor-content-strong dark:text-dark-tremor-content-strong">
                    {stat.value}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
