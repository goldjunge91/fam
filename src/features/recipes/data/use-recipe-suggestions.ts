import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useDevSettingsStore } from '@/constants/dev-settings';
import { aiCreditStatusQueryKey } from '@/features/ai-credits/api';
import { hydrateChefHistory } from '@/features/chef-koch/data/chef-history-repository';
import { chefHistoryQueryKey } from '@/features/chef-koch/data/use-chef-history';
import { getDatabase } from '@/lib/db/local-client';
import { reportError } from '@/lib/telemetry';

import {
  type RecipeSuggestionGatewayRequest,
  type RecipeSuggestionGatewayResponse,
  requestRecipeSuggestions,
} from './recipe-suggestion-gateway';

/** Starts a recipe request and mirrors its server-owned History without using the outbox. */
export function useRecipeSuggestions() {
  const aiGatewayModel = useDevSettingsStore((state) => state.aiGatewayModel);
  const queryClient = useQueryClient();

  return useMutation<RecipeSuggestionGatewayResponse, Error, RecipeSuggestionGatewayRequest>({
    mutationFn: async (input) => {
      const response = await requestRecipeSuggestions(
        __DEV__ && aiGatewayModel !== null ? { ...input, model: aiGatewayModel } : input,
      );
      try {
        await hydrateChefHistory(await getDatabase(), response.history);
      } catch (error) {
        // Der Server-Exchange ist bereits erfolgreich. Ein lokaler Fehler darf
        // deshalb niemals denselben AI-Aufruf erneut ausloesen.
        reportError(error, {
          operation: 'chef_history.hydrate',
          entity: 'chef_conversation_turns',
          error_code: 'chef_history_hydration_failed',
        });
      }
      return response;
    },
    onSuccess: (_response, input) =>
      queryClient.invalidateQueries({ queryKey: chefHistoryQueryKey(input.householdId) }),
    onSettled: (_response, _error, input) =>
      queryClient.invalidateQueries({ queryKey: aiCreditStatusQueryKey(input.householdId) }),
  });
}
