import { render, screen, userEvent } from '@testing-library/react-native';
import type { StorageLocation } from '@/features/inventory/use-storage-locations';
import { InventoryTabBar } from './inventory-tab-bar';

const mockLocations: StorageLocation[] = [
  { id: 'loc-1', name: 'Kühlschrank', kind: 'fridge', household_id: 'hh-1', sort_order: 0 },
  { id: 'loc-2', name: 'Tiefkühltruhe', kind: 'freezer', household_id: 'hh-1', sort_order: 1 },
  { id: 'loc-3', name: 'Abstellkammer', kind: 'pantry', household_id: 'hh-1', sort_order: 2 },
];

describe('InventoryTabBar Component', () => {
  it('zeigt zunächst nur den aktiven Lagerort im kompakten Dropdown-Button', async () => {
    await render(
      <InventoryTabBar activeTab="loc-1" onTabChange={jest.fn()} locations={mockLocations} />,
    );

    expect(screen.queryByText('Alle')).not.toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Lagerort auswählen, aktuell Kühlschrank' }),
    ).toBeOnTheScreen();
    expect(screen.queryByText('Tiefkühltruhe')).not.toBeOnTheScreen();
  });

  it('öffnet die Lagerorte direkt darunter und übernimmt die Auswahl', async () => {
    const handleTabChange = jest.fn();
    const user = userEvent.setup();
    await render(
      <InventoryTabBar activeTab="loc-1" onTabChange={handleTabChange} locations={mockLocations} />,
    );

    await user.press(
      screen.getByRole('button', { name: 'Lagerort auswählen, aktuell Kühlschrank' }),
    );
    expect(screen.getByRole('menuitem', { name: 'Tiefkühltruhe' })).toBeOnTheScreen();

    await user.press(screen.getByRole('menuitem', { name: 'Tiefkühltruhe' }));
    expect(handleTabChange).toHaveBeenCalledTimes(1);
    expect(handleTabChange).toHaveBeenCalledWith('loc-2');
    expect(screen.queryByRole('menuitem', { name: 'Tiefkühltruhe' })).not.toBeOnTheScreen();
  });

  it('zeigt keine Icons oder Zähler-Kacheln in den Tabs', async () => {
    await render(
      <InventoryTabBar activeTab="loc-1" onTabChange={jest.fn()} locations={mockLocations} />,
    );

    expect(screen.queryByText('🫙')).not.toBeOnTheScreen();
    expect(screen.queryByText('❄️')).not.toBeOnTheScreen();
    expect(screen.queryByText('🥫')).not.toBeOnTheScreen();
  });
});
