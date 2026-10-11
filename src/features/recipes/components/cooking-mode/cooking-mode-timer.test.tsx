import { fireEvent, render, screen } from '@testing-library/react-native';

import type { RecipeStep } from '../../hooks/use-recipe-steps';
import { CookingModeTimer, getCookingTimerDurationSeconds } from './cooking-mode-timer';

const step: RecipeStep = {
  id: 'step-1',
  recipe_id: 'recipe-1',
  position: 0,
  text: 'Wasser 1 Minute kochen',
  image_path: null,
  timer_minutes: null,
  ingredientIds: [],
};

describe('getCookingTimerDurationSeconds', () => {
  it('verwendet die Zeitangabe aus dem Schritttext als Fallback', () => {
    expect(getCookingTimerDurationSeconds(step)).toBe(60);
  });

  it('ignoriert fehlende, unerkannte und nullminütige Zeitangaben', () => {
    expect(getCookingTimerDurationSeconds(undefined)).toBeNull();
    expect(getCookingTimerDurationSeconds({ ...step, text: 'Backofen vorheizen' })).toBeNull();
    expect(getCookingTimerDurationSeconds({ ...step, text: '0 Minuten ziehen lassen' })).toBeNull();
  });

  it('bevorzugt die explizite Dauer vor der Zeitangabe im Schritttext', () => {
    expect(getCookingTimerDurationSeconds({ ...step, timer_minutes: 2 })).toBe(120);
  });
});

describe('CookingModeTimer', () => {
  const callbacks = () => ({
    onStart: jest.fn(),
    onPause: jest.fn(),
    onReset: jest.fn(),
  });

  it('shows a paused timer and starts or resets it', async () => {
    const handlers = callbacks();
    await render(
      <CookingModeTimer durationSeconds={90} remainingSeconds={65} running={false} {...handlers} />,
    );

    expect(screen.getByText('01:05')).toBeOnTheScreen();
    expect(screen.getByText('Pausiert')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Timer fortsetzen' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Timer zurücksetzen' }));
    expect(handlers.onStart).toHaveBeenCalledTimes(1);
    expect(handlers.onPause).not.toHaveBeenCalled();
    expect(handlers.onReset).toHaveBeenCalledTimes(1);
  });

  it('pauses a running timer and disables the action when time expires', async () => {
    const handlers = callbacks();
    const { unmount } = await render(
      <CookingModeTimer durationSeconds={90} remainingSeconds={30} running {...handlers} />,
    );

    expect(screen.getByText('Läuft')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Timer pausieren' }));
    expect(handlers.onPause).toHaveBeenCalledTimes(1);
    await unmount();

    await render(
      <CookingModeTimer durationSeconds={90} remainingSeconds={0} running {...handlers} />,
    );

    expect(screen.getByText('00:00')).toBeOnTheScreen();
    expect(screen.getByText('Abgelaufen')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Timer pausieren' })).toBeDisabled();
  });

  it('does not render when the duration is absent', async () => {
    const handlers = callbacks();
    const { toJSON } = await render(
      <CookingModeTimer
        durationSeconds={null}
        remainingSeconds={0}
        running={false}
        {...handlers}
      />,
    );

    expect(toJSON()).toBeNull();
  });
});
