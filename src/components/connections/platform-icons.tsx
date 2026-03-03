"use client";

import React, { useState } from "react";

type LogoProps = { className?: string };

function BrandLogo({
  src,
  alt,
  fallbackBg,
  fallbackLetter,
  className,
}: {
  src: string;
  alt: string;
  fallbackBg: string;
  fallbackLetter: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={className}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "8px",
          backgroundColor: fallbackBg,
          color: "#fff",
          fontWeight: 700,
          fontSize: "0.7em",
          width: "100%",
          height: "100%",
          lineHeight: 1,
          letterSpacing: "-0.02em",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        }}
        aria-label={alt}
      >
        {fallbackLetter}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={{
        objectFit: "contain",
        width: "100%",
        height: "100%",
        borderRadius: "6px",
      }}
      onError={() => setFailed(true)}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
}

/*
 * Logo sources: GitHub org avatars — 200x200 PNG, CDN-cached,
 * permanent URLs that survive rebrandings. These are the actual
 * company GitHub org profile pictures.
 */

export function N8nLogo({ className }: LogoProps) {
  return (
    <BrandLogo
      src="https://avatars.githubusercontent.com/u/44720547?s=200&v=4"
      alt="n8n"
      fallbackBg="#EA4B71"
      fallbackLetter="n8n"
      className={className}
    />
  );
}

export function MakeLogo({ className }: LogoProps) {
  return (
    <BrandLogo
      src="https://images.ctfassets.net/un655fb6n1s6/4yi0S1LBzWMisc6OYQIGME/efcfb6650e5e1824a2e8ea0e91c1c27c/favicon.svg"
      alt="Make"
      fallbackBg="#6D00CC"
      fallbackLetter="M"
      className={className}
    />
  );
}

export function VapiLogo({ className }: LogoProps) {
  return (
    <BrandLogo
      src="https://avatars.githubusercontent.com/u/148934345?s=200&v=4"
      alt="Vapi"
      fallbackBg="#07B0CE"
      fallbackLetter="V"
      className={className}
    />
  );
}

export function RetellLogo({ className }: LogoProps) {
  return (
    <BrandLogo
      src="https://avatars.githubusercontent.com/u/137797700?s=200&v=4"
      alt="Retell"
      fallbackBg="#111827"
      fallbackLetter="R"
      className={className}
    />
  );
}

export function ActivepiecesLogo({ className }: LogoProps) {
  return (
    <BrandLogo
      src="https://avatars.githubusercontent.com/u/114750527?s=200&v=4"
      alt="Activepieces"
      fallbackBg="#8B5CF6"
      fallbackLetter="A"
      className={className}
    />
  );
}
