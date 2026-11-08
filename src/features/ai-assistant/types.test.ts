import { AI_CONSENT_VERSION, createLocalId, DEFAULT_AI_MODEL } from './types';

describe('assistant model and local identifiers', () => {
  it('uses the supported default model and current consent version', () => {
    expect(DEFAULT_AI_MODEL).toBe('z-ai/glm-5.3-flash');
    expect(AI_CONSENT_VERSION).toBe('fam-ai-v2');
  });

  it('creates prefixed ids with a timestamp and random suffix', () => {
    expect(createLocalId('chat')).toMatch(/^chat-[a-z0-9]+-[a-z0-9]+$/u);
  });
});
