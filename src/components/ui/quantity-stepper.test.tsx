import { fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('@/components/theme/ThemeProvider', () => ({
  useTheme: () => ({ colors: require('@/components/theme/index').colorsLight }),
  useThemedStyles: (factory: (c: object) => unknown) =>
    factory(require('@/components/theme/index').colorsLight),
}));

import { QuantityStepper } from './quantity-stepper';

describe('QuantityStepper', () => {
  it('hält im festen Modus für alle drei Segmente mindestens 44 Punkte Breite', async () => {
    await render(<QuantityStepper value={2} onChange={jest.fn()} label="Einkaufsmenge" />);

    expect(screen.getByRole('button', { name: 'Einkaufsmenge verringern' })).toHaveStyle({
      width: 44,
    });
    expect(screen.getByRole('button', { name: 'Einkaufsmenge direkt eingeben' })).toHaveStyle({
      width: 44,
    });
    expect(screen.getByRole('button', { name: 'Einkaufsmenge erhöhen' })).toHaveStyle({
      width: 44,
    });
  });

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

  it('ruft den Callback beim Pressen der aktiven Segmente mit der begrenzten Menge auf', async () => {
    const onChange = jest.fn();
    await render(
      <QuantityStepper value={2} min={1} max={3} onChange={onChange} label="Einkaufsmenge" />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Einkaufsmenge erhöhen' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Einkaufsmenge verringern' }));

    expect(onChange).toHaveBeenNthCalledWith(1, 3);
    expect(onChange).toHaveBeenNthCalledWith(2, 1);
  });

  it('aktiviert ein deaktiviertes Grenzsegment nicht', async () => {
    const onChange = jest.fn();
    await render(
      <QuantityStepper value={1} min={1} max={3} onChange={onChange} label="Einkaufsmenge" />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Einkaufsmenge verringern' }));

    expect(onChange).not.toHaveBeenCalled();
  });
});
