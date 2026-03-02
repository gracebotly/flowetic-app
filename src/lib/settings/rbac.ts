/**
 * Client-side RBAC for settings tabs.
 *
 * DB roles: admin | client | viewer
 * (Note: 'client' functions as the "editor" role in the UI)
 *
 * API routes already enforce admin-only on PATCH/POST/DELETE.
 * This file controls what the UI *shows*.
 */

export type SettingsRole = "admin" | "client" | "viewer";

export type SettingsPermissions = {
  canEditWorkspace: boolean;
  canEditBranding: boolean;
  canManageTeam: boolean;
  canManageBilling: boolean;
  canDeleteWorkspace: boolean;
  canExportData: boolean;
};

export const ROLE_PERMISSIONS: Record<SettingsRole, SettingsPermissions> = {
  admin: {
    canEditWorkspace: true,
    canEditBranding: true,
    canManageTeam: true,
    canManageBilling: true,
    canDeleteWorkspace: true,
    canExportData: true,
  },
  client: {
    // "client" role in DB = "editor" in UI
    canEditWorkspace: false,
    canEditBranding: true,
    canManageTeam: false,
    canManageBilling: false,
    canDeleteWorkspace: false,
    canExportData: true,
  },
  viewer: {
    canEditWorkspace: false,
    canEditBranding: false,
    canManageTeam: false,
    canManageBilling: false,
    canDeleteWorkspace: false,
    canExportData: false,
  },
} as const;

export function getPermissions(role: string): SettingsPermissions {
  if (role in ROLE_PERMISSIONS) {
    return ROLE_PERMISSIONS[role as SettingsRole];
  }
  // Unknown role → viewer (safest default)
  return ROLE_PERMISSIONS.viewer;
}
