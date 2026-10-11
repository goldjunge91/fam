import { render, screen, userEvent } from '@testing-library/react-native';
import type { PatternCategory } from './showcase-patterns';
import { PatternsShowcase } from './showcase-patterns';

it.each([
  ['screens', 'Screens und Navigation'],
  ['hybrid', 'Unistyles und StyleSheet'],
  ['accessibility', 'Accessibility und Zustände'],
] as const satisfies readonly [PatternCategory, string][])(
  'renders the %s reference page',
  async (category, title) => {
    const user = userEvent.setup();
    await render(<PatternsShowcase category={category} />);

    expect(screen.getByText(title)).toBeOnTheScreen();

    if (category === 'screens' || category === 'accessibility') {
      for (const button of screen.getAllByRole('button')) {
        await user.press(button);
      }
    }
  },
);
