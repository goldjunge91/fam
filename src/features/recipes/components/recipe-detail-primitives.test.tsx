import { render, screen } from '@testing-library/react-native';

import { HeartGlyph, HeroArtwork } from './recipe-detail-primitives';

describe('recipe detail primitives', () => {
  test('shows a cover image with an accessible recipe label when one is available', async () => {
    await render(<HeroArtwork coverUrl="https://example.test/recipe.jpg" title="Linsensuppe" />);

    expect(screen.getByLabelText('Bild von Linsensuppe')).toBeOnTheScreen();
  });

  test('shows the themed illustration when a cover is unavailable', async () => {
    await render(<HeroArtwork coverUrl={null} title="Linsensuppe" />);

    expect(screen.getByLabelText('Illustration für Linsensuppe')).toBeOnTheScreen();
  });

  test('renders both favorite heart states', async () => {
    const { rerender } = await render(<HeartGlyph filled={false} />);
    expect(screen.getByText('♡')).toBeOnTheScreen();

    await rerender(<HeartGlyph filled />);
    expect(screen.getByText('♥')).toBeOnTheScreen();
  });
});
