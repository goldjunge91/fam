import { render, screen, userEvent } from '@testing-library/react-native';

import type { RecipeStep } from '../../hooks/use-recipe-steps';
import type { RecipeDetail } from '../../hooks/use-recipes';
import { CookingModePlusFlow } from './cooking-mode-plus-flow';

const mockUseCatalogImageUrl = jest.fn();
const mockStartHandsFree = jest.fn();
const mockPauseHandsFree = jest.fn();
const mockResumeHandsFree = jest.fn();
const mockTimerStart = jest.fn();
const mockTimerPause = jest.fn();
const mockTimerReset = jest.fn();
const mockUseKeepAwake = jest.fn();
let mockVoiceOptions: Record<string, unknown> = {};
let mockStepHandlers: {
  onPauseHandsFree?: () => void;
  onResumeHandsFree?: () => void;
} | null = null;
let mockHandsFreeActive = false;
let mockTimerRunning = true;

jest.mock('expo-keep-awake', () => ({
  useKeepAwake: (...args: unknown[]) => mockUseKeepAwake(...args),
}));

jest.mock('../../catalog/use-recipe-catalog', () => ({
  useCatalogImageUrl: (...args: unknown[]) => mockUseCatalogImageUrl(...args),
}));
jest.mock('../../hooks/use-cooking-mode-voice', () => ({
  useCookingModeVoice: (options: Record<string, unknown>) => {
    mockVoiceOptions = options;
    return {
      status: 'ready',
      error: null,
      startListening: jest.fn(),
      stopListening: jest.fn(),
      readStep: jest.fn(),
      stopReading: jest.fn(),
      handsFreeEnabled: mockHandsFreeActive,
      startHandsFree: mockStartHandsFree,
      pauseHandsFree: mockPauseHandsFree,
      resumeHandsFree: mockResumeHandsFree,
      endHandsFree: jest.fn(),
      onNextStep: options.onNextStep,
      onPreviousStep: options.onPreviousStep,
      onStartTimer: options.onStartTimer,
      onFinish: options.onFinish,
    };
  },
}));
jest.mock('../../hooks/use-cooking-timer', () => ({
  useCookingTimer: () => ({
    remainingSeconds: 60,
    activeDurationSeconds: 60,
    running: mockTimerRunning,
    start: mockTimerStart,
    pause: mockTimerPause,
    reset: mockTimerReset,
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
      onPauseHandsFree,
      onResumeHandsFree,
    }: {
      onNextStep: () => void;
      onPreviousStep: () => void;
      onPauseHandsFree?: () => void;
      onResumeHandsFree?: () => void;
    }) => {
      mockStepHandlers = { onPauseHandsFree, onResumeHandsFree };
      return React.createElement(
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
      );
    },
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
    mockStartHandsFree.mockReset();
    mockUseKeepAwake.mockReset();
    mockPauseHandsFree.mockReset();
    mockResumeHandsFree.mockReset();
    mockTimerStart.mockReset();
    mockTimerPause.mockReset();
    mockTimerReset.mockReset();
    mockVoiceOptions = {};
    mockStepHandlers = null;
    mockHandsFreeActive = false;
    mockTimerRunning = true;
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

  it('starts hands-free once when the Plus flow is accepted', async () => {
    const steps = [step('step-1', 0)];

    const view = await render(
      <CookingModePlusFlow
        recipe={recipe}
        steps={steps}
        ingredients={[]}
        handsFreeEnabled
        onFinish={jest.fn()}
      />,
    );

    expect(mockStartHandsFree).toHaveBeenCalledTimes(1);

    await view.rerender(
      <CookingModePlusFlow
        recipe={recipe}
        steps={steps}
        ingredients={[]}
        handsFreeEnabled
        onFinish={jest.fn()}
      />,
    );

    expect(mockStartHandsFree).toHaveBeenCalledTimes(1);
  });
  it('mountet den Vordergrund-Wake-Lifecycle nur im aktiven Hands-free-Ablauf', async () => {
    mockHandsFreeActive = true;
    const steps = [step('step-1', 0)];

    await render(
      <CookingModePlusFlow
        recipe={recipe}
        steps={steps}
        ingredients={[]}
        handsFreeEnabled
        onFinish={jest.fn()}
      />,
    );

    expect(mockUseKeepAwake).toHaveBeenCalledWith('cooking-mode-hands-free');
  });

  it('pauses and resumes the timer through spoken hands-free pause coordination', async () => {
    mockHandsFreeActive = true;
    const steps = [step('step-1', 0)];

    await render(
      <CookingModePlusFlow
        recipe={recipe}
        steps={steps}
        ingredients={[]}
        handsFreeEnabled
        onFinish={jest.fn()}
      />,
    );

    const pauseVoice = jest.fn();
    const coordinatePause = mockVoiceOptions.onPauseHandsFree as (pause: () => void) => void;
    coordinatePause(pauseVoice);

    expect(pauseVoice).toHaveBeenCalledTimes(1);
    expect(mockTimerPause).toHaveBeenCalledTimes(1);

    mockStepHandlers?.onResumeHandsFree?.();
    expect(mockResumeHandsFree).toHaveBeenCalledTimes(1);
    expect(mockTimerStart).toHaveBeenCalledTimes(1);
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
