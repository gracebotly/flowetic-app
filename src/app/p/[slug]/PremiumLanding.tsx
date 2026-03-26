'use client';

import { ArrowRight, Zap, Shield, Clock, CheckCircle, Users } from 'lucide-react';
import { motion } from 'framer-motion';

interface PremiumLandingProps {
  hideGetfloweticBranding?: boolean;
  product: {
    id: string;
    name: string;
    description: string | null;
    slug: string;
    surfaceType: string;
    accessType: string;
    pricingModel: string;
    priceCents: number;
    token: string | null;
    inputSchema: unknown[];
    designTokens: Record<string, unknown> | null;
  };
  branding: {
    agencyName: string;
    logoUrl: string | null;
    primaryColor: string;
    secondaryColor: string;
    footerText: string;
  };
  stats: {
    totalExecutions: number;
  };
}

export function PremiumLanding({ product, branding, stats, hideGetfloweticBranding }: PremiumLandingProps) {
  const isFree = product.pricingModel === 'free';
  const priceDisplay =
    product.priceCents > 0
      ? `$${(product.priceCents / 100).toFixed(0)}`
      : null;
  const priceSuffix =
    product.pricingModel === 'monthly'
      ? '/mo'
      : product.pricingModel === 'per_run'
        ? '/run'
        : product.pricingModel === 'usage_based'
          ? '/use'
          : '';

  const fieldCount = product.inputSchema?.length ?? 0;
  const isAnalytics = product.surfaceType === 'analytics';

  // Route CTA based on surface_type:
  // - analytics portals → /p/[slug]/subscribe (PricingGate → dashboard)
  // - runner/both portals → /p/[slug]/run (FormWizard)
  const ctaHref = isAnalytics
    ? `/p/${product.slug}/subscribe`
    : `/p/${product.slug}/run`;

  const ctaLabel = isAnalytics
    ? isFree
      ? 'View dashboard'
      : 'Subscribe and view dashboard'
    : 'Get started';

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            {branding.logoUrl && (
              <img
                src={branding.logoUrl}
                alt={branding.agencyName}
                className="h-7 w-auto object-contain"
              />
            )}
            <span className="text-sm font-medium text-slate-600">
              {branding.agencyName}
            </span>
          </div>
          {!isFree && priceDisplay && (
            <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
              {priceDisplay}{priceSuffix}
            </span>
          )}
        </div>
      </header>

      {/* Hero */}
      <main className="mx-auto max-w-2xl px-6 py-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Badge */}
          {isAnalytics ? (
            <span className="mb-5 inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              <Users className="h-3 w-3" />
              Client analytics portal
            </span>
          ) : fieldCount > 0 ? (
            <span className="mb-5 inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              <Zap className="h-3 w-3" />
              {fieldCount} input{fieldCount !== 1 ? 's' : ''} · Instant results
            </span>
          ) : null}

          {/* Title */}
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            {product.name}
          </h1>

          {/* Description */}
          {product.description && (
            <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-slate-500">
              {product.description}
            </p>
          )}

          {/* CTA */}
          <div className="mt-8">
            <a
              href={ctaHref}
              className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-medium text-white transition-colors duration-200 hover:opacity-90"
              style={{ backgroundColor: branding.primaryColor }}
            >
              {ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          {/* Price note */}
          {!isFree && priceDisplay && (
            <p className="mt-3 text-xs text-slate-400">
              {product.pricingModel === 'monthly'
                ? `${priceDisplay}/month · Cancel anytime`
                : product.pricingModel === 'per_run'
                  ? `${priceDisplay} per execution`
                  : `${priceDisplay}${priceSuffix}`}
            </p>
          )}
          {isFree && (
            <p className="mt-3 flex items-center justify-center gap-1 text-xs text-emerald-600">
              <CheckCircle className="h-3 w-3" />
              Free to use
            </p>
          )}
        </motion.div>
      </main>

      {/* Trust section */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="mx-auto max-w-2xl px-6 pb-20"
      >
        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-gray-200 bg-gray-200">
          <div className="flex items-center gap-3 bg-white p-4">
            <Zap className="h-4 w-4 shrink-0 text-slate-400" />
            <div>
              <p className="text-xs font-medium text-slate-900">
                {stats.totalExecutions > 0
                  ? `${stats.totalExecutions.toLocaleString()} runs`
                  : 'Ready'}
              </p>
              <p className="text-[11px] text-slate-500">
                {stats.totalExecutions > 0 ? 'Successful' : 'Start now'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white p-4">
            <Clock className="h-4 w-4 shrink-0 text-slate-400" />
            <div>
              <p className="text-xs font-medium text-slate-900">Instant</p>
              <p className="text-[11px] text-slate-500">Real-time results</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white p-4">
            <Shield className="h-4 w-4 shrink-0 text-slate-400" />
            <div>
              <p className="text-xs font-medium text-slate-900">Secure</p>
              <p className="text-[11px] text-slate-500">Encrypted</p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Footer */}
      {!hideGetfloweticBranding && (
        <footer className="py-6 text-center text-[11px] text-slate-300">
          {branding.footerText}
        </footer>
      )}
    </div>
  );
}
