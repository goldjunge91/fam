import { analyticsConfig } from '@/constants/analytics';
import { analyticsToggles } from '@/features/settings/dev/analytics-controls';

describe('analytics dev controls', () => {
  it('deckt den globalen, beide Provider-, alle Kanal- und alle Feature-Schalter ab', () => {
    expect(analyticsToggles).toHaveLength(15);
    expect(new Set(analyticsToggles.map(({ path }) => path)).size).toBe(15);
    expect(analyticsToggles.every(({ getValue }) => getValue(analyticsConfig))).toBe(true);
  });
});
