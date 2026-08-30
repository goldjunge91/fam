import { QueryClient } from '@tanstack/react-query';
import { invalidateCorrelationSeries } from '@/features/glp1/hooks/invalidate-correlation';

it('invalidiert die abgeleitete Analyse fuer den betroffenen Account-Scope', async () => {
  const queryClient = new QueryClient();
  const invalidate = jest.spyOn(queryClient, 'invalidateQueries');

  await invalidateCorrelationSeries(queryClient, 'user-1', 'child-1');

  expect(invalidate).toHaveBeenCalledWith({
    queryKey: ['glp1', 'correlation', 'user-1', 'child-1'],
  });
});
