import { render, screen } from '@testing-library/react-native';
import type { FoundationCategory } from './showcase-foundations';
import { FoundationsShowcase } from './showcase-foundations';

it.each([
  ['theme', 'Theme-Laufzeit'],
  ['colors', 'Farben und Töne'],
  ['typography', 'Typografie'],
  ['tokens', 'Abstände, Formen und Effekte'],
] as const satisfies readonly [FoundationCategory, string][])(
  'renders the %s reference page',
  async (category, title) => {
    await render(<FoundationsShowcase category={category} />);

    expect(screen.getByText(title)).toBeOnTheScreen();
  },
);
