"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { FileQuestion } from "lucide-react";

export default function ControlPanelNotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="mx-auto max-w-md text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50"
        >
          <FileQuestion className="h-7 w-7 text-amber-600" />
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="text-xl font-bold text-slate-900"
        >
          Page not found
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="mt-3 text-sm text-slate-600"
        >
          This section doesn&apos;t exist or may have been removed. Head back
          to the dashboard to continue.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="mt-6"
        >
          <Link
            href="/control-panel"
            className="cursor-pointer rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Back to dashboard
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
