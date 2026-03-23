/**
 * Vercel SDK wrapper for custom domain operations.
 *
 * All methods are server-side only (use VERCEL_API_TOKEN).
 * Hard-codes project/team IDs since they never change.
 */

import { Vercel } from '@vercel/sdk';

const vercel = new Vercel({
  bearerToken: process.env.VERCEL_API_TOKEN!,
});

const PROJECT_ID = 'prj_1fpvEDDhMJU1eJmeZeg1SrRoGouu';
const TEAM_ID = 'team_rc9thx76l7HjnJTP8KZCNxUN';

// ─── Types ───────────────────────────────────────────────────────────

export interface DomainVerificationRecord {
  type: string;
  domain: string;
  value: string;
  reason: string;
}

export interface AddDomainResult {
  name: string;
  apexName: string;
  verified: boolean;
  verification?: DomainVerificationRecord[];
}

export interface VerifyDomainResult {
  name: string;
  verified: boolean;
}

export interface DomainConfigResult {
  misconfigured: boolean;
}

// ─── Domain Operations ───────────────────────────────────────────────

/**
 * Register a domain on the Vercel project.
 * Returns verification records if DNS isn't pointed yet.
 */
export async function addDomain(domain: string): Promise<AddDomainResult> {
  const result = await vercel.projects.addProjectDomain({
    idOrName: PROJECT_ID,
    teamId: TEAM_ID,
    requestBody: {
      name: domain,
    },
  });

  return {
    name: result.name,
    apexName: result.apexName,
    verified: result.verified ?? false,
    verification: result.verification as DomainVerificationRecord[] | undefined,
  };
}

/**
 * Get current status of a domain on the project.
 * Use to check if domain is configured and verified.
 */
export async function getDomain(domain: string) {
  const result = await vercel.projects.getProjectDomain({
    idOrName: PROJECT_ID,
    domain,
    teamId: TEAM_ID,
  });

  return {
    name: result.name,
    verified: result.verified ?? false,
    verification: result.verification as DomainVerificationRecord[] | undefined,
  };
}

/**
 * Trigger Vercel to re-check DNS verification for a domain.
 * Returns updated verification status.
 */
export async function verifyDomain(domain: string): Promise<VerifyDomainResult> {
  const result = await vercel.projects.verifyProjectDomain({
    idOrName: PROJECT_ID,
    domain,
    teamId: TEAM_ID,
  });

  return {
    name: result.name,
    verified: result.verified ?? false,
  };
}

/**
 * Check domain DNS configuration status (misconfigured flag).
 */
export async function getDomainConfig(domain: string): Promise<DomainConfigResult> {
  const result = await vercel.domains.getDomainConfig({
    domain,
    teamId: TEAM_ID,
  });

  return {
    misconfigured: result.misconfigured ?? false,
  };
}

/**
 * Remove a domain from the Vercel project.
 * Call this when an agency disconnects their custom domain.
 */
export async function removeDomain(domain: string): Promise<void> {
  await vercel.projects.removeProjectDomain({
    idOrName: PROJECT_ID,
    domain,
    teamId: TEAM_ID,
  });
}
