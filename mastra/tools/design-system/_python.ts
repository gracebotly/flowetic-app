
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

export function getPythonCommand(): string {
  // Windows: use Python launcher "py" (works even when python3 alias is missing)
  if (process.platform === "win32") return "py";
  // macOS/Linux: prefer python3; if unavailable, tools can be adjusted later to fallback
  return "python3";
}

function shEscape(arg: string): string {
  // Works in bash-like shells; on Windows, py still receives the arguments correctly in practice
  return `'${String(arg).replace(/'/g, `'\"'\"'`)}'`;
}

export const shell = { shEscape };

export async function runPython(args: string[]): Promise<{ stdout: string; stderr: string }> {
  const python = getPythonCommand();
  const cmd = [python, ...args].join(" ");

  const { stdout, stderr } = await execAsync(cmd, {
    cwd: process.cwd(),
    maxBuffer: 1024 * 1024 * 10, // 10MB
  });

  return { stdout: stdout ?? "", stderr: stderr ?? "" };
}

