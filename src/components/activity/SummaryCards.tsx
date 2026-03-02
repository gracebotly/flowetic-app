"use client";

import { Users, Activity, CheckCircle, DollarSign } from "lucide-react";
import { SparklineChart } from "@/components/activity/SparklineChart";

interface SummaryData {
  active_clients: number;
  events_today: number;
  success_rate: number;
  revenue_today: number;
  sparkline: { date: string; count: number }[];
}

interface SummaryCardsProps {
  data: SummaryData | null;
  loading: boolean;
}

const COLOR_MAP: Record<string, string> = {
  emerald: "bg-emerald-50 text-emerald-600",
  blue: "bg-blue-50 text-blue-600",
  amber: "bg-amber-50 text-amber-600",
  purple: "bg-purple-50 text-purple-600",
};

function MetricCard({
  icon: Icon,
  label,
  value,
  color,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: string;
  loading: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div
        className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${COLOR_MAP[color] ?? COLOR_MAP.blue}`}
      >
        <Icon className="h-4 w-4" />
      </div>
      {loading ? (
        <div className="mt-3 h-8 w-16 animate-pulse rounded bg-gray-100" />
      ) : (
        <p className="mt-3 text-2xl font-bold text-gray-900">{value}</p>
      )}
      <p className="mt-0.5 text-xs font-medium text-gray-500">{label}</p>
    </div>
  );
}

export function SummaryCards({ data, loading }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      <MetricCard
        icon={Users}
        label="Active Clients"
        value={String(data?.active_clients ?? 0)}
        color="blue"
        loading={loading}
      />
      <MetricCard
        icon={Activity}
        label="Events Today"
        value={String(data?.events_today ?? 0)}
        color="emerald"
        loading={loading}
      />
      <MetricCard
        icon={CheckCircle}
        label="Success Rate"
        value={`${data?.success_rate ?? 100}%`}
        color="amber"
        loading={loading}
      />
      <MetricCard
        icon={DollarSign}
        label="Revenue Today"
        value={`$${((data?.revenue_today ?? 0) / 100).toFixed(2)}`}
        color="purple"
        loading={loading}
      />

      {/* Sparkline card takes the 5th column */}
      <div className="col-span-2 rounded-xl border border-gray-200 bg-white p-5 lg:col-span-1">
        <p className="text-xs font-medium text-gray-500">7-Day Trend</p>
        {loading ? (
          <div className="mt-3 h-12 animate-pulse rounded bg-gray-100" />
        ) : (
          <div className="mt-2">
            <SparklineChart data={data?.sparkline ?? []} />
          </div>
        )}
      </div>
    </div>
  );
}
