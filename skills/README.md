

# Flowetic Skills

This folder contains platform skills that are loaded deterministically by Flowetic's backend agent runtime.

## Structure (OpenSkills-style)
Each skill lives in:

- `skills/<platformType>/Skill.md` (required)
- `skills/<platformType>/references/*` (optional, progressive disclosure)

This follows the common "skills folder + SKILL/Skill.md" convention used by universal skills loaders like OpenSkills.

## Who consumes Skill.md
Flowetic does not show these files to end users. Instead, the Copilot-connected master agent loads exactly one platform skill at runtime based on `platformType` and injects it into the agent's system instructions.

## Design principle
Keep `Skill.md` concise and journey-focused. Put deep technical reference material in `references/` so it is only loaded when needed.


