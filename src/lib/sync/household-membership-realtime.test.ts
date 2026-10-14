import type { RealtimeChannel } from '@supabase/supabase-js';
import type { TypedSupabaseClient } from '@/lib/backend/supabase/remote-client';
import { subscribeHouseholdMembershipRealtime } from '@/lib/sync/household-membership-realtime';

describe('subscribeHouseholdMembershipRealtime', () => {
  it('refreshes the household mirror when this user joins on another device', () => {
    const onJoin = jest.fn();
    const onEvent = jest.fn();
    let registration: { event: string; schema: string; table: string; filter: string } | undefined;

    const channel = {
      topic: 'realtime:household-memberships:user-1',
      on: jest.fn((_type, config, callback) => {
        registration = config;
        onEvent.mockImplementation(callback);
        return channel;
      }),
      subscribe: jest.fn(() => channel),
    } as unknown as RealtimeChannel;
    const supabase = {
      channel: jest.fn(() => channel),
      getChannels: jest.fn(() => []),
      removeChannel: jest.fn(),
    } as unknown as TypedSupabaseClient;

    const unsubscribe = subscribeHouseholdMembershipRealtime(supabase, 'user-1', onJoin);

    expect(registration).toEqual({
      event: 'INSERT',
      schema: 'public',
      table: 'household_members',
      filter: 'user_id=eq.user-1',
    });
    onEvent({ new: { household_id: 'household-1', user_id: 'user-1' } });
    expect(onJoin).toHaveBeenCalledTimes(1);

    unsubscribe();
    onEvent({ new: { household_id: 'household-2', user_id: 'user-1' } });
    expect(onJoin).toHaveBeenCalledTimes(1);
    expect(supabase.removeChannel).toHaveBeenCalledWith(channel);
  });

  it('removes only stale membership channels for this user', () => {
    const onJoin = jest.fn();
    const staleChannel = { topic: 'realtime:household-memberships:user-1' } as RealtimeChannel;
    const otherChannel = { topic: 'realtime:household-memberships:user-2' } as RealtimeChannel;
    const channel = {
      topic: 'realtime:household-memberships:user-1',
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnThis(),
    } as unknown as RealtimeChannel;
    const supabase = {
      channel: jest.fn(() => channel),
      getChannels: jest.fn(() => [staleChannel, otherChannel]),
      removeChannel: jest.fn(),
    } as unknown as TypedSupabaseClient;

    subscribeHouseholdMembershipRealtime(supabase, 'user-1', onJoin);

    expect(supabase.removeChannel).toHaveBeenCalledTimes(1);
    expect(supabase.removeChannel).toHaveBeenCalledWith(staleChannel);
    expect(supabase.removeChannel).not.toHaveBeenCalledWith(otherChannel);
  });
});
