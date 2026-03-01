import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // =========================================================================
  // CRITICAL: Prevent bundler from duplicating @mastra/* classes
  //
  // Without this, Next.js's bundler creates multiple copies of Mastra classes
  // in different chunks. JavaScript private field brand checks then fail with
  // "#workflows" errors because instances from one chunk don't match the class
  // definition in another chunk.
  //
  // This config tells Next.js to load @mastra/* packages directly from
  // node_modules at runtime instead of bundling them.
  // =========================================================================
  serverExternalPackages: [
    "@mastra/core",
    "@mastra/memory",
    "@mastra/ai-sdk",
    "@mastra/libsql",
    "@mastra/pg",
    "@mastra/mcp",
  ],

  async redirects() {
    return [
      // Legacy app routes → new Control Panel shell
      {
        source: "/dashboard",
        destination: "/control-panel/connections",
        permanent: true,
      },
      {
        source: "/sources",
        destination: "/control-panel/connections",
        permanent: true,
      },
      {
        source: "/interfaces",
        destination: "/control-panel/dashboards",
        permanent: true,
      },
      {
        source: "/settings",
        destination: "/control-panel/settings",
        permanent: true,
      },
      {
        source: "/control-panel/projects",
        destination: "/control-panel/offerings",
        permanent: true,
      },
      {
        source: "/control-panel/chat",
        destination: "/control-panel/offerings",
        permanent: true,
      },
      {
        source: "/control-panel/portals",
        destination: "/control-panel/offerings",
        permanent: true,
      },
      {
        source: "/control-panel/portals/:path*",
        destination: "/control-panel/offerings",
        permanent: true,
      },
      {
        source: "/control-panel/products",
        destination: "/control-panel/offerings",
        permanent: true,
      },
      {
        source: "/control-panel/products/:path*",
        destination: "/control-panel/offerings",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
