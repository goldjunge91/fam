import { formatBuildDuration } from '../scripts/native-build/build-timer';

describe('build timer duration formatting', () => {
  it('keeps short durations readable', () => {
    expect(formatBuildDuration(840)).toBe('840ms');
    expect(formatBuildDuration(1_240)).toBe('1s');
  });

  it('formats long builds as minutes and seconds', () => {
    expect(formatBuildDuration(125_000)).toBe('2m 05s');
  });
});
