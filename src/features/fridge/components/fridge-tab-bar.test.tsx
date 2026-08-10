import { fireEvent, render, screen } from '@testing-library/react-native';
import type { StorageLocation } from '@/features/inventory/use-storage-locations';
import type { LocalFridgeItem } from '../use-fridge-items';
import { FridgeTabBar, getIconForLocation } from './fridge-tab-bar';

const mockLocations: StorageLocation[] = [
  { id: 'loc-1', name: 'Kühlschrank', kind: 'fridge', household_id: 'hh-1', sort_order: 0 },
  { id: 'loc-2', name: 'Tiefkühltruhe', kind: 'freezer', household_id: 'hh-1', sort_order: 1 },
  { id: 'loc-3', name: 'Abstellkammer', kind: 'pantry', household_id: 'hh-1', sort_order: 2 },
];

const mockItems: LocalFridgeItem[] = [
  {
    id: 'item-1',
    household_id: 'hh-1',
    name: 'Milch',
    quantity: 1,
    unit: 'L',
    location_id: 'loc-1',
    product_id: null,
    expiry_date: null,
    added_by: null,
    created_at: '',
    location_kind: 'fridge',
    location_name: 'Kühlschrank',
  },
  {
    id: 'item-2',
    household_id: 'hh-1',
    name: 'Eis',
    quantity: 2,
    unit: 'Packung',
    location_id: 'loc-2',
    product_id: null,
    expiry_date: null,
    added_by: null,
    created_at: '',
    location_kind: 'freezer',
    location_name: 'Tiefkühltruhe',
  },
];

describe('FridgeTabBar Component & getIconForLocation', () => {
  describe('getIconForLocation', () => {
    it('sollte passende Icons basierend auf Kind und Name zurückgeben', () => {
      expect(getIconForLocation('fridge', 'Kühlschrank')).toBe('🫙');
      expect(getIconForLocation('freezer', 'Tiefkühltruhe')).toBe('❄️');
      expect(getIconForLocation('pantry', 'Abstellkammer')).toBe('🥫');
      expect(getIconForLocation('custom', 'Gefrierfach')).toBe('❄️');
      expect(getIconForLocation('custom', 'Vorratsschrank')).toBe('🥫');
      expect(getIconForLocation('custom', 'Keller')).toBe('📦');
      expect(getIconForLocation(null, null)).toBe('📦');
    });
  });

  describe('FridgeTabBar Component', () => {
    it('sollte den "Alle"-Tab und alle Lagerorte rendern', async () => {
      await render(
        <FridgeTabBar
          activeTab="all"
          onTabChange={jest.fn()}
          locations={mockLocations}
          items={mockItems}
        />,
      );

      expect(screen.getByText('Alle')).toBeTruthy();
      expect(screen.getByText('Kühlschrank')).toBeTruthy();
      expect(screen.getByText('Tiefkühltruhe')).toBeTruthy();
      expect(screen.getByText('Abstellkammer')).toBeTruthy();
    });

    it('sollte bei Tab-Klick onTabChange mit der ID aufrufen', async () => {
      const handleTabChange = jest.fn();
      await render(
        <FridgeTabBar
          activeTab="all"
          onTabChange={handleTabChange}
          locations={mockLocations}
          items={mockItems}
        />,
      );

      await fireEvent.press(screen.getByText('Kühlschrank'));
      expect(handleTabChange).toHaveBeenCalledTimes(1);
      expect(handleTabChange).toHaveBeenCalledWith('loc-1');
    });

    it('sollte korrekte Badge-Anzahlen für Elemente pro Lagerort anzeigen', async () => {
      await render(
        <FridgeTabBar
          activeTab="all"
          onTabChange={jest.fn()}
          locations={mockLocations}
          items={mockItems}
        />,
      );

      expect(screen.getByText('2')).toBeTruthy();
      expect(screen.getAllByText('1')).toHaveLength(2);
    });
  });
});
