import { render, screen, userEvent } from '@testing-library/react-native';
import { ProfileButton } from './profile-button.android';

jest.mock('@/features/profile/avatar-image', () => ({ AvatarImage: () => null }));

describe('Android ProfileButton', () => {
  it('shows initials or an avatar and forwards presses', async () => {
    const user = userEvent.setup();
    const onPress = jest.fn();
    const { rerender } = await render(<ProfileButton initials="MM" onPress={onPress} />);

    expect(screen.getByText('MM')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Profil öffnen' }));
    expect(onPress).toHaveBeenCalledTimes(1);

    await rerender(
      <ProfileButton initials="MM" avatarUrl="https://example.test/avatar.jpg" onPress={onPress} />,
    );
    expect(screen.queryByText('MM')).not.toBeOnTheScreen();
  });
});
