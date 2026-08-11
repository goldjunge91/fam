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

describe('useActiveProfile', () => {
  it('startet als eingeloggter Erwachsener, ohne gespeicherte Auswahl', async () => {
    const { result } = await renderHook(() => useActiveProfile('hh-1'));

    await waitFor(() => {
      expect(result.current.profile).toEqual({ type: 'adult', userId: 'adult-1' });
    });
  });

  it('laedt eine zuvor gespeicherte Kind-Auswahl fuer den Haushalt', async () => {
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

  it('setProfile persistiert die Auswahl je Haushalt und aktualisiert den State', async () => {
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
