import {
  registerLocalAccountCache,
  resetLocalAccountModuleCaches,
} from './local-account-cache-registry';

test('resets each registered module cache for the signed-out account', () => {
  const resetProfileCache = jest.fn();
  const resetRecipeCache = jest.fn();

  registerLocalAccountCache('profile-test', resetProfileCache);
  registerLocalAccountCache('recipes-test', resetRecipeCache);
  resetLocalAccountModuleCaches('user-123');

  expect(resetProfileCache).toHaveBeenCalledWith('user-123');
  expect(resetRecipeCache).toHaveBeenCalledWith('user-123');
});
