import fs from 'node:fs/promises';
import path from 'node:path';

async function listFiles(dir) {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === ".git" || e.name === "node_modules") continue;
      out.push(...await listFiles(full));
    } else {
      out.push(full);
    }
  }
  return out;
}
function isSupported(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ext === ".md" || ext === ".txt";
}
async function loadDesignKBFiles() {
  const root = process.env.DESIGN_KB_ROOT || path.join(process.cwd(), "vendor", "ui-ux-pro-max-skill");
  const files = (await listFiles(root)).filter(isSupported);
  const results = [];
  for (const filePath of files) {
    const content = await fs.readFile(filePath, "utf8").catch(() => "");
    if (!content) continue;
    results.push({
      path: path.relative(root, filePath).replaceAll("\\", "/"),
      content
    });
  }
  return results;
}

export { loadDesignKBFiles };
