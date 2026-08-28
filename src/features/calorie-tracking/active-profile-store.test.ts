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
// Optionales Gate, um eine `maybeSingle`-Antwort kuenstlich zu verzoegern
// (fuer den Race-Condition-Test) und ein Spy, um Aufrufe zu zaehlen
// (fuer den In-Flight-Dedupe-Test).
let mockChildProfileExistsGate: Promise<void> | null;
let mockChildProfileExistsSpy: jest.Mock | null;

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
          mockChildProfileExistsSpy?.();
          if (mockChildProfileExistsGate) await mockChildProfileExistsGate;
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
    mockChildProfileExistsGate = null;
    mockChildProfileExistsSpy = null;
  });

  it('startet als eingeloggter Erwachsener, ohne gespeicherte Auswahl', async () => {
    const { result } = await renderHook(() => useActiveProfile('hh-1'));

    await waitFor(() => {
      expect(result.current.profile).toEqual({ type: 'adult', userId: 'adult-1' });
    });
  });

  it('laedt eine zuvor gespeicherte Kind-Auswahl fuer den Haushalt, wenn das Profil noch existiert', async () => {
    mockExistingChildProfiles.add('hh-2:child-1');
    await setStoredActiveChildProfileId('adult-1', 'hh-2', 'child-1');

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
    await setStoredActiveChildProfileId('adult-1', 'hh-4', 'child-geloescht');

    const { result } = await renderHook(() => useActiveProfile('hh-4'));

    await waitFor(() => {
      expect(result.current.profile).toEqual({ type: 'adult', userId: 'adult-1' });
    });
    expect(await getStoredActiveChildProfileId('adult-1', 'hh-4')).toBeNull();
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
    expect(await getStoredActiveChildProfileId('adult-1', 'hh-3')).toBe('child-2');

    act(() => {
      result.current.setProfile({ type: 'adult', userId: 'adult-1' });
    });

    await waitFor(() => {
      expect(result.current.profile).toEqual({ type: 'adult', userId: 'adult-1' });
    });
    expect(await getStoredActiveChildProfileId('adult-1', 'hh-3')).toBeNull();
  });

  it('persistiert die Kind-Auswahl nutzerskaliert, sodass ein anderer Nutzer im selben Haushalt sie nicht sieht', async () => {
    await setStoredActiveChildProfileId('adult-1', 'hh-7', 'child-4');

    expect(await getStoredActiveChildProfileId('adult-1', 'hh-7')).toBe('child-4');
    expect(await getStoredActiveChildProfileId('adult-2', 'hh-7')).toBeNull();
  });

  it('liefert bei fehlendem Haushalt eine stabile Profil-Referenz ueber mehrere Renders (kein Endlosschleifen-Risiko)', async () => {
    const { result, rerender } = await renderHook(
      ({ householdId }: { householdId: string | undefined }) => useActiveProfile(householdId),
      { initialProps: { householdId: undefined } },
    );

    await waitFor(() => {
      expect(result.current.profile).toEqual({ type: 'adult', userId: 'adult-1' });
    });
    const firstProfile = result.current.profile;

    await rerender({ householdId: undefined });

    // Zustand-Selectoren duerfen bei unveraendertem Input kein neues Objekt
    // zurueckgeben — sonst meldet React/Zustand "getSnapshot should be cached".
    expect(result.current.profile).toBe(firstProfile);
  });

  it('teilt einen Ladevorgang zwischen parallelen Hook-Mounts fuer denselben Nutzer/Haushalt', async () => {
    mockExistingChildProfiles.add('hh-6:child-3');
    await setStoredActiveChildProfileId('adult-1', 'hh-6', 'child-3');
    mockChildProfileExistsSpy = jest.fn();
    // Gate erzwingt echte Ueberlappung: ohne es koennte der erste Mount schon
    // fertig geladen haben, bevor der zweite ueberhaupt startet.
    let releaseLoad: () => void = () => {};
    mockChildProfileExistsGate = new Promise((resolve) => {
      releaseLoad = resolve;
    });

    const first = await renderHook(() => useActiveProfile('hh-6'));
    const second = await renderHook(() => useActiveProfile('hh-6'));
    releaseLoad();

    await waitFor(() => {
      expect(first.result.current.profile).toEqual({
        type: 'child',
        childProfileId: 'child-3',
        householdId: 'hh-6',
      });
    });
    await waitFor(() => {
      expect(second.result.current.profile).toEqual({
        type: 'child',
        childProfileId: 'child-3',
        householdId: 'hh-6',
      });
    });

    expect(mockChildProfileExistsSpy).toHaveBeenCalledTimes(1);
  });

  it('synchronisiert setProfile sofort in alle gemounteten Hook-Instanzen fuer denselben Nutzer/Haushalt (Diary- und Add-Food-Screen)', async () => {
    mockExistingChildProfiles.add('hh-8:child-5');

    const diary = await renderHook(() => useActiveProfile('hh-8'));
    const addFood = await renderHook(() => useActiveProfile('hh-8'));

    await waitFor(() => {
      expect(diary.result.current.profile).toEqual({ type: 'adult', userId: 'adult-1' });
    });
    await waitFor(() => {
      expect(addFood.result.current.profile).toEqual({ type: 'adult', userId: 'adult-1' });
    });

    act(() => {
      diary.result.current.setProfile({
        type: 'child',
        childProfileId: 'child-5',
        householdId: 'hh-8',
      });
    });

    // Ohne dass der Add-Food-Screen selbst neu mountet, muss er die im
    // Diary-Screen getroffene Auswahl sofort sehen — genau der Bug, den der
    // gemeinsame Store loesen sollte.
    await waitFor(() => {
      expect(addFood.result.current.profile).toEqual({
        type: 'child',
        childProfileId: 'child-5',
        householdId: 'hh-8',
      });
    });
  });

  it('zeigt waehrend einer laufenden Initialisierung konsistent kein Profil, bis der geteilte Ladevorgang abgeschlossen ist', async () => {
    mockExistingChildProfiles.add('hh-9:child-6');
    await setStoredActiveChildProfileId('adult-1', 'hh-9', 'child-6');

    let releaseLoad: () => void = () => {};
    mockChildProfileExistsGate = new Promise((resolve) => {
      releaseLoad = resolve;
    });

    const diary = await renderHook(() => useActiveProfile('hh-9'));
    const addFood = await renderHook(() => useActiveProfile('hh-9'));

    // Solange der geteilte Ladevorgang noch haengt, darf keine Instanz schon
    // ein (potenziell falsches) Profil anzeigen.
    expect(diary.result.current.profile).toBeNull();
    expect(addFood.result.current.profile).toBeNull();

    releaseLoad();

    await waitFor(() => {
      expect(diary.result.current.profile).toEqual({
        type: 'child',
        childProfileId: 'child-6',
        householdId: 'hh-9',
      });
    });
    await waitFor(() => {
      expect(addFood.result.current.profile).toEqual({
        type: 'child',
        childProfileId: 'child-6',
        householdId: 'hh-9',
      });
    });
  });

  it('eine waehrend des Ladens manuell getroffene Auswahl gewinnt gegen das verzoegerte, veraltete Ladeergebnis', async () => {
    mockExistingChildProfiles.add('hh-5:child-alt');
    await setStoredActiveChildProfileId('adult-1', 'hh-5', 'child-alt');

    let releaseLoad: () => void = () => {};
    mockChildProfileExistsGate = new Promise((resolve) => {
      releaseLoad = resolve;
    });

    const { result } = await renderHook(() => useActiveProfile('hh-5'));

    // Der Ladevorgang haengt noch am Gate — der Nutzer waehlt in der
    // Zwischenzeit manuell den Erwachsenen.
    act(() => {
      result.current.setProfile({ type: 'adult', userId: 'adult-1' });
    });
    expect(result.current.profile).toEqual({ type: 'adult', userId: 'adult-1' });

    releaseLoad();
    // Dem haengenden Ladevorgang Gelegenheit geben, sein (veraltetes) Ergebnis
    // zu committen, falls der Versions-Guard fehlt.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.profile).toEqual({ type: 'adult', userId: 'adult-1' });
  });
});
