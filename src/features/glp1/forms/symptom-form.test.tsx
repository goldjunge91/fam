import { render, screen, userEvent, within } from '@testing-library/react-native';
import { SymptomForm } from './symptom-form';

describe('SymptomForm', () => {
  it('weist Nebenwirkungen mit mehr als 200 Zeichen zurück', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    await render(<SymptomForm isPending={false} onSubmit={onSubmit} />);

    await user.paste(screen.getByLabelText('Konkrete Nebenwirkungen'), 'x'.repeat(201));
    await user.press(screen.getByRole('button', { name: 'Status speichern' }));

    expect(
      await screen.findByText('Eine Nebenwirkung darf höchstens 200 Zeichen lang sein'),
    ).toBeOnTheScreen();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('übernimmt ausgewählte Level und reicht gültige Werte ein', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    const loggedAt = '2026-09-27T10:30:00.000Z';
    await render(
      <SymptomForm
        isPending={false}
        onSubmit={onSubmit}
        initialValue={{
          appetiteLevel: 2,
          satietyLevel: 4,
          nauseaLevel: 0,
          sideEffects: [],
          loggedAt,
          notes: null,
        }}
      />,
    );

    await user.press(
      within(
        screen.getByLabelText('Appetit (1 = kein Appetit, 5 = starker Heißhunger):'),
      ).getByRole('radio', { name: '5' }),
    );
    await user.press(
      within(
        screen.getByLabelText('Sättigungsgefühl (1 = kaum satt, 5 = sehr schnell satt):'),
      ).getByRole('radio', { name: '1' }),
    );
    await user.press(
      within(screen.getByLabelText('Übelkeit / Nebenwirkung (0 = keine, 5 = stark):')).getByRole(
        'radio',
        { name: '3' },
      ),
    );

    expect(screen.getByText('Appetit 5/5 · Sättigung 1/5 · Übelkeit 3/5')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Status speichern' }));

    expect(onSubmit).toHaveBeenCalledWith({
      appetiteLevel: 5,
      satietyLevel: 1,
      nauseaLevel: 3,
      sideEffects: [],
      loggedAt,
      notes: null,
    });
  });
});
