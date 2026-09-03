import type { Meta, StoryObj } from '@storybook/react-native';
import { fn } from 'storybook/test';
import { CompactActionButton } from './compact-action-button';

const meta = {
  title: 'UI/Buttons/CompactActionButton',
  component: CompactActionButton,
  args: { onPress: fn(), label: 'Sortieren' },
} satisfies Meta<typeof CompactActionButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Collapsed: Story = {
  args: { expanded: false },
};

export const Expanded: Story = {
  args: { expanded: true },
};
