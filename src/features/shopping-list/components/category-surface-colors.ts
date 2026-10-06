import type { Palette } from '@/components/theme';

type TextColors = Pick<Palette, 'text' | 'onAccent'>;
type RGB = readonly [number, number, number];

const MIN_TEXT_CONTRAST = 4.5;

function parseHex(color: string): RGB | null {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/iu.exec(color);
  if (!match) return null;
  return [
    Number.parseInt(match[1], 16),
    Number.parseInt(match[2], 16),
    Number.parseInt(match[3], 16),
  ];
}

function luminance([red, green, blue]: RGB): number {
  const channels = [red, green, blue].map((channel) => channel / 255);
  const [linearRed, linearGreen, linearBlue] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linearRed + 0.7152 * linearGreen + 0.0722 * linearBlue;
}

function contrastRatio(background: RGB, foreground: RGB): number {
  const backgroundLuminance = luminance(background);
  const foregroundLuminance = luminance(foreground);
  const lighter = Math.max(backgroundLuminance, foregroundLuminance);
  const darker = Math.min(backgroundLuminance, foregroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function mix(first: RGB, second: RGB, amount: number): RGB {
  return [
    Math.round(first[0] + (second[0] - first[0]) * amount),
    Math.round(first[1] + (second[1] - first[1]) * amount),
    Math.round(first[2] + (second[2] - first[2]) * amount),
  ];
}

function toHex([red, green, blue]: RGB): string {
  return `#${[red, green, blue].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function nearestReadablePair(background: RGB, colors: TextColors) {
  const textOptions = [
    { foreground: colors.text, targetBackground: colors.onAccent },
    { foreground: colors.onAccent, targetBackground: colors.text },
  ]
    .map(({ foreground, targetBackground }) => {
      const foregroundRgb = parseHex(foreground);
      const targetRgb = parseHex(targetBackground);
      if (!foregroundRgb || !targetRgb) return null;
      if (contrastRatio(targetRgb, foregroundRgb) < MIN_TEXT_CONTRAST) return null;

      let low = 0;
      let high = 1;
      for (let step = 0; step < 20; step += 1) {
        const middle = (low + high) / 2;
        if (contrastRatio(mix(background, targetRgb, middle), foregroundRgb) >= MIN_TEXT_CONTRAST) {
          high = middle;
        } else {
          low = middle;
        }
      }

      return { amount: high, foreground, background: mix(background, targetRgb, high) };
    })
    .filter((option): option is NonNullable<typeof option> => option !== null)
    .sort((first, second) => first.amount - second.amount);

  return textOptions[0] ?? null;
}

export function categorySurfaceColors(
  color: string,
  colors: TextColors & Pick<Palette, 'backgroundElement'>,
) {
  const categoryRgb = parseHex(color);
  const themeTextRgb = parseHex(colors.text);
  const themeOnAccentRgb = parseHex(colors.onAccent);
  if (!categoryRgb || !themeTextRgb || !themeOnAccentRgb) {
    return { background: colors.backgroundElement, text: colors.text };
  }

  const originalTextContrast = contrastRatio(categoryRgb, themeTextRgb);
  const originalOnAccentContrast = contrastRatio(categoryRgb, themeOnAccentRgb);
  if (Math.max(originalTextContrast, originalOnAccentContrast) >= MIN_TEXT_CONTRAST) {
    return {
      background: color,
      text: originalTextContrast >= originalOnAccentContrast ? colors.text : colors.onAccent,
    };
  }

  const adjusted = nearestReadablePair(categoryRgb, colors);
  return adjusted
    ? { background: toHex(adjusted.background), text: adjusted.foreground }
    : { background: colors.backgroundElement, text: colors.text };
}
