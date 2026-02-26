// src/app/api/admin/skill-health/route.ts
//
// Internal admin endpoint: GET /api/admin/skill-health
//
// Returns a JSON report of which platforms have:
//   - field-semantics.yaml (with validation status)
//   - SKILL.md
//   - SKILL_SUMMARY.md
//   - references/ folder
//
// Used by internal admin dashboard for observability.
// Protected: only accessible in development or with admin auth.

// ── CRITICAL: Force Node.js runtime ──────────────────────────────────
// This route uses `fs` for filesystem access. Edge Runtime does NOT support
// the `fs` module and will crash at deploy time without this declaration.
// See: https://nextjs.org/docs/app/building-your-application/routing/route-handlers#edge-and-nodejs-runtimes
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { loadFieldSemantics, clearSemanticsCache } from '@/mastra/lib/semantics/fieldSemantics';

// ── Known platforms we expect to have skills ───────────────────────────
const EXPECTED_PLATFORMS = ['n8n', 'vapi', 'make', 'retell'] as const;

// ── Cross-cutting skills (not platform-specific) ──────────────────────
const EXPECTED_CROSS_CUTTING = [
  'business-outcomes-advisor',
  'ui-ux-pro-max',
  'data-dashboard-intelligence',
] as const;

interface PlatformHealth {
  platform: string;
  hasFieldSemantics: boolean;
  fieldSemanticsValid: boolean;
  fieldSemanticsError?: string;
  fieldRuleCount: number;
  hasSkillMd: boolean;
  hasSkillSummary: boolean;
  hasReferences: boolean;
  skillMdSizeBytes: number;
}

interface CrossCuttingHealth {
  skill: string;
  hasSkillMd: boolean;
  hasSkillSummary: boolean;
  hasReferences: boolean;
  skillMdSizeBytes: number;
}

interface SkillHealthReport {
  timestamp: string;
  workspacePath: string;
  platforms: PlatformHealth[];
  crossCutting: CrossCuttingHealth[];
  summary: {
    totalPlatforms: number;
    platformsWithSemantics: number;
    platformsWithSkillMd: number;
    crossCuttingWithSkillMd: number;
    allPlatformsHealthy: boolean;
    missingCritical: string[];
  };
}

function checkPlatformHealth(platform: string, skillsDir: string): PlatformHealth {
  const platformDir = path.join(skillsDir, platform);
  const exists = fs.existsSync(platformDir);

  const result: PlatformHealth = {
    platform,
    hasFieldSemantics: false,
    fieldSemanticsValid: false,
    fieldRuleCount: 0,
    hasSkillMd: false,
    hasSkillSummary: false,
    hasReferences: false,
    skillMdSizeBytes: 0,
  };

  if (!exists) return result;

  // Check field-semantics.yaml
  const yamlPath = path.join(platformDir, 'field-semantics.yaml');
  const ymlPath = path.join(platformDir, 'field-semantics.yml');
  result.hasFieldSemantics = fs.existsSync(yamlPath) || fs.existsSync(ymlPath);

  if (result.hasFieldSemantics) {
    try {
      // Clear cache to get fresh validation
      clearSemanticsCache();
      const config = loadFieldSemantics(platform);
      if (config) {
        result.fieldSemanticsValid = true;
        result.fieldRuleCount = Object.keys(config.field_rules).length;
      }
    } catch (err) {
      result.fieldSemanticsValid = false;
      result.fieldSemanticsError = err instanceof Error ? err.message : String(err);
    }
  }

  // Check SKILL.md
  const skillMdPath = path.join(platformDir, 'SKILL.md');
  if (fs.existsSync(skillMdPath)) {
    result.hasSkillMd = true;
    result.skillMdSizeBytes = fs.statSync(skillMdPath).size;
  }

  // Check SKILL_SUMMARY.md
  result.hasSkillSummary = fs.existsSync(path.join(platformDir, 'SKILL_SUMMARY.md'));

  // Check references/
  result.hasReferences = fs.existsSync(path.join(platformDir, 'references'));

  return result;
}

function checkCrossCuttingHealth(skill: string, skillsDir: string): CrossCuttingHealth {
  const skillDir = path.join(skillsDir, skill);
  const exists = fs.existsSync(skillDir);

  const result: CrossCuttingHealth = {
    skill,
    hasSkillMd: false,
    hasSkillSummary: false,
    hasReferences: false,
    skillMdSizeBytes: 0,
  };

  if (!exists) return result;

  const skillMdPath = path.join(skillDir, 'SKILL.md');
  if (fs.existsSync(skillMdPath)) {
    result.hasSkillMd = true;
    result.skillMdSizeBytes = fs.statSync(skillMdPath).size;
  }

  result.hasSkillSummary = fs.existsSync(path.join(skillDir, 'SKILL_SUMMARY.md'));
  result.hasReferences = fs.existsSync(path.join(skillDir, 'references'));

  return result;
}

export async function GET() {
  // ── Auth guard: only allow in development or with admin token ──
  const isDev = process.env.NODE_ENV === 'development';
  // In production, you'd check for an admin session/token here.
  // For now, this endpoint is dev-only.
  if (!isDev) {
    return NextResponse.json(
      { error: 'Skill health endpoint is only available in development' },
      { status: 403 },
    );
  }

  const skillsDir = path.resolve(process.cwd(), 'workspace', 'skills');

  if (!fs.existsSync(skillsDir)) {
    return NextResponse.json(
      { error: `Skills directory not found: ${skillsDir}` },
      { status: 500 },
    );
  }

  // ── Scan platforms ────────────────────────────────────────────────
  const platforms = EXPECTED_PLATFORMS.map(p => checkPlatformHealth(p, skillsDir));

  // ── Scan cross-cutting skills ─────────────────────────────────────
  const crossCutting = EXPECTED_CROSS_CUTTING.map(s => checkCrossCuttingHealth(s, skillsDir));

  // ── Build summary ─────────────────────────────────────────────────
  const missingCritical: string[] = [];

  for (const p of platforms) {
    if (!p.hasFieldSemantics) missingCritical.push(`${p.platform}: missing field-semantics.yaml`);
    if (p.hasFieldSemantics && !p.fieldSemanticsValid) missingCritical.push(`${p.platform}: invalid field-semantics.yaml — ${p.fieldSemanticsError}`);
    if (!p.hasSkillMd) missingCritical.push(`${p.platform}: missing SKILL.md`);
    if (p.hasSkillMd && p.skillMdSizeBytes < 500) missingCritical.push(`${p.platform}: SKILL.md is a stub (${p.skillMdSizeBytes} bytes)`);
  }

  for (const c of crossCutting) {
    if (!c.hasSkillMd) missingCritical.push(`${c.skill}: missing SKILL.md`);
  }

  const report: SkillHealthReport = {
    timestamp: new Date().toISOString(),
    workspacePath: skillsDir,
    platforms,
    crossCutting,
    summary: {
      totalPlatforms: platforms.length,
      platformsWithSemantics: platforms.filter(p => p.hasFieldSemantics && p.fieldSemanticsValid).length,
      platformsWithSkillMd: platforms.filter(p => p.hasSkillMd).length,
      crossCuttingWithSkillMd: crossCutting.filter(c => c.hasSkillMd).length,
      allPlatformsHealthy: missingCritical.length === 0,
      missingCritical,
    },
  };

  // Clear cache after scan so normal operations get fresh reads
  clearSemanticsCache();

  return NextResponse.json(report, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
