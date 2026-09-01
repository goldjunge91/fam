import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type React from 'react';

import {
  useAddChildProfileMutation,
  useChildProfiles,
  useCreateHouseholdMutation,
  useCreateInviteMutation,
  useDeleteChildProfileMutation,
  useDeleteHouseholdMutation,
  useHouseholdInvites,
  useHouseholdMembers,
  useHouseholds,
  useLeaveHouseholdMutation,
  useRedeemInviteMutation,
  useRemoveMemberMutation,
  useRevokeInviteMutation,
  useUpdateChildProfileMutation,
  useUpdateMemberRoleMutation,
} from '@/features/household/api';
import { trackAnalyticsEvent } from '@/lib/analytics';
import { triggerHouseholdsPull } from '@/lib/sync/household-bootstrap-sync';

const mockDbGetAllAsync = jest.fn();
const mockRpc = jest.fn();
const mockFrom = jest.fn();
let mockUserId: string | null = 'user-1';

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({
    session: mockUserId ? { user: { id: mockUserId } } : null,
  }),
}));

jest.mock('@/lib/analytics', () => ({
  trackAnalyticsEvent: jest.fn(),
}));

jest.mock('@/lib/db/client', () => ({
  getDatabase: async () => ({
    getAllAsync: (...args: unknown[]) => mockDbGetAllAsync(...args),
  }),
}));

jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  }),
}));

jest.mock('@/lib/sync/household-bootstrap-sync', () => ({
  triggerHouseholdsPull: jest.fn().mockResolvedValue(undefined),
}));

type SupabaseResult = {
  data: unknown;
  error: { message: string } | null;
};

