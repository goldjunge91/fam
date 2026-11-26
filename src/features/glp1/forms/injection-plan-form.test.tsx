import { render, screen, userEvent, within } from '@testing-library/react-native';
import { InjectionPlanForm } from './injection-plan-form';

describe('InjectionPlanForm', () => {
  it('weist einen zu langen Medikamentennamen im Plan zurück', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    await render(<InjectionPlanForm mode="create" isPending={false} onSubmit={onSubmit} />);

    await user.paste(screen.getByLabelText('Medikament im Injektionsplan'), 'x'.repeat(201));
    await user.press(screen.getByRole('button', { name: 'Plan speichern' }));

    expect(
      await screen.findByText('Medikament darf höchstens 200 Zeichen lang sein'),
    ).toBeOnTheScreen();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('übernimmt die ausgewählte Einheit beim Speichern des Plans', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    await render(<InjectionPlanForm mode="create" isPending={false} onSubmit={onSubmit} />);

    const unitGroup = screen.getByLabelText('Einheit');
    await user.press(within(unitGroup).getByRole('radio', { name: 'ml' }));
    await user.press(screen.getByRole('button', { name: 'Plan speichern' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ unit: 'ml', cadenceDays: 7, reminderEnabled: true }),
    );
  });
});
