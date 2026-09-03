import type { Meta, StoryObj } from '@storybook/react-native';
import { fn } from 'storybook/test';
import { MenuButton } from './menu-button';

const meta = {
  title: 'Navigation/MenuButton',
  component: MenuButton,
  args: { onPress: fn() },
} satisfies Meta<typeof MenuButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
