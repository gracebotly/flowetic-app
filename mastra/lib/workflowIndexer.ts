import { Workspace } from '@mastra/core/workspace';

interface WorkflowData {
  sourceId: string;
  externalId: string;
  displayName: string;
  entityKind: string;
  content: string;
}

/**
 * Safely check if workspace filesystem is writable.
 * On Vercel serverless, LocalFilesystem is readOnly: true,
 * so all write operations should gracefully skip.
 */
function isWritable(workspace: Workspace): boolean {
  const fs = workspace.filesystem as any;
  if (!fs) return false;
  // LocalFilesystem exposes readOnly as a property
  if (fs.readOnly === true) return false;
  if (fs._readOnly === true) return false;
  // If config object exists, check there too
  if (fs.config?.readOnly === true) return false;
  return true;
}

export async function indexWorkflowToWorkspace(
  workspace: Workspace,
  workflow: WorkflowData
) {
  // Skip filesystem operations if workspace is read-only (Vercel serverless)
  if (!isWritable(workspace)) {
    return `/data/${workflow.sourceId}/${workflow.externalId}.json`;
  }

  const filePath = `/data/${workflow.sourceId}/${workflow.externalId}.json`;
  const fileContent = JSON.stringify({
    name: workflow.displayName,
    kind: workflow.entityKind,
    content: workflow.content,
    sourceId: workflow.sourceId,
    externalId: workflow.externalId,
  }, null, 2);

  // Write to workspace filesystem
  await workspace.filesystem?.writeFile(filePath, fileContent, { recursive: true });

  // Index for search
  await workspace.index(
    filePath,
    `# ${workflow.displayName}

${workflow.content}`,
    {
      metadata: {
        sourceId: workflow.sourceId,
        externalId: workflow.externalId,
        entityKind: workflow.entityKind,
        displayName: workflow.displayName,
      }
    }
  );

  return filePath;
}

export async function removeWorkflowFromWorkspace(
  workspace: Workspace,
  sourceId: string,
  externalId: string
) {
  // Skip if read-only
  if (!isWritable(workspace)) return;

  const filePath = `/data/${sourceId}/${externalId}.json`;
  await workspace.filesystem?.deleteFile(filePath, { force: true });
}

export async function clearSourceWorkflows(
  workspace: Workspace,
  sourceId: string
) {
  // Skip if read-only
  if (!isWritable(workspace)) return;

  const dirPath = `/data/${sourceId}`;

  let entries: any[] | undefined;
  try {
    entries = await workspace.filesystem?.readdir(dirPath);
  } catch (e: any) {
    // Directory doesn't exist — nothing to clear
    if (e?.code === 'ENOENT') return;
    throw e;
  }

  // Delete all files
  for (const entry of entries || []) {
    if (entry.type === 'file') {
      await workspace.filesystem?.deleteFile(`${dirPath}/${entry.name}`, { force: true });
    }
  }
}
