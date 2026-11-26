import { render, screen, userEvent, within } from '@testing-library/react-native';
import { InjectionForm } from './injection-form';

describe('InjectionForm', () => {
  it('übernimmt eine ausgewählte Einheit beim Speichern', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    await render(<InjectionForm isPending={false} onSubmit={onSubmit} />);

    const unitGroup = screen.getByLabelText('Einheit');
    await user.press(within(unitGroup).getByRole('radio', { name: 'ml' }));
    await user.press(screen.getByRole('button', { name: 'Injektion speichern' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ unit: 'ml' }));
  });

  it('weist einen zu langen eigenen Medikamentennamen zurück', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    await render(<InjectionForm isPending={false} onSubmit={onSubmit} />);

    const medicationGroup = screen.getByLabelText('Medikament auswählen');
    await user.press(within(medicationGroup).getByRole('radio', { name: 'Andere' }));
    await user.paste(screen.getByLabelText('Name des Medikaments'), 'x'.repeat(201));
    await user.press(screen.getByRole('button', { name: 'Injektion speichern' }));

    expect(
      await screen.findByText('Medikament darf höchstens 200 Zeichen lang sein'),
    ).toBeOnTheScreen();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('speichert einen eigenen Medikamentennamen', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    await render(<InjectionForm isPending={false} onSubmit={onSubmit} />);

    const medicationGroup = screen.getByLabelText('Medikament auswählen');
    await user.press(within(medicationGroup).getByRole('radio', { name: 'Andere' }));
    await user.type(screen.getByLabelText('Name des Medikaments'), 'Ozempic');
    await user.press(screen.getByRole('button', { name: 'Injektion speichern' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ medicationName: 'Ozempic', unit: 'mg' }),
    );
  });
});
