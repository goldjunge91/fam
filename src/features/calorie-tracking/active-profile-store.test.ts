import { renderHook, waitFor } from '@testing-library/react-native';
import { act } from 'react';

import {
  getStoredActiveChildProfileId,
  setStoredActiveChildProfileId,
  useActiveProfile,
} from '@/features/calorie-tracking/active-profile-store';

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'adult-1' } } }),
}));

// Simuliert die `child_profiles`-Tabelle: nur Eintraege, die hier explizit
// eingetragen werden, gelten als (noch) existierend. Deckt genau den Fall
// ab, der den FK-Bug ausgeloest hat — eine in AsyncStorage gespeicherte
// `childProfileId`, deren DB-Zeile nicht mehr existiert.
let mockExistingChildProfiles: Set<string>;

jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    from: (table: string) => {
      if (table !== 'child_profiles') throw new Error(`unerwartete Tabelle: ${table}`);
      let id: string | undefined;
      let householdId: string | undefined;
      const builder = {
        select: () => builder,
        eq: (column: string, value: string) => {
          if (column === 'id') id = value;
          if (column === 'household_id') householdId = value;
          return builder;
        },
        maybeSingle: async () => {
          const exists =
            !!id && !!householdId && mockExistingChildProfiles.has(`${householdId}:${id}`);
          return { data: exists ? { id } : null, error: null };
        },
      };
      return builder;
    },
  }),
}));

describe('useActiveProfile', () => {
  beforeEach(() => {
    mockExistingChildProfiles = new Set();
  });

  it('startet als eingeloggter Erwachsener, ohne gespeicherte Auswahl', async () => {
    const { result } = await renderHook(() => useActiveProfile('hh-1'));

    await waitFor(() => {
      expect(result.current.profile).toEqual({ type: 'adult', userId: 'adult-1' });
    });
  });

  it('laedt eine zuvor gespeicherte Kind-Auswahl fuer den Haushalt, wenn das Profil noch existiert', async () => {
    mockExistingChildProfiles.add('hh-2:child-1');
    await setStoredActiveChildProfileId('hh-2', 'child-1');

    const { result } = await renderHook(() => useActiveProfile('hh-2'));

    await waitFor(() => {
      expect(result.current.profile).toEqual({
        type: 'child',
        childProfileId: 'child-1',
        householdId: 'hh-2',
      });
    });
  });

  it('faellt auf den Erwachsenen zurueck und bereinigt AsyncStorage, wenn das gespeicherte Kindprofil nicht mehr existiert', async () => {
    // Kein Eintrag in mockExistingChildProfiles -> Profil gilt als geloescht/veraltet.
    await setStoredActiveChildProfileId('hh-4', 'child-geloescht');

    const { result } = await renderHook(() => useActiveProfile('hh-4'));

    await waitFor(() => {
      expect(result.current.profile).toEqual({ type: 'adult', userId: 'adult-1' });
    });
    expect(await getStoredActiveChildProfileId('hh-4')).toBeNull();
  });

  it('setProfile persistiert die Auswahl je Haushalt und aktualisiert den State', async () => {
    mockExistingChildProfiles.add('hh-3:child-2');
    const { result } = await renderHook(() => useActiveProfile('hh-3'));

    await waitFor(() => {
      expect(result.current.profile).toEqual({ type: 'adult', userId: 'adult-1' });
    });

    act(() => {
      result.current.setProfile({ type: 'child', childProfileId: 'child-2', householdId: 'hh-3' });
    });

    await waitFor(() => {
      expect(result.current.profile).toEqual({
        type: 'child',
        childProfileId: 'child-2',
        householdId: 'hh-3',
      });
    });
    expect(await getStoredActiveChildProfileId('hh-3')).toBe('child-2');

    act(() => {
      result.current.setProfile({ type: 'adult', userId: 'adult-1' });
    });

    await waitFor(() => {
      expect(result.current.profile).toEqual({ type: 'adult', userId: 'adult-1' });
    });
    expect(await getStoredActiveChildProfileId('hh-3')).toBeNull();
  });
});
