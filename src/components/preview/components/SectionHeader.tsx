"use client";
import React from "react";
import { motion } from "framer-motion";
import type { RendererProps } from "../componentRegistry";

export default function SectionHeaderRenderer({ component, designTokens: dt, deviceMode }: RendererProps) {
  const textColor = dt.colors?.text ?? "#111827";
  const primary = dt.colors?.primary ?? "#3b82f6";
  const headingFont = dt.fonts?.heading;

  const { props } = component;
  const title = (props?.title as string) ?? "";

  if (!title) return null;

  return (
    <motion.div
      className="w-full flex items-center gap-3"
      style={{ padding: deviceMode === "mobile" ? "12px 0 4px 0" : "20px 0 8px 0" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      data-component-type="SectionHeader"
    >
      <div
        style={{
          width: 3,
          height: deviceMode === "mobile" ? 16 : 20,
          borderRadius: 2,
          background: `linear-gradient(180deg, ${primary}, ${primary}40)`,
        }}
      />
      <h2
        className="font-semibold tracking-tight"
        style={{
          color: textColor,
          fontFamily: headingFont || undefined,
          fontSize: deviceMode === "mobile" ? "0.875rem" : "1rem",
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </h2>
      <div
        className="flex-1"
        style={{ height: 1, background: `linear-gradient(90deg, ${textColor}10, transparent)` }}
      />
    </motion.div>
  );
}
