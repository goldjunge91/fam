import { render, screen, userEvent } from '@testing-library/react-native';

import { PasswordChangeSheet } from '@/features/profile/sheets/password-change-sheet';
import { i18n } from '@/i18n';

function renderSheet() {
  return render(
    <PasswordChangeSheet
      visible
      password=""
      passwordConfirmation=""
      onPasswordChange={jest.fn()}
      onPasswordConfirmationChange={jest.fn()}
      onApply={jest.fn()}
      onClose={jest.fn()}
    />,
  );
}

describe('PasswordChangeSheet', () => {
  test('beschriftet den Sichtbarkeits-Schalter barrierefrei auf Deutsch', async () => {
    const user = userEvent.setup();
    await renderSheet();

    await user.press(screen.getByRole('togglebutton', { name: 'Neues Passwort anzeigen' }));

    expect(
      screen.getByRole('togglebutton', { name: 'Neues Passwort verbergen' }),
    ).toBeOnTheScreen();
  });

  test('beschriftet den Sichtbarkeits-Schalter barrierefrei auf Englisch', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    await renderSheet();

    await user.press(screen.getByRole('togglebutton', { name: 'New password show' }));

    expect(screen.getByRole('togglebutton', { name: 'New password hide' })).toBeOnTheScreen();
  });
});
