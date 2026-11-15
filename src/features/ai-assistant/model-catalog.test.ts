import {
  AI_MODEL_CATALOG,
  AI_PROVIDER_LABELS,
  AI_PROVIDERS,
  DEFAULT_AI_MODELS,
  isAiProvider,
  isModelAvailable,
  isValidAiModelId,
} from './model-catalog';

describe('AI model catalog', () => {
  it('defines both providers and their defaults', () => {
    expect(AI_PROVIDERS).toEqual(['openrouter', 'groq']);
    expect(AI_PROVIDER_LABELS).toEqual({ openrouter: 'OpenRouter', groq: 'Groq' });
    expect(DEFAULT_AI_MODELS.openrouter).toBe(AI_MODEL_CATALOG.openrouter[0]?.id);
    expect(DEFAULT_AI_MODELS.groq).toBe(AI_MODEL_CATALOG.groq[0]?.id);
  });

  it.each([
    ['openrouter', true],
    ['groq', true],
    ['other', false],
    [null, false],
  ])('validates provider %s', (value, expected) => {
    expect(isAiProvider(value)).toBe(expected);
  });

  it('checks provider model availability', () => {
    expect(isModelAvailable('openrouter', DEFAULT_AI_MODELS.openrouter)).toBe(true);
    expect(isModelAvailable('groq', DEFAULT_AI_MODELS.groq)).toBe(true);
    expect(isModelAvailable('groq', DEFAULT_AI_MODELS.openrouter)).toBe(false);
  });

  it.each([
    ['model/name', true],
    ['A-1._:/model', true],
    ['', false],
    ['not valid', false],
    ['model'.repeat(33), false],
    [42, false],
  ])('validates model id %s', (value, expected) => {
    expect(isValidAiModelId(value)).toBe(expected);
  });
});
