"use client";

import { motion } from "framer-motion";
import { LayoutDashboard, ExternalLink } from "lucide-react";

interface Portal {
  id: string;
  name: string;
  token: string | null;
  custom_path: string | null;
  platform_type: string | null;
  description: string | null;
  last_viewed_at: string | null;
}

interface Props {
  portals: Portal[];
  primaryColor: string;
  useCleanUrls?: boolean;
}

const platformLabel: Record<string, string> = {
  vapi: "Vapi Voice",
  retell: "Retell Voice",
  n8n: "n8n Workflow",
  make: "Make Workflow",
};

export function ClientHubGrid({ portals, primaryColor, useCleanUrls = false }: Props) {
  if (portals.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
        <LayoutDashboard className="mx-auto h-4 w-4 text-slate-300" />
        <p className="mt-3 text-sm text-slate-600">No dashboards available yet.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {portals.map((portal, i) => (
        <motion.a
          key={portal.id}
          href={useCleanUrls && portal.custom_path ? `/${portal.custom_path}` : `/client/${portal.token}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: i * 0.05 }}
          className="group block cursor-pointer rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-colors duration-200 hover:border-blue-300 hover:shadow-md"
          style={{ borderTopWidth: 3, borderTopColor: primaryColor }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {portal.platform_type && (
                <p className="mb-1 text-xs font-medium text-slate-500">
                  {platformLabel[portal.platform_type] ?? portal.platform_type}
                </p>
              )}
              <p className="truncate font-semibold text-slate-900 transition-colors duration-200 group-hover:text-blue-700">
                {portal.name}
              </p>
              {portal.description && (
                <p className="mt-1 line-clamp-2 text-xs text-slate-600">
                  {portal.description}
                </p>
              )}
              {portal.last_viewed_at && (
                <p className="mt-2 text-xs text-slate-600">
                  Last viewed:{" "}
                  {new Date(portal.last_viewed_at).toLocaleDateString()}
                </p>
              )}
            </div>
            <div
              className="flex flex-shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
              style={{ backgroundColor: primaryColor }}
            >
              Open
              <ExternalLink className="ml-0.5 h-4 w-4" />
            </div>
          </div>
        </motion.a>
      ))}
    </div>
  );
}
