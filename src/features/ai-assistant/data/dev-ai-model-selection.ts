import { useDevSettingsStore } from '@/constants/dev-settings';
import { isAiProvider, isValidAiModelId } from '../model-catalog';

export function getDevAiModelSelection(): {
  provider: 'openrouter' | 'groq';
  model: string;
} | null {
  if (!__DEV__) return null;
  const { aiProvider, aiModel } = useDevSettingsStore.getState();
  return isAiProvider(aiProvider) && isValidAiModelId(aiModel)
    ? { provider: aiProvider, model: aiModel }
    : null;
}
