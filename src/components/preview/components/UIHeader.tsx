"use client";
import React from "react";
import { motion } from "framer-motion";
import type { RendererProps } from "../componentRegistry";

export default function UIHeaderRenderer({ component, designTokens: dt, deviceMode }: RendererProps) {
  const textColor = dt.colors?.text ?? "#111827";
  const primary = dt.colors?.primary ?? "#3b82f6";
  const headingFont = dt.fonts?.heading;
  const bodyFont = dt.fonts?.body;

  const { props } = component;
  const title = (props?.title as string) ?? "Untitled";
  const subtitle = (props?.subtitle as string) ?? "";
  const category = (props?.category as string) ?? "dashboard";
  const showGreeting = props?.showGreeting ?? false;

  // Time-based greeting for dashboards
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <motion.div
      className="w-full"
      style={{ padding: deviceMode === "mobile" ? "8px 0" : "12px 0 20px 0" }}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1.0] }}
      data-component-type="UIHeader"
    >
      {showGreeting && category === "dashboard" && (
        <span
          className="text-sm font-medium mb-1 block"
          style={{ color: primary, fontFamily: bodyFont || undefined, opacity: 0.8 }}
        >
          {greeting}
        </span>
      )}
      {category === "product" && (
        <span
          className="text-xs font-semibold uppercase tracking-wider mb-2 block"
          style={{ color: primary, fontFamily: bodyFont || undefined, letterSpacing: "0.08em" }}
        >
          {subtitle ? "✦ Product" : ""}
        </span>
      )}
      <h1
        className="font-bold tracking-tight"
        style={{
          color: textColor,
          fontFamily: headingFont || undefined,
          fontSize: deviceMode === "mobile"
            ? (category === "product" ? "1.5rem" : "1.25rem")
            : (category === "product" ? "2.25rem" : "1.75rem"),
          lineHeight: 1.2,
        }}
      >
        {title}
      </h1>
      {subtitle && (
        <p
          className="mt-1"
          style={{
            color: `${textColor}60`,
            fontFamily: bodyFont || undefined,
            fontSize: deviceMode === "mobile" ? "0.8rem" : "0.875rem",
            lineHeight: 1.4,
            maxWidth: category === "product" ? "600px" : undefined,
          }}
        >
          {subtitle}
        </p>
      )}
    </motion.div>
  );
}
