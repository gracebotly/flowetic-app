'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Zap, Shield, Clock, CheckCircle } from 'lucide-react';
import {
  ProductThemeProvider,
  ThemeToggle,
  useTheme,
} from '@/lib/products/ThemeProvider';

interface PremiumLandingProps {
  product: {
    id: string;
    name: string;
    description: string | null;
    slug: string;
    pricingModel: string;
    priceCents: number;
    inputSchema: unknown[];
    designTokens: Record<string, unknown> | null;
  };
  branding: {
    agencyName: string;
    logoUrl: string | null;
    primaryColor: string;
    secondaryColor: string;
  };
  stats: {
    totalExecutions: number;
  };
}

export function PremiumLanding(props: PremiumLandingProps) {
  return (
    <ProductThemeProvider
      designTokens={props.product.designTokens}
      primaryColor={props.branding.primaryColor}
    >
      <LandingContent {...props} />
    </ProductThemeProvider>
  );
}

function LandingContent({ product, branding, stats }: PremiumLandingProps) {
  const { theme, colors } = useTheme();
  const [mounted] = useState(true);

  const fieldCount = product.inputSchema?.length ?? 0;
  const isFree = product.pricingModel === 'free';
  const priceDisplay =
    product.priceCents > 0 ? `$${(product.priceCents / 100).toFixed(2)}` : null;
  const priceSuffix =
    product.pricingModel === 'monthly'
      ? '/mo'
      : product.pricingModel === 'per_run'
        ? '/run'
        : product.pricingModel === 'usage_based'
          ? '/use'
          : '';

  return (
    <div className="relative overflow-hidden">
      {/* Ambient background gradient blobs */}
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-30"
        style={{
          background:
            theme === 'dark'
              ? `radial-gradient(ellipse 80% 60% at 50% -20%, ${colors.primary}22, transparent),
               radial-gradient(ellipse 60% 50% at 80% 100%, ${colors.primary}11, transparent)`
              : `radial-gradient(ellipse 80% 60% at 50% -20%, ${colors.primary}15, transparent),
               radial-gradient(ellipse 60% 50% at 80% 100%, ${colors.primary}08, transparent)`,
        }}
      />

      {/* Sticky top bar with glassmorphism */}
      <header
        className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 backdrop-blur-xl"
        style={{
          backgroundColor:
            theme === 'dark' ? 'rgba(15,15,20,0.8)' : 'rgba(255,255,255,0.8)',
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        <div className="flex items-center gap-3">
          {branding.logoUrl && (
            <img
              src={branding.logoUrl}
              alt={branding.agencyName}
              className="h-7 w-auto object-contain"
            />
          )}
          <span className="text-sm font-medium" style={{ color: colors.textMuted }}>
            {branding.agencyName}
          </span>
        </div>
        <ThemeToggle />
      </header>

      {/* Hero */}
      <main className="flex min-h-[85vh] flex-col items-center justify-center px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          {/* Pricing / free badge */}
          {!isFree && priceDisplay && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={mounted ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.1 }}
              className="mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold"
              style={{
                backgroundColor:
                  theme === 'dark' ? `${colors.primary}20` : `${colors.primary}10`,
                color: colors.primary,
                border: `1px solid ${colors.primary}30`,
              }}
            >
              <Zap className="h-3.5 w-3.5" />
              {priceDisplay}
              {priceSuffix}
            </motion.div>
          )}

          {isFree && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={mounted ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.1 }}
              className="mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold"
              style={{
                backgroundColor: `${colors.success}15`,
                color: colors.success,
                border: `1px solid ${colors.success}30`,
              }}
            >
              <CheckCircle className="h-3.5 w-3.5" />
              Free to use
            </motion.div>
          )}

          {/* Product title — gradient text */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={mounted ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl"
            style={{
              lineHeight: 1.1,
              background: `linear-gradient(135deg, ${colors.text} 0%, ${colors.textMuted} 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {product.name}
          </motion.h1>

          {/* Description */}
          {product.description && (
            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={mounted ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.35, duration: 0.5 }}
              className="mx-auto mt-5 max-w-lg text-lg leading-relaxed"
              style={{ color: colors.textMuted }}
            >
              {product.description}
            </motion.p>
          )}

          {/* CTA button with glow shadow */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={mounted ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="mt-10"
          >
            <a
              href={`/products/${product.slug}/run`}
              className="group inline-flex items-center gap-3 rounded-2xl px-8 py-4 text-lg font-semibold text-white shadow-xl transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl active:scale-[0.98]"
              style={{
                backgroundColor: colors.primary,
                boxShadow: `0 8px 30px ${colors.primary}40`,
              }}
            >
              Get Started
              <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
            </a>
          </motion.div>

          {/* Input count hint */}
          {fieldCount > 0 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={mounted ? { opacity: 1 } : {}}
              transition={{ delay: 0.7 }}
              className="mt-5 text-sm"
              style={{ color: colors.textMuted }}
            >
              {fieldCount} quick question{fieldCount !== 1 ? 's' : ''} · Results in seconds
            </motion.p>
          )}
        </div>
      </main>

      {/* Trust Badges */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        animate={mounted ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: 0.8, duration: 0.6 }}
        className="mx-auto max-w-3xl px-6 pb-20"
      >
        <div
          className="grid grid-cols-1 gap-4 rounded-2xl p-6 sm:grid-cols-3"
          style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}` }}
        >
          {/* Execution count */}
          <div className="flex items-center gap-3 px-3 py-2">
            <div
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${colors.primary}15` }}
            >
              <Zap className="h-5 w-5" style={{ color: colors.primary }} />
            </div>
            <div>
              <p className="text-sm font-semibold">
                {stats.totalExecutions > 0
                  ? `${stats.totalExecutions.toLocaleString()} runs`
                  : 'Ready to go'}
              </p>
              <p className="text-xs" style={{ color: colors.textMuted }}>
                {stats.totalExecutions > 0
                  ? 'Successful executions'
                  : 'Start your first run'}
              </p>
            </div>
          </div>

          {/* Speed badge */}
          <div className="flex items-center gap-3 px-3 py-2">
            <div
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${colors.success}15` }}
            >
              <Clock className="h-5 w-5" style={{ color: colors.success }} />
            </div>
            <div>
              <p className="text-sm font-semibold">Instant results</p>
              <p className="text-xs" style={{ color: colors.textMuted }}>
                Powered by AI automation
              </p>
            </div>
          </div>

          {/* Security badge */}
          <div className="flex items-center gap-3 px-3 py-2">
            <div
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${colors.primary}15` }}
            >
              <Shield className="h-5 w-5" style={{ color: colors.primary }} />
            </div>
            <div>
              <p className="text-sm font-semibold">Secure & private</p>
              <p className="text-xs" style={{ color: colors.textMuted }}>
                Data encrypted end-to-end
              </p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Footer */}
      <footer
        className="py-6 text-center text-xs"
        style={{ color: colors.textMuted, opacity: 0.5 }}
      >
        Powered by AI
      </footer>
    </div>
  );
}
