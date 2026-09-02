import { classifyPerishability } from '@/features/ai-agent-skills/domain/perishability';

describe('classifyPerishability', () => {
  it('classifies known Open Food Facts fresh-food tags as perishable', () => {
    expect(classifyPerishability(['de:milchprodukte', 'en:dairy-products'])).toEqual('perishable');
  });

  it('classifies known pantry tags as non-perishable', () => {
    expect(classifyPerishability(['en:pasta', 'en:pastas'])).toBe('non_perishable');
  });

  it('does not guess when tags are missing, unknown, or contradictory', () => {
    expect(classifyPerishability([])).toBe('unknown');
    expect(classifyPerishability(['en:some-unknown-category'])).toBe('unknown');
    expect(classifyPerishability(['en:dairy-products', 'en:pasta'])).toBe('unknown');
  });
});
