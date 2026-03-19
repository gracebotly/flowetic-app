"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--main-bg))] px-6">
      <div className="relative mx-auto max-w-lg text-center">
        {/* Large decorative 404 behind content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex select-none items-center justify-center"
        >
          <span className="text-[10rem] font-black leading-none tracking-tighter text-gray-100 sm:text-[12rem]">
            404
          </span>
        </motion.div>

        {/* Content */}
        <div className="relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50"
          >
            <Compass className="h-8 w-8 text-blue-600" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25 }}
            className="text-2xl font-bold text-slate-900"
          >
            Page not found
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.35 }}
            className="mt-3 text-sm text-slate-600"
          >
            The page you&apos;re looking for doesn&apos;t exist or has been
            moved. Check the URL or head back to familiar ground.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.45 }}
            className="mt-8 flex items-center justify-center gap-3"
          >
            <Link
              href="/login"
              className="cursor-pointer rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Sign in
            </Link>
            <Link
              href="/"
              className="cursor-pointer rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition-colors duration-200 hover:bg-gray-50"
            >
              Go home
            </Link>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
