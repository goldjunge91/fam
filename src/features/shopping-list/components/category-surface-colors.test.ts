import { colorsDark, colorsLight } from '@/components/theme';
import { PLACEMENT_ZONE_DEFINITIONS } from '../classification/placement-taxonomy';
import { categorySurfaceColors } from './category-surface-colors';

function luminance(color: string): number {
  const matched = color.slice(1).match(/../gu);
  if (matched?.length !== 3) throw new Error(`Invalid test color: ${color}`);

  const [red, green, blue] = matched
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(first: string, second: string): number {
  const firstLuminance = luminance(first);
  const secondLuminance = luminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('category surface colors', () => {
  it.each([
    ['light', colorsLight],
    ['dark', colorsDark],
  ] as const)('keeps every taxonomy color readable in the %s theme', (_theme, colors) => {
    for (const zone of PLACEMENT_ZONE_DEFINITIONS) {
      const pair = categorySurfaceColors(zone.color, colors);
      expect(contrastRatio(pair.background, pair.text)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
