import type { Meta, StoryObj } from '@storybook/react-native';
import { fn } from 'storybook/test';
import { ProfileButton } from './profile-button';

const meta = {
  title: 'Navigation/ProfileButton',
  component: ProfileButton,
  args: { onPress: fn() },
} satisfies Meta<typeof ProfileButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Initials: Story = {
  args: {
    initials: 'MK',
  },
};

export const WithAvatarImage: Story = {
  args: {
    initials: 'MK',
    avatarUrl: 'https://picsum.photos/seed/fam-avatar/128',
  },
};
