import type { NextConfig } from "next";
 
const nextConfig: NextConfig = {
  /* config options here */
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
