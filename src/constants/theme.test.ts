import { withAlpha } from '@/components/theme/index';

describe('withAlpha', () => {
  test('wandelt einen Hex-Farbwert in einen passenden rgba()-String um', () => {
    expect(withAlpha('#594059', 0.1)).toBe('rgba(89, 64, 89, 0.1)');
  });

  test('funktioniert auch ohne fuehrendes #', () => {
    expect(withAlpha('2A1F2C', 0.18)).toBe('rgba(42, 31, 44, 0.18)');
  });
});
