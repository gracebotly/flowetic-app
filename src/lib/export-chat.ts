type LegacyMessage = {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
};

type AiSdkPart =
  | { type: 'text'; text: string }
  | { type: string; [key: string]: any };

type AiSdkMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts: AiSdkPart[];
};

function isAiSdkMessageArray(messages: any): messages is AiSdkMessage[] {
  return (
    Array.isArray(messages) &&
    messages.length >= 0 &&
    (messages.length === 0 ||
      (typeof messages[0] === 'object' &&
        messages[0] !== null &&
        'role' in messages[0] &&
        'parts' in messages[0] &&
        Array.isArray((messages[0] as any).parts)))
  );
}

function toLegacyMessages(messages: AiSdkMessage[] | LegacyMessage[]): LegacyMessage[] {
  if (!isAiSdkMessageArray(messages)) {
    return messages as LegacyMessage[];
  }

  return (messages as AiSdkMessage[]).map((m) => {
    const textParts = (m.parts || []).filter((p: any) => p?.type === 'text' && typeof p?.text === 'string');
    const toolParts = (m.parts || []).filter((p: any) => typeof p?.type === 'string' && p.type.startsWith('tool-'));

    const text = textParts.map((p: any) => p.text).join('\n').trim();

    // Include tool outputs in JSON export-friendly way, but keep markdown readable.
    // We append a compact tool marker if there are tool parts and no text.
    if (text) {
      return { id: m.id, role: m.role, content: text };
    }

    if (toolParts.length > 0) {
      const summary = toolParts
        .map((p: any) => {
          const t = p.type;
          if (p.state === 'output-error') return `[${t}] ERROR: ${String(p.errorText || 'Unknown error')}`;
          if (p.state === 'output-available') return `[${t}] OUTPUT`;
          return `[${t}] ${String(p.state || 'unknown')}`;
        })
        .join('\n');

      return { id: m.id, role: m.role, content: summary };
    }

    return { id: m.id, role: m.role, content: '' };
  });
}

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

export function exportAsMarkdown(messages: AiSdkMessage[] | LegacyMessage[]): void {
  const legacy = toLegacyMessages(messages);

  const lines: string[] = [];
  lines.push(`# Flowetic Chat Export\n\n`);
  lines.push(`**Exported:** ${new Date().toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })}\n\n`);
  lines.push(`---\n\n`);

  for (const m of legacy) {
    const header = m.role === 'user' ? '## User' : m.role === 'assistant' ? '## Assistant' : '## System';
    lines.push(header);
    lines.push('');
    lines.push(m.content || '');
    lines.push('');
  }

  lines.push(`---\n\n`);
  lines.push(`*Exported from Getflowetic Vibe Chat*\n`);

  const markdown = lines.join('\n').trim() + '\n';
  downloadFile(markdown, `flowetic-chat-${Date.now()}.md`, "text/markdown");
}

export function exportAsJSON(messages: AiSdkMessage[] | LegacyMessage[]): void {
  // If AI SDK, preserve original for maximal fidelity
  const content = isAiSdkMessageArray(messages) 
    ? JSON.stringify(messages, null, 2)
    : JSON.stringify(messages, null, 2);
  
  downloadFile(content, `flowetic-chat-${Date.now()}.json`, "application/json");
}
