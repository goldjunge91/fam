import { assertEquals } from 'jsr:@std/assert@1';

import { resolveFoodRuleCoverage } from './food-rule-coverage.ts';

Deno.test('accepts an opaque household snapshot hash as the current rule version', () => {
  const version = `sha256:${'a'.repeat(64)}`;
  const result = resolveFoodRuleCoverage({
    rules: { allergyCodes: ['peanuts'], updatedAt: version },
    recipe: {
      allergenProjection: {
        status: 'clear',
        allergenIds: ['EU_05_PEANUTS'],
        conflictingAllergenIds: [],
        unknownAllergenIds: [],
        rulesUpdatedAt: version,
        knowledgeVersion: 'knowledge-v1',
      },
      ingredientDataComplete: true,
    },
    aliases: [],
  });

  assertEquals(result.status, 'clear');
  assertEquals(result.entries[0]?.reason, 'reviewed_allergen_clear');
});
