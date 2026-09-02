import { render, screen } from '@testing-library/react-native';
import { ProfileButton } from '@/components/ui/buttons/profile-button';

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
    expect(screen.getByLabelText('Profilbild')).toHaveProp('source', [
      { uri: 'https://example.com/avatar.jpg' },
    ]);
    expect(screen.getByLabelText('Profilbild')).toHaveStyle({ width: '100%', height: '100%' });
  });
});
