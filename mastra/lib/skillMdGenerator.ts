/**
 * Generates skill_md markdown content from workflow/scenario data.
 * This provides rich context for the AI agent during chat.
 */

export interface WorkflowData {
  platform: 'n8n' | 'make' | 'vapi' | 'retell';
  id: string;
  name: string;
  description?: string;
  nodes?: any[];
  modules?: any[];
  triggers?: any[];
  status?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  executionStats?: {
    total: number;
    success: number;
    failed: number;
    lastRun?: string;
  };
  recentExecutions?: Array<{
    id: string;
    status: string;
    startedAt: string;
    duration?: number;
    error?: string;
  }>;
}

export function generateSkillMd(data: WorkflowData): string {
  const sections: string[] = [];

  // Header
  sections.push(`# ${data.name}`);
  sections.push(`**Platform:** ${data.platform.toUpperCase()}`);
  sections.push(`**ID:** ${data.id}`);

  if (data.status) {
    sections.push(`**Status:** ${data.status}`);
  }

  if (data.description) {
    sections.push(`\n## Description\n${data.description}`);
  }

  // Workflow Structure
  if (data.platform === 'n8n' && data.nodes?.length) {
    sections.push(`\n## Workflow Structure`);
    sections.push(`Total nodes: ${data.nodes.length}`);

    const nodeTypes = new Map<string, number>();
    const triggers: string[] = [];

    for (const node of data.nodes) {
      const type = node.type || 'unknown';
      nodeTypes.set(type, (nodeTypes.get(type) || 0) + 1);

      if (type.includes('Trigger') || type.includes('webhook')) {
        triggers.push(node.name || type);
      }
    }

    if (triggers.length) {
      sections.push(`\n**Triggers:** ${triggers.join(', ')}`);
    }

    sections.push(`\n**Node types:**`);
    for (const [type, count] of Array.from(nodeTypes.entries()).slice(0, 10)) {
      const shortType = type.replace('n8n-nodes-base.', '');
      sections.push(`- ${shortType}: ${count}`);
    }
  }

  // Make Scenario Structure
  if (data.platform === 'make' && data.modules?.length) {
    sections.push(`\n## Scenario Structure`);
    sections.push(`Total modules: ${data.modules.length}`);

    const moduleTypes = new Map<string, number>();
    for (const mod of data.modules) {
      const type = mod.module || mod.name || 'unknown';
      moduleTypes.set(type, (moduleTypes.get(type) || 0) + 1);
    }

    sections.push(`\n**Module types:**`);
    for (const [type, count] of Array.from(moduleTypes.entries()).slice(0, 10)) {
      sections.push(`- ${type}: ${count}`);
    }
  }

  // Vapi/Retell Voice Config
  if ((data.platform === 'vapi' || data.platform === 'retell') && data.triggers) {
    sections.push(`\n## Voice Configuration`);
    for (const trigger of data.triggers) {
      if (trigger.type) sections.push(`- **Type:** ${trigger.type}`);
      if (trigger.model) sections.push(`- **Model:** ${trigger.model}`);
      if (trigger.voice) sections.push(`- **Voice:** ${trigger.voice}`);
    }
  }

  // Execution Statistics
  if (data.executionStats) {
    const stats = data.executionStats;
    const successRate = stats.total > 0
      ? Math.round((stats.success / stats.total) * 100)
      : 0;

    sections.push(`\n## Performance Metrics`);
    sections.push(`- **Total executions:** ${stats.total}`);
    sections.push(`- **Success rate:** ${successRate}%`);
    sections.push(`- **Failed:** ${stats.failed}`);
    if (stats.lastRun) {
      sections.push(`- **Last run:** ${stats.lastRun}`);
    }
  }

  // Recent Executions
  if (data.recentExecutions?.length) {
    sections.push(`\n## Recent Activity`);
    for (const exec of data.recentExecutions.slice(0, 5)) {
      const status = exec.status === 'success' ? '✅' : '❌';
      const duration = exec.duration ? ` (${exec.duration}ms)` : '';
      sections.push(`- ${status} ${exec.startedAt}${duration}`);
      if (exec.error) {
        sections.push(`  Error: ${exec.error.slice(0, 100)}`);
      }
    }
  }

  // Timestamps
  sections.push(`\n---`);
  sections.push(`*Generated: ${new Date().toISOString()}*`);
  if (data.updatedAt) {
    sections.push(`*Last modified: ${data.updatedAt}*`);
  }

  return sections.join('\n');
}
