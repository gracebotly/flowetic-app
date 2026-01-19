
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
    } else if (entry.isFile()) {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

const repoRoot = process.cwd();

// Source of truth: your existing repo-root skills folder
// (this already exists in main, and is what your agents expect semantically)
const srcSkills = path.join(repoRoot, "skills");

// Mastra dev/build runtime CWD is .mastra/output (proven by stack trace),
// so the bundled loader looks for ./skills/** relative to that.
const outSkills = path.join(repoRoot, ".mastra", "output", "skills");

if (!(await exists(srcSkills))) {
  console.error(`[sync-mastra-output-skills] Missing source skills folder: ${srcSkills}`);
  process.exit(1);
}

if (!(await exists(path.join(repoRoot, ".mastra", "output")))) {
  console.error(
    `[sync-mastra-output-skills] Missing .mastra/output. Run 'mastra dev --dir ./mastra' first.`,
  );
  process.exit(1);
}

await copyDir(srcSkills, outSkills);
console.log(`[sync-mastra-output-skills] Copied ${srcSkills} -> ${outSkills}`);
