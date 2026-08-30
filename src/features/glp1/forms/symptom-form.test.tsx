import { render, screen, userEvent } from '@testing-library/react-native';
import { SymptomForm } from './symptom-form';

describe('SymptomForm', () => {
  it('weist Nebenwirkungen mit mehr als 200 Zeichen zurück', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    await render(<SymptomForm isPending={false} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Konkrete Nebenwirkungen'), 'x'.repeat(201));
    await user.press(screen.getByRole('button', { name: 'Status speichern' }));

    expect(
      await screen.findByText('Eine Nebenwirkung darf höchstens 200 Zeichen lang sein'),
    ).toBeOnTheScreen();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
