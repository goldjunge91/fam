import type { Meta, StoryObj } from '@storybook/react-native';
import { View } from 'react-native';
import { ProgressBar } from './progress-bar';

const meta = {
  title: 'UI/ProgressBar',
  component: ProgressBar,
  decorators: [
    (Story) => (
      <View style={{ width: 240 }}>
        <Story />
      </View>
    ),
  ],
  argTypes: {
    value: { control: { type: 'range', min: 0, max: 1, step: 0.05 } },
  },
} satisfies Meta<typeof ProgressBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Quarter: Story = {
  args: { value: 0.25 },
};

export const HalfDone: Story = {
  args: { value: 0.5 },
};

export const Complete: Story = {
  args: { value: 1 },
};

export const Thick: Story = {
  args: { value: 0.6, height: 10 },
};

export const CustomColor: Story = {
  args: { value: 0.4, color: '#E07856', trackColor: '#F3E4DC' },
};
