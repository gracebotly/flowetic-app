'use client';

interface IntegrationPillsProps {
  packages: string[];
  label?: string;
}

export function IntegrationPills({ packages, label = 'Integrations' }: IntegrationPillsProps) {
  const deduped = [...new Set(packages.filter(Boolean))];
  if (deduped.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {deduped.map((pkg) => (
          <span
            key={pkg}
            className="rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700 capitalize"
          >
            {pkg}
          </span>
        ))}
      </div>
    </div>
  );
}
