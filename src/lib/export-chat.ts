type ExportMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: string;
};

type ExportContext = {
  chatId: string;
  currentPhase: string;
  platformType?: string;
  sourceId?: string;
  entityId?: string;
  selectedOutcome?: string | null;
  selectedStoryboard?: string | null;
  selectedStyleBundle?: string | null;
  selectedModel?: string;
};

/**
 * Export chat messages as Markdown file
 */
export function exportAsMarkdown(
  messages: ExportMessage[],
  context: ExportContext
): void {
  const timestamp = new Date().toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const phaseLabels: Record<string, string> = {
    select_entity: "Entity Selection",
    recommend: "Outcome Selection",
    align: "Storyboard Alignment",
    style: "Style Selection",
    build_preview: "Building Preview",
    interactive_edit: "Interactive Editing",
    deploy: "Deployment",
  };

  let markdown = `# Flowetic Chat Export\n\n`;
  markdown += `**Exported:** ${timestamp}\n`;
  markdown += `**Chat ID:** ${context.chatId}\n`;
  markdown += `**Phase:** ${phaseLabels[context.currentPhase] || context.currentPhase}\n`;

  if (context.platformType) {
    markdown += `**Platform:** ${context.platformType}\n`;
  }
  if (context.selectedOutcome) {
    markdown += `**Selected Outcome:** ${context.selectedOutcome}\n`;
  }
  if (context.selectedModel) {
    markdown += `**Model:** ${context.selectedModel}\n`;
  }

  markdown += `\n---\n\n`;

  messages.forEach((msg) => {
    markdown += `## ${msg.role}\n`;
    markdown += `${msg.content}\n\n`;
  });

  markdown += `---\n\n`;
  markdown += `*Exported from Getflowetic Vibe Chat*\n`;

  downloadFile(
    markdown,
    `flowetic-chat-${Date.now()}.md`,
    "text/markdown"
  );
}

/**
 * Export chat messages as JSON file
 */
export function exportAsJSON(
  messages: ExportMessage[],
  context: ExportContext
): void {
  const exportData = {
    chatId: context.chatId,
    exportedAt: new Date().toISOString(),
    currentPhase: context.currentPhase,
    context: {
      platformType: context.platformType,
      sourceId: context.sourceId,
      entityId: context.entityId,
      selectedOutcome: context.selectedOutcome,
      selectedStoryboard: context.selectedStoryboard,
      selectedStyleBundle: context.selectedStyleBundle,
      selectedModel: context.selectedModel,
    },
    messages: messages.map((msg) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      createdAt: msg.createdAt || new Date().toISOString(),
    })),
  };

  const jsonString = JSON.stringify(exportData, null, 2);

  downloadFile(
    jsonString,
    `flowetic-chat-${Date.now()}.json`,
    "application/json"
  );
}

/**
 * Helper function to trigger file download
 */
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
