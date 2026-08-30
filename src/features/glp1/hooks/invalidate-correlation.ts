import type { QueryClient } from '@tanstack/react-query';
import { correlationSeriesScopeQueryKey } from '@/features/glp1/domain/query-keys';

export function invalidateCorrelationSeries(
  queryClient: QueryClient,
  userId: string,
  childProfileId?: string | null,
) {
  return queryClient.invalidateQueries({
    queryKey: correlationSeriesScopeQueryKey(userId, childProfileId),
  });
}
