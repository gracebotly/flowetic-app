'use client';

import { type LucideIcon } from 'lucide-react';
import { SparkAreaChart } from '@tremor/react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Info } from 'lucide-react';

export interface MetricKPI {
  label: string;
  value: string;
  sublabel?: string;
  icon: LucideIcon;
  accent: '' | 'green' | 'amber' | 'red' | 'blue';
  sparkData?: { idx: string; value: number }[];
  sparkColor?: string;
  tooltip?: string;
}

interface MetricsBarProps {
  kpis: MetricKPI[];
}

function getAccentStyles(accent: MetricKPI['accent']) {
  if (accent === 'red') {
    return {
      border: 'border-red-200',
      bg: 'bg-red-50/60',
      icon: 'text-red-500',
      value: 'text-red-700',
      sparkColor: 'rose',
    };
  }

  if (accent === 'amber') {
    return {
      border: 'border-amber-200',
      bg: 'bg-amber-50/60',
      icon: 'text-amber-500',
      value: 'text-amber-700',
      sparkColor: 'amber',
    };
  }

  if (accent === 'green') {
    return {
      border: 'border-emerald-200',
      bg: 'bg-emerald-50/60',
      icon: 'text-emerald-500',
      value: 'text-emerald-700',
      sparkColor: 'emerald',
    };
  }

  if (accent === 'blue') {
    return {
      border: 'border-blue-200',
      bg: 'bg-blue-50/60',
      icon: 'text-blue-500',
      value: 'text-blue-700',
      sparkColor: 'blue',
    };
  }

  return {
    border: 'border-gray-100',
    bg: 'bg-gray-50/50',
    icon: 'text-gray-400',
    value: 'text-gray-900',
    sparkColor: 'slate',
  };
}

export function MetricsBar({ kpis }: MetricsBarProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {kpis.map((kpi) => {
        const styles = getAccentStyles(kpi.accent);
        const chartColor = kpi.sparkColor ?? styles.sparkColor;

        return (
          <div key={kpi.label} className={`rounded-lg border ${styles.border} ${styles.bg} p-3`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5 text-xs text-gray-400">
                <kpi.icon className={`h-3 w-3 shrink-0 ${styles.icon}`} />
                <span className="truncate">{kpi.label}</span>
                {kpi.tooltip ? (
                  <Tooltip.Provider delayDuration={120}>
                    <Tooltip.Root>
                      <Tooltip.Trigger asChild>
                        <button type="button" className="cursor-pointer text-gray-400 transition-colors duration-200 hover:text-gray-600">
                          <Info className="h-3 w-3" />
                        </button>
                      </Tooltip.Trigger>
                      <Tooltip.Portal>
                        <Tooltip.Content className="rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-lg" sideOffset={5}>
                          {kpi.tooltip}
                        </Tooltip.Content>
                      </Tooltip.Portal>
                    </Tooltip.Root>
                  </Tooltip.Provider>
                ) : null}
              </div>
              {kpi.sparkData && kpi.sparkData.length > 1 ? (
                <SparkAreaChart
                  data={kpi.sparkData}
                  categories={['value']}
                  index="idx"
                  colors={[chartColor as 'slate']}
                  className="h-8 w-20"
                  curveType="monotone"
                />
              ) : null}
            </div>
            <div className={`mt-1 text-lg font-semibold ${styles.value}`}>{kpi.value}</div>
            {kpi.sublabel ? <div className="mt-0.5 text-[10px] leading-none text-gray-400">{kpi.sublabel}</div> : null}
          </div>
        );
      })}
    </div>
  );
}
