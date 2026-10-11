import { markOnboardingCompleted } from './api';

const mockEq = jest.fn((_column: string, _userId: string) =>
  Promise.resolve({ error: null as Error | null }),
);
const mockUpdate = jest.fn((_values: { onboarding_completed_at: string }) => ({ eq: mockEq }));
const mockFrom = jest.fn((_table: string) => ({ update: mockUpdate }));

jest.mock('@/lib/backend/supabase/remote-client', () => ({
  getSupabase: () => ({ from: mockFrom }),
}));

describe('markOnboardingCompleted', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEq.mockResolvedValue({ error: null });
  });

  it('writes the completion timestamp for the requested profile', async () => {
    await expect(markOnboardingCompleted('user-1')).resolves.toEqual({ error: null });

    expect(mockFrom).toHaveBeenCalledWith('profiles');
    const update = mockUpdate.mock.calls[0]?.[0];
    expect(update?.onboarding_completed_at).toEqual(expect.any(String));
    expect(new Date(update?.onboarding_completed_at ?? '').toISOString()).toBe(
      update?.onboarding_completed_at,
    );
    expect(mockEq).toHaveBeenCalledWith('id', 'user-1');
  });

  it('returns the database error to its caller', async () => {
    const error = new Error('profile update rejected');
    mockEq.mockResolvedValue({ error });

    await expect(markOnboardingCompleted('user-1')).resolves.toEqual({ error });
  });
});
