export const CHEF_KOCH_MODELS = [
  'google/gemma-4-31b-it:free',
  'google/gemma-4-26b-a4b-it:free',
] as const;

export type ChefKochModel = (typeof CHEF_KOCH_MODELS)[number];

export function isChefKochModel(value: unknown): value is ChefKochModel {
  return typeof value === 'string' && CHEF_KOCH_MODELS.includes(value as ChefKochModel);
}
