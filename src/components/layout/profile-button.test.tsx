import { render, screen } from '@testing-library/react-native';

import { colorsLight } from '@/components/theme';
import { ProfileButton } from './profile-button';

describe('ProfileButton', () => {
  it('zeigt die Avatar-URL anstelle der Initialen', async () => {
    await render(
      <ProfileButton
        initials="MM"
        avatarUrl="https://example.com/avatar.jpg"
        onPress={jest.fn()}
      />,
    );

    expect(screen.queryByText('MM')).not.toBeOnTheScreen();
    expect(screen.getByLabelText('Profilbild')).toHaveProp('accessible', false);

    const button = screen.getByRole('button', { name: 'Profil öffnen' });
    expect(button.props.className).toBeUndefined();
    expect(typeof button.props.style).not.toBe('function');
    expect(button).toHaveStyle({
      width: 58,
      height: 58,
      backgroundColor: colorsLight.accent,
    });
  });
});
