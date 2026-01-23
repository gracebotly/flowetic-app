
import { copyFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

// Skills to copy
const skills = ['make', 'n8n', 'activepieces', 'retell', 'vapi', 'todo', 'frontend-design'];

// Source and destination
const sourceBase = join(projectRoot, 'mastra', 'public', 'skills');
const destBase = join(projectRoot, '.mastra', 'output', 'skills');

console.log('[copy-skills] Copying skill files to .mastra/output/skills/...');

skills.forEach(skill => {
  const sourceFile = join(sourceBase, skill, 'Skill.md');
  const destDir = join(destBase, skill);
  const destFile = join(destDir, 'Skill.md');

  try {
    mkdirSync(destDir, { recursive: true });
    copyFileSync(sourceFile, destFile);
    console.log(`[copy-skills] ✓ Copied ${skill}/Skill.md`);
  } catch (error) {
    console.error(`[copy-skills] ✗ Failed to copy ${skill}/Skill.md:`, error.message);
  }
});

console.log('[copy-skills] Done! Skills are now available in .mastra/output/skills/');
