import type { RealtimeChannel } from '@supabase/supabase-js';
import type { TypedSupabaseClient } from '@/lib/backend/supabase/remote-client';

export function subscribeHouseholdMembershipRealtime(
  supabase: TypedSupabaseClient,
  userId: string,
  onJoin: () => void,
): () => void {
  const topic = `household-memberships:${userId}`;
  for (const stale of supabase.getChannels()) {
    if (stale.topic === `realtime:${topic}`) void supabase.removeChannel(stale);
  }

  let stopped = false;
  const channel: RealtimeChannel = supabase
    .channel(topic)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'household_members',
        filter: `user_id=eq.${userId}`,
      },
      () => {
        if (!stopped) onJoin();
      },
    )
    .subscribe();

  return () => {
    stopped = true;
    void supabase.removeChannel(channel);
  };
}
