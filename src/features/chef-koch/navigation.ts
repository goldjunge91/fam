export const CHEF_KOCH_ROUTE = '/chef-koch' as const;
export const CHEF_HISTORY_ROUTE = '/chef-koch-history' as const;

/** Both product entries open Chef-Koch so household History stays readable. */
export function getChefKochDestination() {
  return CHEF_KOCH_ROUTE;
}

/** New AI actions remain entitlement-gated independently from History reads. */
export function getChefKochActionDestination(hasAI: boolean) {
  return hasAI
    ? CHEF_KOCH_ROUTE
    : ({
        pathname: '/settings/plus-and-ai' as const,
        params: { tier: 'ai' as const },
      } as const);
}

export function getChefConversationRoute(id: string) {
  return {
    pathname: '/chef-koch-history/[id]' as const,
    params: { id, kind: 'conversation' as const },
  };
}

export function getChefRecipeHistoryRoute(id: string) {
  return {
    pathname: '/chef-koch-history/[id]' as const,
    params: { id, kind: 'recipe' as const },
  };
}
