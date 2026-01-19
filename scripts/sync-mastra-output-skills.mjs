
import fs from "node:fs/promises";
import path from "node:path";

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
      continue;
    }

    if (entry.isFile()) {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

const repoRoot = process.cwd();

// Source folder (repo-root) that already exists in your project
const srcSkills = path.join(repoRoot, "skills");

// Destination folder required by your currently bundled loadSkill() logic
const outDir = path.join(repoRoot, ".mastra", "output");
const outSkills = path.join(outDir, "skills");

if (!(await exists(srcSkills))) {
  console.error(`[sync-mastra-output-skills] Missing source skills folder: ${srcSkills}`);
  process.exit(1);
}

if (!(await exists(outDir))) {
  console.error(
    `[sync-mastra-output-skills] Missing ${outDir}. Start mastra dev/build first so output exists.`,
  );
  process.exit(1);
}

await copyDir(srcSkills, outSkills);
console.log(`[sync-mastra-output-skills] Copied ${srcSkills} -> ${outSkills}`);
