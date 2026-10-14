import { render, screen } from '@testing-library/react-native';

import type { MentionableIngredient } from '../domain/ingredient-mentions';
import { StepMentionText } from './step-mention-text';

const ingredients: MentionableIngredient[] = [
  { itemId: 'tomato', name: 'Tomate', unit: 'g', quantity: 300 },
];

describe('StepMentionText', () => {
  test('renders plain text, resolved ingredients, and unknown mentions', async () => {
    await render(
      <StepMentionText
        text="Schneide @Tomate100 und würze mit @Pfeffer."
        ingredients={ingredients}
      />,
    );

    expect(screen.getByText('Schneide ')).toBeOnTheScreen();
    expect(screen.getByText('100g Tomate')).toBeOnTheScreen();
    expect(screen.getByText(' und würze mit ')).toBeOnTheScreen();
    expect(screen.getByText('@Pfeffer')).toBeOnTheScreen();
    expect(screen.getByText('.')).toBeOnTheScreen();
  });
});
