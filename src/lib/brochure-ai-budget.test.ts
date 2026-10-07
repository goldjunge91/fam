import {
  AiCallBudget,
  DEFAULT_BROCHURE_AI_MAX_CALLS,
  DEFAULT_BROCHURE_AI_MAX_TOKENS,
  DEFAULT_BROCHURE_AI_TIMEOUT_MS,
  parseBrochureAiBudget,
} from '../../scripts/lib/brochure-ai-budget';

describe('brochure AI budget', () => {
  it('uses finite defaults for calls, response tokens, and timeout', () => {
    const budget = parseBrochureAiBudget([], {});

    expect(budget).toEqual({
      maxCalls: DEFAULT_BROCHURE_AI_MAX_CALLS,
      maxTokens: DEFAULT_BROCHURE_AI_MAX_TOKENS,
      timeoutMs: DEFAULT_BROCHURE_AI_TIMEOUT_MS,
    });
  });

  it('lets an explicit CLI value override the environment', () => {
    const budget = parseBrochureAiBudget(
      ['--ai-max-calls=2', '--ai-max-tokens=450', '--ai-timeout-ms=12000'],
      {
        BROCHURE_AI_MAX_CALLS: '9',
        BROCHURE_AI_MAX_TOKENS: '900',
        BROCHURE_AI_TIMEOUT_MS: '90000',
      },
    );

    expect(budget).toEqual({ maxCalls: 2, maxTokens: 450, timeoutMs: 12000 });
  });

  it.each([
    ['BROCHURE_AI_MAX_CALLS', 'Infinity'],
    ['BROCHURE_AI_MAX_CALLS', '-1'],
    ['BROCHURE_AI_MAX_CALLS', '1.5'],
    ['BROCHURE_AI_MAX_TOKENS', '0'],
    ['BROCHURE_AI_TIMEOUT_MS', 'NaN'],
  ])('rejects invalid %s before a request can be budgeted', (name, value) => {
    expect(() => parseBrochureAiBudget([], { [name]: value })).toThrow(/muss/);
  });

  it('never allows more requests than the configured call budget', () => {
    const budget = new AiCallBudget(2);

    expect(budget.tryConsume()).toBe(true);
    expect(budget.tryConsume()).toBe(true);
    expect(budget.tryConsume()).toBe(false);
    expect(budget.callsMade).toBe(2);
    expect(budget.exhausted).toBe(true);
  });
});
