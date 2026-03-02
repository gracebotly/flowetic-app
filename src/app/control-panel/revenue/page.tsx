"use client";

import { useEffect, useState } from "react";
import { DollarSign, Users, TrendingUp, Zap, Loader2 } from "lucide-react";

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
  recent_payments: PaymentEvent[];
}

const PRICING_LABELS: Record<string, string> = {
  free: "Free",
  per_run: "Per Run",
  monthly: "Monthly",
  usage_based: "Usage",
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function RevenuePage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState("30d");

  useEffect(() => {
    fetch(`/api/offerings/analytics?period=${period}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.error) {
          setError(json.error);
        } else {
          setData(json);
          setError(null);
        }
      })
      .catch(() => setError("Failed to load analytics"))
      .finally(() => setLoading(false));
  }, [period]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-600">{error || "No data available"}</p>
      </div>
    );
  }

  const { overview, per_offering, recent_payments } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Revenue</h1>
          <p className="mt-1 text-sm text-gray-500">Track your earnings across all offerings</p>
        </div>
        <select
          value={period}
          onChange={(e) => {
            setLoading(true);
            setPeriod(e.target.value);
          }}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm"
        >
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard icon={DollarSign} label="Total Revenue" value={formatCents(overview.total_revenue_cents)} color="emerald" />
        <MetricCard icon={TrendingUp} label="MRR" value={formatCents(overview.mrr_cents)} color="blue" />
        <MetricCard icon={Users} label="Customers" value={String(overview.total_customers)} color="purple" />
        <MetricCard icon={Zap} label="Executions" value={String(overview.total_executions)} color="amber" />
      </div>

      {per_offering.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Offering Performance</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-medium uppercase tracking-wider text-gray-400">
                  <th className="px-5 py-3">Offering</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3 text-right">Revenue</th>
                  <th className="px-5 py-3 text-right">Customers</th>
                  <th className="px-5 py-3 text-right">Executions</th>
                </tr>
              </thead>
              <tbody>
                {per_offering.map((o) => (
                  <tr key={o.offering_id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-5 py-3 font-medium text-gray-900">{o.offering_name}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{PRICING_LABELS[o.pricing_type] || o.pricing_type}</span>
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-gray-900">{formatCents(o.revenue_cents)}</td>
                    <td className="px-5 py-3 text-right text-gray-600">{o.customers}</td>
                    <td className="px-5 py-3 text-right text-gray-600">{o.executions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {recent_payments.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Recent Payments</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {recent_payments.map((p, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{p.customer_email}</p>
                  <p className="text-xs text-gray-500">{p.offering_name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-emerald-600">{formatCents(p.amount_cents)}</p>
                  <p className="text-xs text-gray-400">{p.paid_at ? timeAgo(p.paid_at) : ""}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {per_offering.length === 0 && recent_payments.length === 0 && (
        <div className="flex flex-col items-center rounded-xl border border-gray-200 bg-white py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
            <DollarSign className="h-7 w-7 text-gray-400" />
          </div>
          <h3 className="mt-4 text-sm font-semibold text-gray-900">No revenue yet</h3>
          <p className="mt-1 max-w-sm text-sm text-gray-500">Publish a paid offering and share it with customers to start earning.</p>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-600",
    blue: "bg-blue-50 text-blue-600",
    purple: "bg-purple-50 text-purple-600",
    amber: "bg-amber-50 text-amber-600",
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${colorMap[color]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-3 text-2xl font-bold text-gray-900">{value}</p>
      <p className="mt-0.5 text-xs font-medium text-gray-500">{label}</p>
    </div>
  );
}
