import type { Meta, StoryObj } from '@storybook/react-native';
import { useState } from 'react';
import { InlineSelect } from './inline-select';

const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'expiry', label: 'Ablaufdatum' },
  { value: 'added', label: 'Hinzugefügt', disabled: true, disabledHint: 'bald' },
] as const;

const meta = {
  title: 'UI/InlineSelect',
  component: InlineSelect,
  // value/onChange nur zur Typerfuellung -- render() ersetzt sie durch echten State.
  args: { accessibilityLabel: 'Sortierung', value: '', onChange: () => {} },
} satisfies Meta<typeof InlineSelect>;

export default meta;

type Story = StoryObj<typeof meta>;

// value/onChange als statische args + fn() wuerden die Auswahl beim Tippen nicht
// sichtbar aendern — controlled component braucht echten State in der Story.
export const Default: Story = {
  args: { options: [...SORT_OPTIONS] },
  render: function DefaultRender(args) {
    const [value, setValue] = useState('name');
    return <InlineSelect {...args} value={value} onChange={setValue} />;
  },
};

export const WithDisabledOption: Story = {
  args: { options: [...SORT_OPTIONS] },
  render: function WithDisabledOptionRender(args) {
    const [value, setValue] = useState('expiry');
    return <InlineSelect {...args} value={value} onChange={setValue} />;
  },
};
