import { render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import type { RecipeStep } from '../../hooks/use-recipe-steps';
import { CookingModeArtwork } from './cooking-mode-artwork';

const mockUseRecipeStepImageUrl = jest.fn();

jest.mock('expo-image', () => {
  const React = require('react') as typeof import('react');
  const { View: NativeView } = require('react-native') as typeof import('react-native');
  return {
    Image: ({ testID }: { testID?: string }) =>
      React.createElement(NativeView, { testID: testID ?? 'recipe-image' }),
  };
});
jest.mock('react-native-svg', () => {
  const React = require('react') as typeof import('react');
  const { View: NativeView } = require('react-native') as typeof import('react-native');
  return {
    __esModule: true,
    default: ({ children }: { children: ReactNode }) =>
      React.createElement(NativeView, null, children),
    Circle: () => React.createElement(NativeView, { testID: 'artwork-ring' }),
    Defs: ({ children }: { children: ReactNode }) =>
      React.createElement(NativeView, null, children),
    LinearGradient: ({ children }: { children?: ReactNode }) =>
      React.createElement(NativeView, null, children),
    Rect: () => React.createElement(NativeView, { testID: 'artwork-background' }),
    Stop: () => React.createElement(NativeView),
  };
});
jest.mock('../../data/household-recipe-images', () => ({
  useRecipeStepImageUrl: (...args: unknown[]) => mockUseRecipeStepImageUrl(...args),
}));

function step(overrides: Partial<RecipeStep> = {}): RecipeStep {
  return {
    id: 'step-1',
    recipe_id: 'recipe-1',
    position: 0,
    text: 'Zwiebeln schneiden',
    image_path: null,
    timer_minutes: null,
    ingredientIds: [],
    ...overrides,
  };
}

describe('CookingModeArtwork', () => {
  beforeEach(() => {
    mockUseRecipeStepImageUrl.mockReset();
  });

  it('renders the provided image before the household image lookup', async () => {
    mockUseRecipeStepImageUrl.mockReturnValue({ data: 'https://example.com/household.jpg' });

    await render(<CookingModeArtwork step={step()} imageUrl="https://example.com/provided.jpg" />);

    expect(screen.getByTestId('recipe-image')).toBeOnTheScreen();
    expect(mockUseRecipeStepImageUrl).toHaveBeenCalledWith(null);
  });

  it('renders a household image when no explicit image is provided', async () => {
    mockUseRecipeStepImageUrl.mockReturnValue({ data: 'https://example.com/household.jpg' });

    await render(<CookingModeArtwork step={step({ image_path: 'steps/step.jpg' })} />);

    expect(screen.getByTestId('recipe-image')).toBeOnTheScreen();
    expect(mockUseRecipeStepImageUrl).toHaveBeenCalledWith('steps/step.jpg');
  });

  it('renders the generated artwork when no image exists', async () => {
    mockUseRecipeStepImageUrl.mockReturnValue({ data: null });

    await render(<CookingModeArtwork step={step({ position: 2 })} />);

    expect(screen.getByTestId('artwork-ring')).toBeOnTheScreen();
    expect(screen.getByTestId('artwork-background')).toBeOnTheScreen();
  });
});
