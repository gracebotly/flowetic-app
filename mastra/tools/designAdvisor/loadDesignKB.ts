




import fs from "node:fs/promises";
import path from "node:path";

export async function loadDesignKBFiles(): Promise<
  Array<{ path: string; content: string }>
> {
  const vendorPath = path.join(
    process.cwd(),
    "vendor",
    "ui-ux-pro-max-skill"
  );

  try {
    const files = await fs.readdir(vendorPath);
    const mdFiles = files.filter(
      (f) => f.endsWith(".md") || f.endsWith(".markdown")
    );

    const fileContents = await Promise.all(
      mdFiles.map(async (file) => {
        const filePath = path.join(vendorPath, file);
        const content = await fs.readFile(filePath, "utf-8");
        return {
          path: file,
          content,
        };
      })
    );

    return fileContents;
  } catch (error) {
    console.error("Failed to load design KB files:", error);
    return [];
  }
}

export async function loadDesignKBFile(
  filename: string
): Promise<string | null> {
  const filePath = path.join(
    process.cwd(),
    "vendor",
    "ui-ux-pro-max-skill",
    filename
  );

  try {
    return await fs.readFile(filePath, "utf-8");
  } catch (error) {
    console.error(`Failed to load design KB file ${filename}:`, error);
    return null;
  }
}



