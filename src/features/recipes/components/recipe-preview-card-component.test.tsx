import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { debugError } from '@/lib/observability/debug-log';
import { RecipeArtwork, RecipeHeroCard, RecipePreviewCard } from './recipe-preview-card';

jest.mock('expo-image', () => ({
  Image: require('react-native').Image,
}));

jest.mock('../catalog/use-recipe-catalog', () => ({
  useCatalogImageUrl: jest.fn((path: string | null) => ({
    data: path ? `catalog:${path}` : null,
  })),
}));

jest.mock('../data/household-recipe-images', () => ({
  useRecipeCoverUrl: jest.fn((path: string | null) => ({
    data: path ? `household:${path}` : null,
  })),
}));

jest.mock('@/lib/observability/debug-log', () => ({
  debugError: jest.fn(),
  debugLog: jest.fn(),
}));

const mockDebugError = jest.mocked(debugError);

describe('RecipeArtwork', () => {
  beforeEach(() => mockDebugError.mockClear());

  it('zeigt das Titelbild und meldet einen Ladefehler', async () => {
    await render(<RecipeArtwork title="Linsensuppe" coverUrl="https://example.test/soup.jpg" />);

    fireEvent(screen.getByLabelText('Bild von Linsensuppe'), 'error', {
      error: 'network unavailable',
    });

    expect(mockDebugError).toHaveBeenCalledWith('[RecipeCover] image:error', {
      title: 'Linsensuppe',
      path: null,
      message: 'network unavailable',
    });
  });

  it('zeichnet eine Illustration, wenn kein Titelbild vorhanden ist', async () => {
    await render(<RecipeArtwork title="Haferbrei" />);

    expect(screen.getByLabelText('Illustration für Haferbrei')).toBeOnTheScreen();
  });
});

describe('recipe preview cards', () => {
  it('zeigt Standard-Metadaten und öffnet die Rezeptkarte', async () => {
    const user = userEvent.setup();
    const onPress = jest.fn();
    await render(<RecipePreviewCard title="Bohnensalat" onPress={onPress} />);

    expect(screen.getByText('Rezept')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Bohnensalat' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('zeigt Haushalts-Cover und alle vorhandenen Metadaten', async () => {
    await render(
      <RecipePreviewCard
        title="Ofengemüse"
        coverImagePath="covers/ofengemuese.jpg"
        cookTimeMinutes={40}
        difficultyLabel="Einfach"
        servings={2}
        onPress={jest.fn()}
      />,
    );

    expect(screen.getByText('40 Min · Einfach · 2 Port.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Bild von Ofengemüse')).toBeOnTheScreen();
  });

  it('lädt ein Katalog-Cover und erlaubt ein individuelles Hero-Label', async () => {
    await render(
      <RecipeHeroCard
        title="Kartoffelsalat"
        coverImagePath="catalog/kartoffel.jpg"
        coverSource="catalog"
        eyebrow="Für heute"
        onPress={jest.fn()}
      />,
    );

    expect(screen.getByText('Für heute')).toBeOnTheScreen();
    expect(screen.getByLabelText('Bild von Kartoffelsalat')).toBeOnTheScreen();
    expect(screen.getByText('Entdecke dieses Rezept')).toBeOnTheScreen();
  });
});
