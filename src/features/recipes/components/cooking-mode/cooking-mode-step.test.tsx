import { render, screen, userEvent } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import type { RecipeStep } from '../../hooks/use-recipe-steps';
import { CookingModeStep } from './cooking-mode-step';

jest.mock('@/components/theme/ThemeProvider', () => ({
  useTheme: () => ({ colors: { accent: '#957b91', backgroundSoft: '#eee' } }),
}));

jest.mock('@/constants/ui', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable: NativePressable, Text: NativeText } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Press: ({
      children,
      onPress,
      disabled,
      accessibilityRole,
      accessibilityLabel,
    }: {
      children: ReactNode;
      onPress: () => void;
      disabled?: boolean;
      accessibilityRole?: 'button';
      accessibilityLabel?: string;
    }) =>
      React.createElement(
        NativePressable,
        { accessibilityRole, accessibilityLabel, disabled, onPress },
        children,
      ),
    Txt: ({ children }: { children: ReactNode }) => React.createElement(NativeText, null, children),
  };
});

jest.mock('../step-rich-content', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text: NativeText } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    StepRichContent: ({ text, images }: { text: string; images: { key: string }[] }) =>
      React.createElement(NativeText, null, `${text} (${images.length} Inlinebilder)`),
  };
});

jest.mock('./cooking-mode-artwork', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text: NativeText } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    CookingModeArtwork: ({ imageUrl }: { imageUrl?: string | null }) =>
      React.createElement(
        NativeText,
        null,
        imageUrl ? 'Schritt-Artwork mit Bild' : 'Schritt-Artwork',
      ),
  };
});

jest.mock('./cooking-mode-timer', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text: NativeText } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    CookingModeTimer: ({
      durationSeconds,
      remainingSeconds,
      running,
    }: {
      durationSeconds: number | null;
      remainingSeconds: number;
      running: boolean;
    }) =>
      React.createElement(
        NativeText,
        null,
        `${durationSeconds ?? 'kein'}:${remainingSeconds}:${running ? 'läuft' : 'pausiert'}`,
      ),
  };
});

function makeStep(overrides: Partial<RecipeStep> = {}): RecipeStep {
  return {
    id: 'step-1',
    recipe_id: 'recipe-1',
    position: 0,
    text: 'Zutaten vermischen.',
    image_path: null,
    timer_minutes: null,
    ingredientIds: [],
    ...overrides,
  };
}

it('zeigt mehrere platzierte Schrittbilder und sperrt Zurück am ersten Schritt', async () => {
  const user = userEvent.setup();
  const onPreviousStep = jest.fn();
  const onNextStep = jest.fn();
  const steps = [makeStep(), makeStep({ id: 'step-2', position: 1 })];
  const currentStep = makeStep({
    text: 'Zuerst [[Bild 1]], dann [[Bild 2]].',
    images: [
      {
        id: 'image-1',
        step_id: 'step-1',
        recipe_id: 'recipe-1',
        household_id: 'household-1',
        storage_path: 'step-1.jpg',
        position: 0,
      },
      {
        id: 'image-2',
        step_id: 'step-1',
        recipe_id: 'recipe-1',
        household_id: 'household-1',
        storage_path: 'step-2.jpg',
        position: 1,
      },
    ],
  });

  await render(
    <CookingModeStep
      steps={steps}
      stepIndex={0}
      currentStep={currentStep}
      mentionIngredients={[]}
      durationSeconds={null}
      remainingSeconds={0}
      timerRunning={false}
      onStartTimer={jest.fn()}
      onPauseTimer={jest.fn()}
      onResetTimer={jest.fn()}
      onPreviousStep={onPreviousStep}
      onNextStep={onNextStep}
    />,
  );

  expect(screen.getByText('SCHRITT 1 VON 2')).toBeOnTheScreen();
  expect(screen.getByText(/Zuerst , dann/)).toBeOnTheScreen();
  expect(
    screen.getByText('Zuerst [[Bild 1]], dann [[Bild 2]]. (2 Inlinebilder)'),
  ).toBeOnTheScreen();
  expect(screen.queryByText('Schritt-Artwork')).not.toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Vorheriger Schritt' })).toBeDisabled();

  await user.press(screen.getByRole('button', { name: 'Nächster Schritt' }));
  expect(onNextStep).toHaveBeenCalledTimes(1);
  expect(onPreviousStep).not.toHaveBeenCalled();
});

it('nutzt das ältere Bildfeld und bietet am letzten Schritt Abschluss an', async () => {
  const user = userEvent.setup();
  const onPreviousStep = jest.fn();
  const onNextStep = jest.fn();
  const currentStep = makeStep({
    id: 'step-2',
    position: 1,
    text: 'Eine besonders lange Zubereitungsanweisung, die als Titel zu lang wäre.',
    image_path: 'legacy-step.jpg',
    timer_minutes: 3,
  });

  await render(
    <CookingModeStep
      steps={[makeStep(), currentStep]}
      stepIndex={1}
      currentStep={currentStep}
      currentStepImageUrl="https://images.example/legacy.jpg"
      mentionIngredients={[]}
      durationSeconds={180}
      remainingSeconds={90}
      timerRunning
      onStartTimer={jest.fn()}
      onPauseTimer={jest.fn()}
      onResetTimer={jest.fn()}
      onPreviousStep={onPreviousStep}
      onNextStep={onNextStep}
    />,
  );

  expect(screen.getByText('Schritt 2')).toBeOnTheScreen();
  expect(screen.getByText('Schritt-Artwork mit Bild')).toBeOnTheScreen();
  expect(screen.getByText(/Eine besonders lange.*0 Inlinebilder/)).toBeOnTheScreen();
  expect(screen.getByText('180:90:läuft')).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Vorheriger Schritt' }));
  await user.press(screen.getByRole('button', { name: 'Zubereitung abschließen' }));
  expect(onPreviousStep).toHaveBeenCalledTimes(1);
  expect(onNextStep).toHaveBeenCalledTimes(1);
});

it('zeigt bei fehlenden Bildern den Anweisungstext als Schrittüberschrift', async () => {
  const currentStep = makeStep({ text: 'Zwiebeln fein hacken.' });
  await render(
    <CookingModeStep
      steps={[currentStep]}
      stepIndex={0}
      currentStep={currentStep}
      mentionIngredients={[]}
      durationSeconds={30}
      remainingSeconds={30}
      timerRunning={false}
      onStartTimer={jest.fn()}
      onPauseTimer={jest.fn()}
      onResetTimer={jest.fn()}
      onPreviousStep={jest.fn()}
      onNextStep={jest.fn()}
    />,
  );

  expect(screen.getByText('Zwiebeln fein hacken')).toBeOnTheScreen();
  expect(screen.getByText('Schritt-Artwork')).toBeOnTheScreen();
  expect(screen.getByText('30:30:pausiert')).toBeOnTheScreen();
});
