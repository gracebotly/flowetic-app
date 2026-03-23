"use client";

import { motion } from "framer-motion";
import { Globe } from "lucide-react";

export default function DomainNotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--main-bg))] px-6">
      <div className="relative mx-auto max-w-lg text-center">
        {/* Large decorative text behind content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex select-none items-center justify-center"
        >
          <span className="text-[8rem] font-black leading-none tracking-tighter text-gray-100 sm:text-[10rem]">
            ?
          </span>
        </motion.div>

        {/* Content */}
        <div className="relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50"
          >
            <Globe className="h-8 w-8 text-amber-600" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25 }}
            className="text-2xl font-bold text-slate-900"
          >
            Domain not connected
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.35 }}
            className="mt-3 text-sm text-slate-600"
          >
            This domain isn&apos;t linked to any portal on Getflowetic.
            If you&apos;re an agency owner, check your custom domain
            settings in the control panel.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.45 }}
            className="mt-8 flex items-center justify-center gap-3"
          >
            <a
              href="https://app.getflowetic.com/control-panel/settings"
              className="cursor-pointer rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Open Control Panel
            </a>
            <a
              href="https://getflowetic.com"
              className="cursor-pointer rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition-colors duration-200 hover:bg-gray-50"
            >
              Learn about Getflowetic
            </a>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
