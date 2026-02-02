import { Workspace } from '@mastra/core/workspace';

interface WorkflowData {
  sourceId: string;
  externalId: string;
  displayName: string;
  entityKind: string;
  content: string;
}

export async function indexWorkflowToWorkspace(
  workspace: Workspace,
  workflow: WorkflowData
) {
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
    `# ${workflow.displayName}\n\n${workflow.content}`,
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
  const filePath = `/data/${sourceId}/${externalId}.json`;
  await workspace.filesystem?.deleteFile(filePath, { force: true });
}

export async function clearSourceWorkflows(
  workspace: Workspace,
  sourceId: string
) {
  const dirPath = `/data/${sourceId}`;
  const entries = await workspace.filesystem?.readdir(dirPath);
  
  // Delete all files
  for (const entry of entries || []) {
    if (entry.type === 'file') {
      await workspace.filesystem?.deleteFile(`${dirPath}/${entry.name}`, { force: true });
    }
  }
}
