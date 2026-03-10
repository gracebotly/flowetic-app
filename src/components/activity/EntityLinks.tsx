"use client";

import Link from "next/link";
import { User, Package, Plug, ExternalLink } from "lucide-react";

interface EntityLinksProps {
  entityType: string | null;
  entityId: string | null;
  entityName: string | null;
  clientId: string | null;
  offeringId: string | null;
}

interface LinkItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function EntityLinks({
  entityType,
  entityId,
  entityName,
  clientId,
  offeringId,
}: EntityLinksProps) {
  const links: LinkItem[] = [];

  // Entity link (the thing that was acted on)
  if (entityType && entityId) {
    switch (entityType) {
      case "client":
        links.push({
          href: `/control-panel/clients/${entityId}`,
          label: entityName || "View Client",
          icon: User,
        });
        break;
      case "portal":
        links.push({
          href: `/control-panel/client-portals/${entityId}`,
          label: entityName || "View Portal",
          icon: Package,
        });
        break;
      case "connection":
      case "source":
        links.push({
          href: `/control-panel/connections`,
          label: entityName || "View Connections",
          icon: Plug,
        });
        break;
    }
  }

  // Client link (if different from entity)
  if (clientId && entityType !== "client") {
    links.push({
      href: `/control-panel/clients/${clientId}`,
      label: "View Client",
      icon: User,
    });
  }

  // Offering link (if different from entity)
  if (offeringId && entityType !== "offering") {
    links.push({
      href: `/control-panel/client-portals/${offeringId}`,
      label: "View Portal",
      icon: Package,
    });
  }

  if (links.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
        Related
      </span>
      <div className="space-y-1">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition group"
            >
              <Icon className="h-4 w-4 text-gray-400 group-hover:text-gray-600" />
              <span className="flex-1 truncate">{link.label}</span>
              <ExternalLink className="h-3 w-3 text-gray-300 group-hover:text-gray-500" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
