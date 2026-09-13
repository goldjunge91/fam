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
