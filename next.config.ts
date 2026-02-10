import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // =========================================================================
  // CRITICAL: Prevent bundler from duplicating @mastra/* classes
  //
  // Without this, Next.js's bundler (Turbopack in Next.js 16+) creates multiple
  // copies of Mastra classes in different chunks. JavaScript private field brand
  // checks then fail with "#eY" errors because instances from one chunk don't
  // match the class definition in another chunk.
  //
  // This config tells Next.js to load @mastra/* packages directly from
  // node_modules at runtime instead of bundling them, ensuring a single copy
  // of each class exists in memory.
  //
  // This is explicitly required by Mastra's Next.js documentation:
  // https://mastra.ai/docs/frameworks/next-js
  // =========================================================================
  serverExternalPackages: [
    "@mastra/core",
    "@mastra/memory",
    "@mastra/ai-sdk",
    "@mastra/libsql",
    "@mastra/pg",
    "@mastra/rag",
    "@mastra/mcp",
    "@mastra/voice-deepgram",
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
    ];
  },
};
 
export default nextConfig;
