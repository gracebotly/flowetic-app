
import { exec } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export function getUiUxProMaxSearchScriptPath(): string {
  return path.join(
    process.cwd(),
    ".agent",
    "skills",
    "ui-ux-pro-max",
    "scripts",
    "search.py",
  );
}

function shEscape(arg: string): string {
  // Safe for bash-like shells: wrap in single quotes and escape internal single quotes
  return `'${String(arg).replace(/'/g, `'\"'\"'`)}'`;
}

export async function runPythonSearch(args: string[]): Promise<{ stdout: string; stderr: string }> {
  const cmd = ["python3", ...args].join(" ");
  const { stdout, stderr } = await execAsync(cmd, {
    cwd: process.cwd(),
    maxBuffer: 1024 * 1024 * 10, // 10MB
  });
  return { stdout: stdout ?? "", stderr: stderr ?? "" };
}

export const shell = { shEscape };

