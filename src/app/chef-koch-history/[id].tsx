import { Redirect, useLocalSearchParams } from 'expo-router';
import { z } from 'zod';

import { ChefHistoryDetailScreen } from '@/features/chef-koch/screens/chef-history-detail-screen';

const paramsSchema = z.strictObject({
  id: z.uuid(),
  kind: z.enum(['conversation', 'recipe']),
});

export default function ChefHistoryDetailRoute() {
  const params = useLocalSearchParams<{ id?: string | string[]; kind?: string | string[] }>();
  const parsed = paramsSchema.safeParse({
    id: typeof params.id === 'string' ? params.id : undefined,
    kind: typeof params.kind === 'string' ? params.kind : undefined,
  });

  if (!parsed.success) return <Redirect href="/chef-koch-history" />;
  return <ChefHistoryDetailScreen id={parsed.data.id} kind={parsed.data.kind} />;
}
