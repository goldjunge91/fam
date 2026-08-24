import { describe, expect, it } from 'vitest';
import { LLM_LABEL_INSTRUCTIONS, LLM_PROMPT_FINGERPRINT } from './llm-labeler';

describe('LLM labeling rubric', () => {
  it('enthält alle Kategorien und besitzt einen stabilen Fingerprint', () => {
    expect(LLM_LABEL_INSTRUCTIONS).toContain('fresh_produce:');
    expect(LLM_LABEL_INSTRUCTIONS).toContain('other:');
    expect(LLM_PROMPT_FINGERPRINT).toMatch(/^[a-f0-9]{64}$/);
  });
});
