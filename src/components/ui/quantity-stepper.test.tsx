import { render, screen } from '@testing-library/react-native';

jest.mock('@/components/theme/ThemeProvider', () => ({
  useTheme: () => ({ colors: require('@/components/theme/index').colorsLight }),
  useThemedStyles: (factory: (c: object) => unknown) =>
    factory(require('@/components/theme/index').colorsLight),
}));

import { QuantityStepper } from './quantity-stepper';

describe('QuantityStepper', () => {
  it('verteilt im Full-Width-Modus alle drei Segmente über die verfügbare Breite', async () => {
    await render(
      <QuantityStepper value={1} onChange={jest.fn()} label="Einkaufsmenge" fullWidth />,
    );

    expect(screen.getByLabelText('Einkaufsmenge')).toHaveStyle({
      width: '100%',
    });
    expect(screen.getByRole('button', { name: 'Einkaufsmenge verringern' })).toHaveStyle({
      flex: 1,
    });
    expect(screen.getByRole('button', { name: 'Einkaufsmenge direkt eingeben' })).toHaveStyle({
      flex: 1,
    });
    expect(screen.getByRole('button', { name: 'Einkaufsmenge erhöhen' })).toHaveStyle({ flex: 1 });
  });

  it('zeigt die deaktivierte Grenzaktion sichtbar abgeschwächt an', async () => {
    await render(
      <QuantityStepper value={1} min={1} max={3} onChange={jest.fn()} label="Einkaufsmenge" />,
    );

    expect(screen.getByRole('button', { name: 'Einkaufsmenge verringern' })).toHaveStyle({
      opacity: 0.45,
    });
    expect(screen.getByRole('button', { name: 'Einkaufsmenge erhöhen' })).toHaveStyle({
      opacity: 1,
    });
  });
});
