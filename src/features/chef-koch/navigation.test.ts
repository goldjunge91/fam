import {
  CHEF_HISTORY_ROUTE,
  CHEF_KOCH_ROUTE,
  getChefConversationRoute,
  getChefKochActionDestination,
  getChefKochDestination,
  getChefRecipeHistoryRoute,
} from './navigation';

describe('Chef-Koch navigation', () => {
  it('keeps the product entry and history routes stable', () => {
    expect(CHEF_KOCH_ROUTE).toBe('/chef-koch');
    expect(CHEF_HISTORY_ROUTE).toBe('/chef-koch-history');
    expect(getChefKochDestination()).toBe(CHEF_KOCH_ROUTE);
    expect(getChefKochActionDestination(true)).toBe(CHEF_KOCH_ROUTE);
    expect(getChefKochActionDestination(false)).toEqual({
      pathname: '/settings/plus-and-ai',
      params: { tier: 'ai' },
    });
  });

  it('builds typed history routes for conversations and recipe results', () => {
    expect(getChefConversationRoute('conversation-1')).toEqual({
      pathname: '/chef-koch-history/[id]',
      params: { id: 'conversation-1', kind: 'conversation' },
    });
    expect(getChefRecipeHistoryRoute('recipe-history-1')).toEqual({
      pathname: '/chef-koch-history/[id]',
      params: { id: 'recipe-history-1', kind: 'recipe' },
    });
  });
});
