import { useMutation } from '@tanstack/react-query';

import {
  type RecipeSuggestionGatewayRequest,
  type RecipeSuggestionGatewayResponse,
  requestRecipeSuggestions,
} from './recipe-suggestion-gateway';

/** Startet einen read-only Rezeptvorschlag; Speicherung und Bestätigung liegen außerhalb dieses Hooks. */
export function useRecipeSuggestions() {
  return useMutation<RecipeSuggestionGatewayResponse, Error, RecipeSuggestionGatewayRequest>({
    mutationFn: (input) => requestRecipeSuggestions(input),
  });
}