function createSupabaseBuilder(result: SupabaseResult = { data: null, error: null }) {
  const select = jest.fn();
  const insert = jest.fn();
  const update = jest.fn();
  const remove = jest.fn();
  const eq = jest.fn();
  const is = jest.fn();
  const gt = jest.fn();
  const order = jest.fn();
  const single = jest.fn();

  const builder = {
    select,
    insert,
    update,
    delete: remove,
    eq,
    is,
    gt,
    order,
    single,
    // biome-ignore lint/suspicious/noThenProperty: Supabase-Builder sind absichtlich PromiseLike.
    then: (
      onFulfilled: (value: SupabaseResult) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(onFulfilled, onRejected),
  };

  for (const chainMethod of [select, insert, update, remove, eq, is, gt, order, single]) {
    chainMethod.mockReturnValue(builder);
  }

  return builder;
}

describe('household api', () => {
  let queryClient: QueryClient;

  function HouseholdApiProviders({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockUserId = 'user-1';
    mockDbGetAllAsync.mockResolvedValue([]);
    mockRpc.mockResolvedValue({ data: null, error: null });
    mockFrom.mockImplementation(() => createSupabaseBuilder());
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
        mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('liest Haushalte lokal und konvertiert SQLite 0/1 in Booleans', async () => {
    mockDbGetAllAsync.mockResolvedValue([
      {
        id: 'hh-1',
        name: 'Familie Eins',
        created_by: 'user-1',
        created_at: '2026-08-01T00:00:00.000Z',
        premium_active: 1,
        premium_expires_at: null,
      },
      {
        id: 'hh-2',
        name: 'Familie Zwei',
        created_by: 'user-1',
        created_at: '2026-08-02T00:00:00.000Z',
        premium_active: 0,
        premium_expires_at: null,
      },
    ]);

    const { result } = await renderHook(() => useHouseholds(), {
      wrapper: HouseholdApiProviders,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.map(({ id, premium_active }) => ({ id, premium_active }))).toEqual([
      { id: 'hh-1', premium_active: true },
      { id: 'hh-2', premium_active: false },
    ]);
    expect(mockDbGetAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('order by created_at asc'),
    );
  });

  it('startet ohne angemeldeten Nutzer keine Haushaltsabfrage', async () => {
    mockUserId = null;

    const { result } = await renderHook(() => useHouseholds(), {
      wrapper: HouseholdApiProviders,
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockDbGetAllAsync).not.toHaveBeenCalled();
  });

  it('lädt Mitglieder per RPC, normalisiert null und reicht Fehler verständlich weiter', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

    const members = await renderHook(() => useHouseholdMembers('hh-1'), {
      wrapper: HouseholdApiProviders,
    });

    await waitFor(() => expect(members.result.current.isSuccess).toBe(true));
    expect(members.result.current.data).toEqual([]);
    expect(mockRpc).toHaveBeenCalledWith('household_member_profiles', { hid: 'hh-1' });

    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'Nicht erlaubt' } });

    const deniedMembers = await renderHook(() => useHouseholdMembers('hh-2'), {
      wrapper: HouseholdApiProviders,
    });

    await waitFor(() => expect(deniedMembers.result.current.isError).toBe(true));
    expect(deniedMembers.result.current.error).toEqual(new Error('Nicht erlaubt'));
  });

  it('erstellt einen Haushalt und zieht danach den lokalen Haushaltsstand nach', async () => {
    mockRpc.mockResolvedValue({ data: 'hh-new', error: null });

    const { result } = await renderHook(() => useCreateHouseholdMutation(), {
      wrapper: HouseholdApiProviders,
    });

    await act(async () => {
      await result.current.mutateAsync('Neuer Haushalt');
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockRpc).toHaveBeenCalledWith('create_household', {
      household_name: 'Neuer Haushalt',
    });
    expect(triggerHouseholdsPull).toHaveBeenCalledWith('user-1', queryClient);
    expect(trackAnalyticsEvent).toHaveBeenCalledWith('household.create.completed');
  });

  it('aktualisiert Rollen und entfernt Mitglieder mit haushaltsspezifischer Invalidierung', async () => {
    const roleBuilder = createSupabaseBuilder({ data: [{ user_id: 'member-1' }], error: null });
    mockFrom.mockReturnValue(roleBuilder);
    const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');

    const roleMutation = await renderHook(() => useUpdateMemberRoleMutation(), {
      wrapper: HouseholdApiProviders,
    });

    await act(async () => {
      await roleMutation.result.current.mutateAsync({
        householdId: 'hh-1',
        userId: 'member-1',
        role: 'admin',
      });
    });
    await waitFor(() => expect(roleMutation.result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith('household_members');
    expect(roleBuilder.update).toHaveBeenCalledWith({
      role: 'admin',
      updated_at: expect.any(String),
    });
    expect(roleBuilder.eq).toHaveBeenNthCalledWith(1, 'household_id', 'hh-1');
    expect(roleBuilder.eq).toHaveBeenNthCalledWith(2, 'user_id', 'member-1');
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['households', 'hh-1', 'members'],
    });
    expect(trackAnalyticsEvent).toHaveBeenCalledWith('household.member_update.completed', {
      role: 'admin',
    });

    const removeBuilder = createSupabaseBuilder({ data: null, error: null });
    mockFrom.mockReturnValue(removeBuilder);
    const removeMutation = await renderHook(() => useRemoveMemberMutation(), {
      wrapper: HouseholdApiProviders,
    });

    await act(async () => {
      await removeMutation.result.current.mutateAsync({
        householdId: 'hh-1',
        userId: 'member-2',
      });
    });
    await waitFor(() => expect(removeMutation.result.current.isSuccess).toBe(true));

    expect(removeBuilder.delete).toHaveBeenCalledTimes(1);
    expect(removeBuilder.eq).toHaveBeenNthCalledWith(1, 'household_id', 'hh-1');
    expect(removeBuilder.eq).toHaveBeenNthCalledWith(2, 'user_id', 'member-2');
    expect(trackAnalyticsEvent).toHaveBeenCalledWith('household.member_remove.completed');
  });

  it('zieht den lokalen Stand nach Verlassen, Löschen und Einlösen einer Einladung nach', async () => {
    const leaveBuilder = createSupabaseBuilder({ data: null, error: null });
    mockFrom.mockReturnValueOnce(leaveBuilder);

    const leaveMutation = await renderHook(() => useLeaveHouseholdMutation(), {
      wrapper: HouseholdApiProviders,
    });
    await act(async () => {
      await leaveMutation.result.current.mutateAsync('hh-leave');
    });
    await waitFor(() => expect(leaveMutation.result.current.isSuccess).toBe(true));
    expect(leaveBuilder.eq).toHaveBeenCalledWith('household_id', 'hh-leave');

    const deleteBuilder = createSupabaseBuilder({ data: null, error: null });
    mockFrom.mockReturnValueOnce(deleteBuilder);

    const deleteMutation = await renderHook(() => useDeleteHouseholdMutation(), {
      wrapper: HouseholdApiProviders,
    });
    await act(async () => {
      await deleteMutation.result.current.mutateAsync('hh-delete');
    });
    await waitFor(() => expect(deleteMutation.result.current.isSuccess).toBe(true));
    expect(deleteBuilder.eq).toHaveBeenCalledWith('id', 'hh-delete');

    mockRpc.mockResolvedValueOnce({ data: 'hh-joined', error: null });
    const redeemMutation = await renderHook(() => useRedeemInviteMutation(), {
      wrapper: HouseholdApiProviders,
    });
    await act(async () => {
      await redeemMutation.result.current.mutateAsync('invite-token');
    });
    await waitFor(() => expect(redeemMutation.result.current.isSuccess).toBe(true));

    expect(mockRpc).toHaveBeenCalledWith('redeem_invite', { invite_token: 'invite-token' });
    expect(triggerHouseholdsPull).toHaveBeenCalledTimes(3);
    expect(trackAnalyticsEvent).toHaveBeenCalledWith('household.leave.completed');
    expect(trackAnalyticsEvent).toHaveBeenCalledWith('household.delete.completed');
    expect(trackAnalyticsEvent).toHaveBeenCalledWith('household.join.completed');
  });

  it('lädt nur aktive Einladungen in absteigender Reihenfolge', async () => {
    const invite = { id: 'invite-1', household_id: 'hh-1' };
    const inviteBuilder = createSupabaseBuilder({ data: [invite], error: null });
    mockFrom.mockReturnValue(inviteBuilder);

    const { result } = await renderHook(() => useHouseholdInvites('hh-1'), {
      wrapper: HouseholdApiProviders,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([invite]);
    expect(inviteBuilder.select).toHaveBeenCalledWith('*');
    expect(inviteBuilder.eq).toHaveBeenCalledWith('household_id', 'hh-1');
    expect(inviteBuilder.is).toHaveBeenCalledWith('revoked_at', null);
    expect(inviteBuilder.gt).toHaveBeenCalledWith('expires_at', expect.any(String));
    expect(inviteBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('erstellt und widerruft Einladungen mit korrekter Cache-Invalidierung', async () => {
    const createBuilder = createSupabaseBuilder({ data: { id: 'invite-new' }, error: null });
    mockFrom.mockReturnValueOnce(createBuilder);
    const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');

    const createMutation = await renderHook(() => useCreateInviteMutation(), {
      wrapper: HouseholdApiProviders,
    });
    await act(async () => {
      await createMutation.result.current.mutateAsync({
        householdId: 'hh-1',
        createdBy: 'user-1',
      });
    });
    await waitFor(() => expect(createMutation.result.current.isSuccess).toBe(true));

    expect(createBuilder.insert).toHaveBeenCalledWith({
      household_id: 'hh-1',
      created_by: 'user-1',
      expires_at: expect.any(String),
      max_uses: 1,
    });
    expect(createBuilder.select).toHaveBeenCalledWith('*');
    expect(createBuilder.single).toHaveBeenCalledTimes(1);

    const revokeBuilder = createSupabaseBuilder({ data: null, error: null });
    mockFrom.mockReturnValueOnce(revokeBuilder);
    const revokeMutation = await renderHook(() => useRevokeInviteMutation(), {
      wrapper: HouseholdApiProviders,
    });
    await act(async () => {
      await revokeMutation.result.current.mutateAsync({
        inviteId: 'invite-new',
        householdId: 'hh-1',
      });
    });
    await waitFor(() => expect(revokeMutation.result.current.isSuccess).toBe(true));

    expect(revokeBuilder.update).toHaveBeenCalledWith({ revoked_at: expect.any(String) });
    expect(revokeBuilder.eq).toHaveBeenCalledWith('id', 'invite-new');
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['households', 'hh-1', 'invites'],
    });
  });

  it('lädt Kinderprofile sortiert und reicht Supabase-Fehler weiter', async () => {
    const child = { id: 'child-1', household_id: 'hh-1', display_name: 'Mia' };
    const childBuilder = createSupabaseBuilder({ data: [child], error: null });
    mockFrom.mockReturnValueOnce(childBuilder);

    const profiles = await renderHook(() => useChildProfiles('hh-1'), {
      wrapper: HouseholdApiProviders,
    });

    await waitFor(() => expect(profiles.result.current.isSuccess).toBe(true));
    expect(profiles.result.current.data).toEqual([child]);
    expect(childBuilder.order).toHaveBeenCalledWith('created_at', { ascending: true });

    const deniedBuilder = createSupabaseBuilder({ data: null, error: { message: 'RLS denied' } });
    mockFrom.mockReturnValueOnce(deniedBuilder);
    const deniedProfiles = await renderHook(() => useChildProfiles('hh-2'), {
      wrapper: HouseholdApiProviders,
    });

    await waitFor(() => expect(deniedProfiles.result.current.isError).toBe(true));
    expect(deniedProfiles.result.current.error).toEqual(new Error('RLS denied'));
  });

  it('erstellt, aktualisiert und löscht Kinderprofile mit exakten Payloads', async () => {
    const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
    const addBuilder = createSupabaseBuilder({ data: { id: 'child-1' }, error: null });
    mockFrom.mockReturnValueOnce(addBuilder);

    const addMutation = await renderHook(() => useAddChildProfileMutation(), {
      wrapper: HouseholdApiProviders,
    });
    await act(async () => {
      await addMutation.result.current.mutateAsync({
        householdId: 'hh-1',
        displayName: 'Mia',
        heightCm: 105,
      });
    });
    await waitFor(() => expect(addMutation.result.current.isSuccess).toBe(true));

    expect(addBuilder.insert).toHaveBeenCalledWith({
      household_id: 'hh-1',
      display_name: 'Mia',
      birth_date: null,
      sex: null,
      height_cm: 105,
      managed_by: null,
    });

    const updateBuilder = createSupabaseBuilder({ data: { id: 'child-1' }, error: null });
    mockFrom.mockReturnValueOnce(updateBuilder);
    const updateMutation = await renderHook(() => useUpdateChildProfileMutation(), {
      wrapper: HouseholdApiProviders,
    });
    await act(async () => {
      await updateMutation.result.current.mutateAsync({
        id: 'child-1',
        householdId: 'hh-1',
        displayName: 'Mia Neu',
        birthDate: null,
        heightCm: 106,
      });
    });
    await waitFor(() => expect(updateMutation.result.current.isSuccess).toBe(true));

    expect(updateBuilder.update).toHaveBeenCalledWith({
      updated_at: expect.any(String),
      display_name: 'Mia Neu',
      birth_date: null,
      height_cm: 106,
    });

    const deleteBuilder = createSupabaseBuilder({ data: null, error: null });
    mockFrom.mockReturnValueOnce(deleteBuilder);
    const deleteMutation = await renderHook(() => useDeleteChildProfileMutation(), {
      wrapper: HouseholdApiProviders,
    });
    await act(async () => {
      await deleteMutation.result.current.mutateAsync({ id: 'child-1', householdId: 'hh-1' });
    });
    await waitFor(() => expect(deleteMutation.result.current.isSuccess).toBe(true));

    expect(deleteBuilder.delete).toHaveBeenCalledTimes(1);
    expect(deleteBuilder.eq).toHaveBeenCalledWith('id', 'child-1');
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['households', 'hh-1', 'children'],
    });
  });

  it('meldet Mutationsfehler als Error mit der Supabase-Nachricht', async () => {
    const failedBuilder = createSupabaseBuilder({
      data: null,
      error: { message: 'Update failed' },
    });
    mockFrom.mockReturnValue(failedBuilder);

    const { result } = await renderHook(() => useUpdateMemberRoleMutation(), {
      wrapper: HouseholdApiProviders,
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          householdId: 'hh-1',
          userId: 'member-1',
          role: 'member',
        }),
      ).rejects.toThrow('Update failed');
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
