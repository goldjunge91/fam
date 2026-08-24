import { render, screen, userEvent } from '@testing-library/react-native';

import { PlacementZoneField } from './placement-zone-field';

describe('PlacementZoneField', () => {
  it('bietet Automatisch und alle kanonischen Zonen an', async () => {
    const user = userEvent.setup();
    await render(
      <PlacementZoneField
        selection={{ mode: 'automatic' }}
        effectiveZoneId="fresh_produce"
        onSelectionChange={jest.fn()}
        onSelectAutomatic={jest.fn()}
      />,
    );

    await user.press(screen.getByRole('button', { name: /Einkaufsbereich:/ }));

    expect(screen.getByRole('button', { name: 'Automatisch' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Obst & Gemüse' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Sonstiges' })).toBeOnTheScreen();
  });

  it('meldet eine manuelle Auswahl als Placement-Auswahl', async () => {
    const user = userEvent.setup();
    const onSelectionChange = jest.fn();
    await render(
      <PlacementZoneField
        selection={{ mode: 'automatic' }}
        effectiveZoneId="fresh_produce"
        onSelectionChange={onSelectionChange}
        onSelectAutomatic={jest.fn()}
      />,
    );

    await user.press(screen.getByRole('button', { name: /Einkaufsbereich:/ }));
    await user.press(screen.getByRole('button', { name: 'Wasser, Saft & Softdrinks' }));

    expect(onSelectionChange).toHaveBeenCalledWith({ mode: 'manual', zoneId: 'cold_drinks' });
  });
});
