import { render, screen, userEvent } from '@testing-library/react-native';

import type { RecipeStep } from '../../hooks/use-recipe-steps';
import type { RecipeDetail } from '../../hooks/use-recipes';
import { CookingModePlusFlow } from './cooking-mode-plus-flow';

const mockUseCatalogImageUrl = jest.fn();

jest.mock('../../catalog/use-recipe-catalog', () => ({
  useCatalogImageUrl: (...args: unknown[]) => mockUseCatalogImageUrl(...args),
}));
jest.mock('../../hooks/use-cooking-mode-voice', () => ({
  useCookingModeVoice: (options: Record<string, unknown>) => ({
    status: 'ready',
    error: null,
    startListening: jest.fn(),
    stopListening: jest.fn(),
    readStep: jest.fn(),
    stopReading: jest.fn(),
    onNextStep: options.onNextStep,
    onPreviousStep: options.onPreviousStep,
    onStartTimer: options.onStartTimer,
    onFinish: options.onFinish,
  }),
}));
jest.mock('../../hooks/use-cooking-timer', () => ({
  useCookingTimer: () => ({
    remainingSeconds: 60,
    running: false,
    start: jest.fn(),
    pause: jest.fn(),
    reset: jest.fn(),
  }),
}));
jest.mock('./cooking-mode-no-steps', () => {
  const React = require('react') as typeof import('react');
  const { Pressable, Text } = require('react-native') as typeof import('react-native');
  return {
    CookingModeNoSteps: ({ onFinish }: { onFinish: () => void }) =>
      React.createElement(
        Pressable,
        { accessibilityRole: 'button', accessibilityLabel: 'finish-empty', onPress: onFinish },
        React.createElement(Text, null, 'Keine Schritte'),
      ),
  };
});
jest.mock('./cooking-mode-step', () => {
  const React = require('react') as typeof import('react');
  const { Pressable, Text } = require('react-native') as typeof import('react-native');
  return {
    CookingModeStep: ({
      onNextStep,
      onPreviousStep,
    }: {
      onNextStep: () => void;
      onPreviousStep: () => void;
    }) =>
      React.createElement(
        React.Fragment,
        null,
        React.createElement(
          Pressable,
          { accessibilityRole: 'button', accessibilityLabel: 'next-step', onPress: onNextStep },
          React.createElement(Text, null, 'Weiter'),
        ),
        React.createElement(
          Pressable,
          {
            accessibilityRole: 'button',
            accessibilityLabel: 'previous-step',
            onPress: onPreviousStep,
          },
          React.createElement(Text, null, 'Zurück'),
        ),
      ),
  };
});

const recipe = { id: 'recipe-1', title: 'Suppe' } as RecipeDetail['recipe'];

function step(id: string, position: number): RecipeStep {
  return {
    id,
    recipe_id: 'recipe-1',
    position,
    text: 'Zwiebeln schneiden',
    image_path: null,
    timer_minutes: null,
    ingredientIds: [],
  };
}

describe('CookingModePlusFlow', () => {
  beforeEach(() => {
    mockUseCatalogImageUrl.mockReset();
    mockUseCatalogImageUrl.mockReturnValue({ data: null });
  });

  it('renders the no-steps fallback and forwards finish', async () => {
    const onFinish = jest.fn();
    const user = userEvent.setup();

    await render(
      <CookingModePlusFlow recipe={recipe} steps={[]} ingredients={[]} onFinish={onFinish} />,
    );

    await user.press(screen.getByRole('button', { name: 'finish-empty' }));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('clamps the initial step and finishes from the last step', async () => {
    const onFinish = jest.fn();
    const user = userEvent.setup();
    const steps = [step('step-1', 0), step('step-2', 1)];

    await render(
      <CookingModePlusFlow
        recipe={recipe}
        steps={steps}
        ingredients={[]}
        initialStepIndex={99}
        onFinish={onFinish}
      />,
    );

    await user.press(screen.getByRole('button', { name: 'next-step' }));
    expect(onFinish).toHaveBeenCalledWith(1);
    await user.press(screen.getByRole('button', { name: 'previous-step' }));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});
