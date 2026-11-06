import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import {
  ModalComparisonHostedContent,
  ModalComparisonScrollContent,
} from './showcase-modal-content';

describe('modal comparison content', () => {
  it('accepts a dictated item list, opens its preview, and can be dismissed', async () => {
    const user = userEvent.setup();
    const onDismiss = jest.fn();
    const onOpenPreview = jest.fn();
    await render(
      <ModalComparisonHostedContent
        mode="input"
        onDismiss={onDismiss}
        onOpenPreview={onOpenPreview}
      />,
    );

    const input = screen.getByLabelText('Artikel hinzufügen');
    expect(input).toHaveProp('multiline', true);
    expect(input).toHaveProp('numberOfLines', 3);
    expect(screen.getByRole('button', { name: 'Artikel prüfen' })).toBeDisabled();
    const longInput =
      '3 Äpfel, Skyr von JA, Vollkornbrot und Hafermilch, dazu noch mehrere andere Artikel.\n'.repeat(
        4,
      );
    await fireEvent.changeText(input, longInput);
    expect(screen.getByRole('button', { name: 'Artikel prüfen' })).toBeEnabled();

    await user.press(screen.getByRole('button', { name: 'Artikel prüfen' }));
    await user.press(screen.getByRole('button', { name: 'Später' }));

    expect(onOpenPreview).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('lets a preview choose a suggestion or defer it before adding the list', async () => {
    const user = userEvent.setup();
    const onDismiss = jest.fn();
    await render(<ModalComparisonScrollContent mode="preview" onDismiss={onDismiss} />);

    expect(screen.getByText('Passt das so?')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Aldi' }));
    expect(screen.getByRole('button', { name: '3 Artikel hinzufügen' })).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Später zuordnen' }));
    expect(screen.getByRole('button', { name: '2 Artikel hinzufügen' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Später zuordnen', selected: true })).toBeSelected();

    await user.press(screen.getByRole('button', { name: '2 Artikel hinzufügen' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('allows submitting input when no preview callback is provided', async () => {
    const user = userEvent.setup();
    await render(<ModalComparisonHostedContent mode="input" onDismiss={jest.fn()} />);

    await fireEvent.changeText(screen.getByLabelText('Artikel hinzufügen'), 'Bananen');
    await user.press(screen.getByRole('button', { name: 'Artikel prüfen' }));

    expect(screen.getByText('Artikel sprechen')).toBeOnTheScreen();
  });
});
