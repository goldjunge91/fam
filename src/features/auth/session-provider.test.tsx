import { renderHook, waitFor } from '@testing-library/react-native';
import type React from 'react';

import { SessionProvider, useSession } from '@/features/auth/session-provider';

const mockGetSession = jest.fn();
const mockOnAuthStateChange = jest.fn();

jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
    },
  }),
  startSupabaseAutoRefresh: jest.fn(() => () => {}),
}));

jest.mock('@/lib/db/client', () => ({
  setActiveUserId: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/features/auth/onboarding-session', () => ({
  hasSeenOnboarding: jest.fn().mockResolvedValue(true),
}));

describe('SessionProvider', () => {
  function wrapper({ children }: { children: React.ReactNode }) {
    return <SessionProvider>{children}</SessionProvider>;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    });
  });

  it('lädt die initiale Session und setzt isLoading auf false', async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: { user: { id: 'user-1', email: 'test@fam.app' } },
      },
      error: null,
    });

    const { result } = await renderHook(() => useSession(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.session?.user.id).toBe('user-1');
    expect(result.current.seenOnboarding).toBe(true);
    expect(result.current.error).toBeNull();
  });
});
