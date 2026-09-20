/** Combines ExecuTorch's finalized and in-progress stream portions for display. */
export function combineSpeechTranscript(committed: string, nonCommitted: string): string {
  return [committed.trim(), nonCommitted.trim()].filter(Boolean).join(' ');
}
