import { act, renderHook, waitFor } from '@testing-library/react-native';
import type React from 'react';

import {
  NavigationChromeProvider,
  useNavigationChrome,
} from '@/features/navigation/navigation-chrome-provider';

describe('NavigationChromeProvider', () => {
  function wrapper({ children }: { children: React.ReactNode }) {
    return <NavigationChromeProvider>{children}</NavigationChromeProvider>;
  }

  it('verwaltet den Zustand für Drawer, Profil und Quick-Add', async () => {
    const { result } = await renderHook(() => useNavigationChrome(), { wrapper });

    expect(result.current.isDrawerOpen).toBe(false);
    expect(result.current.isProfileOpen).toBe(false);
    expect(result.current.isQuickAddOpen).toBe(false);

    await act(() => {
      result.current.openDrawer();
    });

    await waitFor(() => {
      expect(result.current.isDrawerOpen).toBe(true);
    });

    await act(() => {
      result.current.closeDrawer();
    });

    await waitFor(() => {
      expect(result.current.isDrawerOpen).toBe(false);
    });
  });
});
