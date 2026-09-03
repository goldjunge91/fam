import type { Meta, StoryObj } from '@storybook/react-native';
import { useState } from 'react';
import { SegmentedControl } from './segmented-control';

const STORAGE_OPTIONS = [
  { value: 'fridge', label: 'Kühlschrank' },
  { value: 'pantry', label: 'Vorrat' },
  { value: 'freezer', label: 'Tiefkühler' },
] as const;

const meta = {
  title: 'UI/SegmentedControl',
  component: SegmentedControl,
  // selected/onSelect nur zur Typerfuellung -- render() ersetzt sie durch echten State.
  args: { selected: '', onSelect: () => {} },
  argTypes: {
    appearance: {
      options: ['accent', 'surface'],
      control: { type: 'select' },
    },
    size: {
      options: ['default', 'compact'],
      control: { type: 'select' },
    },
  },
} satisfies Meta<typeof SegmentedControl>;

export default meta;

type Story = StoryObj<typeof meta>;

// value/onChange als statische args + fn() wuerden die Auswahl beim Tippen nicht
// sichtbar aendern — controlled component braucht echten State in der Story.
export const Accent: Story = {
  args: { label: 'Lagerort', options: [...STORAGE_OPTIONS], appearance: 'accent' },
  render: function AccentRender(args) {
    const [selected, setSelected] = useState<string>('fridge');
    return <SegmentedControl {...args} selected={selected} onSelect={setSelected} />;
  },
};

export const Surface: Story = {
  args: { label: 'Lagerort', options: [...STORAGE_OPTIONS], appearance: 'surface' },
  render: function SurfaceRender(args) {
    const [selected, setSelected] = useState<string>('pantry');
    return <SegmentedControl {...args} selected={selected} onSelect={setSelected} />;
  },
};
