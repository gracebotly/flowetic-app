import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
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
      // Auth alias
      { source: "/auth", destination: "/login", permanent: false },
      // Legacy app routes → new Control Panel shell
      { source: "/dashboard", destination: "/control-panel/connections", permanent: true },
      { source: "/sources", destination: "/control-panel/connections", permanent: true },
      { source: "/interfaces", destination: "/control-panel/connections", permanent: true },
      { source: "/settings", destination: "/control-panel/settings", permanent: true },
      { source: "/control-panel/projects", destination: "/control-panel/client-portals", permanent: true },
      { source: "/control-panel/chat", destination: "/control-panel/client-portals", permanent: true },
      { source: "/control-panel/portals", destination: "/control-panel/client-portals", permanent: true },
      { source: "/control-panel/portals/:path*", destination: "/control-panel/client-portals", permanent: true },
      { source: "/control-panel/products", destination: "/control-panel/client-portals", permanent: true },
      { source: "/control-panel/products/:path*", destination: "/control-panel/client-portals", permanent: true },
      // Old offerings routes → client-portals (clean rename)
      { source: "/control-panel/offerings", destination: "/control-panel/client-portals", permanent: true },
      { source: "/control-panel/offerings/create", destination: "/control-panel/client-portals/create", permanent: true },
      { source: "/control-panel/offerings/:id", destination: "/control-panel/client-portals/:id", permanent: true },
    ];
  },
};

export default nextConfig;
