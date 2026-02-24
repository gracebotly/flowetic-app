# Revenue Strategy Architect

Real-time revenue strategy advisor for AI automation agency owners.

## Purpose

Helps agency owners choose between 2-3 dashboard proposals by framing each through a monetization lens. Activated during the `propose` phase via masterRouterAgent skill injection.

## Key Behaviors

- Frames proposals through 5 monetization lenses (retainer visibility, client value, sell-access, ops efficiency, positioning)
- Makes opinionated recommendations — picks a winner and explains why
- Uses agency-native vocabulary (MRR, retainer, white-label, upsell, churn)
- Asks max 1-2 clarifying questions total
- Targets proposal selection within 60 seconds

## Architecture

- Folder name: `business-outcomes-advisor` (stable filesystem key)
- Internal identity: Revenue Strategy Architect (v2.0.0)
- Loaded by: `searchSkillKnowledge` tool (domain: "business") via BM25 search
- Phase scope: `propose` only
- Does NOT generate files, specs, or financial models

## Files

- `SKILL.md` — Agent instructions (< 5000 tokens, Agent Skills spec compliant)
- `SKILL_SUMMARY.md` — One-paragraph summary for quick reference
- `references/conversation-examples.md` — 3 worked examples across archetypes
- `references/workflow-archetypes.md` — Archetype reference (unchanged)
