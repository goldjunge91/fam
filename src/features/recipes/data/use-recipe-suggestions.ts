import { useMutation } from '@tanstack/react-query';

import {
  type RecipeSuggestionGatewayRequest,
  type RecipeSuggestionGatewayResponse,
  requestRecipeSuggestions,
} from './recipe-suggestion-gateway';

/** Starts one read-only, server-authorized recipe suggestion request. */
export function useRecipeSuggestions() {
  return useMutation<RecipeSuggestionGatewayResponse, Error, RecipeSuggestionGatewayRequest>({
    mutationFn: (input) => requestRecipeSuggestions(input),
    networkMode: 'online',
  });
}
