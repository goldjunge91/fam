import { fireEvent, render, screen } from '@testing-library/react-native';
import type { Hotspot } from '../types';
import { BrochureHotspot } from './brochure-hotspot';

const discountHotspot: Hotspot = {
  id: 'discount-1',
  kind: 'discount',
  x: 10,
  y: 20,
  width: 15,
  height: 12,
  title: 'Hafermilch',
  discount: '20 % günstiger',
};

describe('BrochureHotspot', () => {
  it('does not mount an invisible hotspot', async () => {
    await render(
      <BrochureHotspot
        hotspot={discountHotspot}
        onPress={jest.fn()}
        isActive={false}
        isVisible={false}
      />,
    );

    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });

  it('shows the product and discount as the accessible tap target', async () => {
    const onPress = jest.fn();
    await render(
      <BrochureHotspot hotspot={discountHotspot} onPress={onPress} isActive={true} isVisible />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Hafermilch, 20 % günstiger' }));

    expect(onPress).toHaveBeenCalledWith(discountHotspot);
  });

  it('shows a linkout marker and supports titles without a discount', async () => {
    const linkout: Hotspot = {
      ...discountHotspot,
      id: 'link-1',
      kind: 'linkout',
      title: 'Mehr erfahren',
      discount: undefined,
    };
    const onPress = jest.fn();
    await render(
      <BrochureHotspot hotspot={linkout} onPress={onPress} isActive={false} isVisible />,
    );

    expect(screen.getByRole('button', { name: 'Mehr erfahren' })).toBeOnTheScreen();
    expect(screen.getByText('↗')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Mehr erfahren' }));
    expect(onPress).toHaveBeenCalledWith(linkout);
  });
});
