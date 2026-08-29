import { renderHook, waitFor } from '@testing-library/react-native';
import { act } from 'react';

import type { FoodEntryRow } from '@/features/calorie-tracking/api';
import { useFoodEntryForm } from '@/features/calorie-tracking/hooks/use-food-entry-form';

function makeExistingEntry(overrides: Partial<FoodEntryRow> = {}): FoodEntryRow {
  return {
    id: 'entry-1',
    name: 'Bestehender Eintrag',
    quantity: 150,
    unit: 'g',
    kcal: 195,
    protein_g: 4,
    carbs_g: 43,
    fat_g: 0.5,
    ...overrides,
  } as FoodEntryRow;
}

describe('useFoodEntryForm', () => {
  it('wartet im Editier-Modus auf den asynchron geladenen Eintrag, statt leer zu bleiben', async () => {
    const { result, rerender } = await renderHook(
      (props: { existingEntry: FoodEntryRow | undefined }) =>
        useFoodEntryForm({ isEditing: true, existingEntry: props.existingEntry, routeParams: {} }),
      { initialProps: { existingEntry: undefined } },
    );

    // Query laedt noch — Formular bleibt leer, nicht kaputt.
    expect(result.current.values.name).toBe('');

    const entry = makeExistingEntry();
    await rerender({ existingEntry: entry });

    await waitFor(() => {
      expect(result.current.values.name).toBe('Bestehender Eintrag');
    });
    expect(result.current.values.quantity).toBe('150');
    expect(result.current.values.kcal).toBe('195');
  });

  it('bevorzugt einen bestehenden Eintrag gegenueber Produktdaten aus der Route', async () => {
    const entry = makeExistingEntry({ name: 'Eintrag gewinnt' });
    const { result } = await renderHook(() =>
      useFoodEntryForm({
        isEditing: true,
        existingEntry: entry,
        routeParams: { name: 'Route-Produkt', kcalPer100g: '999' },
      }),
    );

    await waitFor(() => {
      expect(result.current.values.name).toBe('Eintrag gewinnt');
    });
    expect(result.current.values.kcal).toBe('195');
  });

  it('startet ein OFF-Produkt mit 100g-Referenz bei Menge 100 und skaliert live', async () => {
    const { result } = await renderHook(() =>
      useFoodEntryForm({
        isEditing: false,
        existingEntry: undefined,
        routeParams: {
          name: 'Hafermilch',
          kcalPer100g: '60',
          proteinPer100g: '3',
          carbsPer100g: '7',
          fatPer100g: '1.5',
        },
      }),
    );

    await waitFor(() => {
      expect(result.current.values.quantity).toBe('100');
    });
    expect(result.current.values.kcal).toBe('60');

    act(() => {
      result.current.setQuantity('250');
    });

    await waitFor(() => {
      expect(result.current.values.kcal).toBe('150');
    });
    expect(result.current.values.proteinG).toBe('7.5');
  });

  it('uebernimmt Produktdaten, wenn Router-Parameter erst nach dem Mount eintreffen', async () => {
    const { result, rerender } = await renderHook(
      (props: { routeParams: Record<string, string> }) =>
        useFoodEntryForm({
          isEditing: false,
          existingEntry: undefined,
          routeParams: props.routeParams,
        }),
      { initialProps: { routeParams: {} } },
    );

    await rerender({
      routeParams: {
        name: 'Hafermilch',
        kcalPer100g: '59',
        proteinPer100g: '1.1',
        carbsPer100g: '6.6',
        fatPer100g: '3',
      },
    });

    await waitFor(() => {
      expect(result.current.values.name).toBe('Hafermilch');
    });
    expect(result.current.values.kcal).toBe('59');
    expect(result.current.values.proteinG).toBe('1.1');
    expect(result.current.values.carbsG).toBe('6.6');
    expect(result.current.values.fatG).toBe('3');
  });

  it('uebernimmt bei einem Verlaufs-Snapshot die fertigen Werte ohne Live-Skalierung', async () => {
    const { result } = await renderHook(() =>
      useFoodEntryForm({
        isEditing: false,
        existingEntry: undefined,
        routeParams: {
          name: 'Apfel',
          quantity: '100',
          unit: 'g',
          kcal: '52',
          proteinG: '0.3',
          carbsG: '14',
          fatG: '0.2',
        },
      }),
    );

    await waitFor(() => {
      expect(result.current.values.name).toBe('Apfel');
    });
    expect(result.current.values.kcal).toBe('52');

    act(() => {
      result.current.setQuantity('300');
    });

    // Ohne 100g-Referenz (Verlaufs-Snapshot) darf eine Mengenaenderung die
    // Naehrwerte nicht automatisch neu berechnen.
    expect(result.current.values.kcal).toBe('52');
  });

  it('zeigt bei einer nicht umrechenbaren Einheit eine Warnung und behaelt die bisherigen Werte', async () => {
    const { result } = await renderHook(() =>
      useFoodEntryForm({
        isEditing: false,
        existingEntry: undefined,
        routeParams: { name: 'Riegel', kcalPer100g: '400' },
      }),
    );

    await waitFor(() => {
      expect(result.current.values.kcal).toBe('400');
    });

    act(() => {
      result.current.setUnit('piece');
    });

    await waitFor(() => {
      expect(result.current.unitNotScalable).toBe(true);
    });
    // "piece" ohne servingWeightG ist nicht umrechenbar — Rohwert bleibt stehen.
    expect(result.current.values.kcal).toBe('400');
  });

  it('behaelt eine manuell geaenderte Naehrwertangabe, bis Menge oder Einheit sich erneut aendern', async () => {
    const { result } = await renderHook(() =>
      useFoodEntryForm({
        isEditing: false,
        existingEntry: undefined,
        routeParams: { name: 'Quark', kcalPer100g: '80' },
      }),
    );

    await waitFor(() => {
      expect(result.current.values.kcal).toBe('80');
    });

    act(() => {
      result.current.setKcal('999');
    });
    expect(result.current.values.kcal).toBe('999'); // manuelle Eingabe bleibt zunaechst stehen

    act(() => {
      result.current.setQuantity('200');
    });

    // Erst eine Mengenaenderung berechnet aus der 100g-Referenz neu — und
    // ueberschreibt damit die manuelle Eingabe.
    await waitFor(() => {
      expect(result.current.values.kcal).toBe('160');
    });
  });

  it('serialisiert leere und ungueltige Zahlenfelder beim Parsen wie zuvor', async () => {
    const { result } = await renderHook(() =>
      useFoodEntryForm({
        isEditing: false,
        existingEntry: undefined,
        routeParams: { name: 'Schneller Eintrag' },
      }),
    );

    await waitFor(() => {
      expect(result.current.values.name).toBe('Schneller Eintrag');
    });

    act(() => {
      result.current.setQuantity('abc');
      result.current.setKcal('  ');
      result.current.setProteinG('3.5');
    });

    const parsed = result.current.getParsedValues();
    expect(parsed.quantity).toBe(1); // parseFloat('abc') ist NaN -> Fallback 1
    expect(parsed.kcal).toBeNull(); // nur Whitespace zaehlt als leer
    expect(parsed.proteinG).toBe(3.5);
    expect(parsed.carbsG).toBeNull();
    expect(parsed.fatG).toBeNull();
  });
});
