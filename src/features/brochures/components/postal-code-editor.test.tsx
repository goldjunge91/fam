import { render, screen, userEvent, waitFor } from '@testing-library/react-native';

import { PostalCodeEditor } from './postal-code-editor';

describe('PostalCodeEditor', () => {
  it('sanitizes the postal code, submits it, and allows cancelling', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const onCancel = jest.fn();

    await render(<PostalCodeEditor onSubmit={onSubmit} onCancel={onCancel} />);

    const input = screen.getByLabelText('PLZ');
    await user.type(input, '12a3456');

    expect(input.props.value).toBe('12345');
    await user.press(screen.getByRole('button', { name: 'Postleitzahl übernehmen' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('12345'));

    await user.press(screen.getByRole('button', { name: 'Postleitzahl-Eingabe abbrechen' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows a save error and clears it on retry', async () => {
    const user = userEvent.setup();
    const onSubmit = jest
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined);

    await render(<PostalCodeEditor onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText('PLZ'), '10115');
    const submit = screen.getByRole('button', { name: 'Postleitzahl übernehmen' });

    await user.press(submit);
    expect(await screen.findByText('PLZ konnte nicht gespeichert werden.')).toBeOnTheScreen();

    await user.press(submit);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('PLZ konnte nicht gespeichert werden.')).not.toBeOnTheScreen();
  });
});
