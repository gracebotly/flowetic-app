/**
 * Parses a plain-text transcript (Agent:/User: format) into structured messages.
 * Used by both the client-facing portal (VoicePerformanceSkeleton) and the
 * agency-facing View Details drawer (TranscriptViewer).
 */
export function parseTranscript(raw: string): Array<{ role: 'agent' | 'user'; text: string }> {
  if (!raw) return [];
  const messages: Array<{ role: 'agent' | 'user'; text: string }> = [];
  const lines = raw.split('\n');
  let currentRole: 'agent' | 'user' | null = null;
  let currentText = '';

  for (const line of lines) {
    const agentMatch = line.match(/^Agent:\s*(.*)/i);
    const userMatch = line.match(/^User:\s*(.*)/i);

    if (agentMatch) {
      if (currentRole && currentText.trim()) {
        messages.push({ role: currentRole, text: currentText.trim() });
      }
      currentRole = 'agent';
      currentText = agentMatch[1];
    } else if (userMatch) {
      if (currentRole && currentText.trim()) {
        messages.push({ role: currentRole, text: currentText.trim() });
      }
      currentRole = 'user';
      currentText = userMatch[1];
    } else if (currentRole) {
      currentText += ` ${line.trim()}`;
    }
  }

  if (currentRole && currentText.trim()) {
    messages.push({ role: currentRole, text: currentText.trim() });
  }
  return messages;
}
