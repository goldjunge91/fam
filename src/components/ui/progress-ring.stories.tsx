import type { Meta, StoryObj } from '@storybook/react-native';
import { ProgressRing } from './progress-ring';

const meta = {
  title: 'UI/ProgressRing',
  component: ProgressRing,
  args: { animated: false },
  argTypes: {
    preset: {
      options: ['compact', 'dashboard', 'medium', 'large'],
      control: { type: 'select' },
    },
    displayMode: {
      options: ['value', 'percent', 'remaining', 'count', 'none'],
      control: { type: 'select' },
    },
  },
} satisfies Meta<typeof ProgressRing>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Value: Story = {
  args: { value: 1450, target: 2000, unit: 'kcal', displayMode: 'value', preset: 'large' },
};

export const Percent: Story = {
  args: { value: 7, target: 10, displayMode: 'percent', preset: 'medium' },
};

export const Remaining: Story = {
  args: { value: 1450, target: 2000, unit: 'kcal', displayMode: 'remaining', preset: 'large' },
};

export const Exceeded: Story = {
  args: { value: 2300, target: 2000, unit: 'kcal', displayMode: 'remaining', preset: 'large' },
};

export const Compact: Story = {
  args: { value: 3, target: 5, unit: 'Artikel', displayMode: 'count', preset: 'compact' },
};

export const Empty: Story = {
  args: { value: 0, target: 0, displayMode: 'none', preset: 'dashboard' },
};
