import type { Meta, StoryObj } from '@storybook/react-native';
import { fn } from 'storybook/test';
import { Button } from './button';

const meta = {
  title: 'UI/Buttons/Button',
  component: Button,
  args: { onPress: fn() },
  argTypes: {
    variant: {
      options: ['primary', 'secondary', 'danger', 'link'],
      control: { type: 'select' },
    },
    size: {
      options: ['default', 'large', 'compact'],
      control: { type: 'select' },
    },
  },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: { label: 'Speichern', variant: 'primary' },
};

export const Secondary: Story = {
  args: { label: 'Abbrechen', variant: 'secondary' },
};

export const Danger: Story = {
  args: { label: 'Löschen', variant: 'danger' },
};

export const Link: Story = {
  args: { label: 'Mehr erfahren', variant: 'link' },
};

export const Loading: Story = {
  args: { label: 'Speichern', variant: 'primary', loading: true },
};

export const Disabled: Story = {
  args: { label: 'Speichern', variant: 'primary', disabled: true },
};
