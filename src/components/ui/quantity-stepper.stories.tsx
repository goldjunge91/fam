import type { Meta, StoryObj } from '@storybook/react-native';
import { useState } from 'react';
import { QuantityStepper } from './quantity-stepper';

const meta = {
  title: 'UI/QuantityStepper',
  component: QuantityStepper,
  // value/onChange nur zur Typerfuellung -- render() ersetzt sie durch echten State.
  args: { value: 1, onChange: () => {} },
  argTypes: {
    size: {
      options: ['default', 'large'],
      control: { type: 'select' },
    },
  },
} satisfies Meta<typeof QuantityStepper>;

export default meta;

type Story = StoryObj<typeof meta>;

// value/onChange als statische args + fn() liessen +/- sichtbar wirkungslos
// wirken — controlled component braucht echten State in der Story.
export const Default: Story = {
  args: { min: 1, max: 20 },
  render: function DefaultRender(args) {
    const [value, setValue] = useState(3);
    return <QuantityStepper {...args} value={value} onChange={setValue} />;
  },
};

export const Large: Story = {
  args: { min: 1, max: 20, size: 'large' },
  render: function LargeRender(args) {
    const [value, setValue] = useState(3);
    return <QuantityStepper {...args} value={value} onChange={setValue} />;
  },
};

export const AtMinimum: Story = {
  args: { min: 1, max: 20 },
  render: function AtMinimumRender(args) {
    const [value, setValue] = useState(1);
    return <QuantityStepper {...args} value={value} onChange={setValue} />;
  },
};
