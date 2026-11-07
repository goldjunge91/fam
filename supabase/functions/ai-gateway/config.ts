export const DEFAULT_MODEL = 'google/gemma-4-31b-it:free';

export const ALLOWED_MODELS = [
  'google/gemma-4-31b-it:free',
  'google/gemma-4-26b-a4b-it:free',
  'xingchen-agi/xing4.0-29b-a4b:free',
  'z-ai/glm-5.3-flash',
] as const;

type AllowedModel = (typeof ALLOWED_MODELS)[number];

export function resolveDefaultModel(configuredModel: string | undefined): AllowedModel {
  const model = configuredModel?.trim() || DEFAULT_MODEL;
  if (!ALLOWED_MODELS.includes(model as AllowedModel)) {
    throw new Error('AI_GATEWAY_MODEL is not an allowed model');
  }
  return model as AllowedModel;
}

export type ModelReasoningConfig =
  | { enabled: boolean }
  | { effort: 'low' | 'medium' | 'high' };

export type ModelExecutionProfile = {
  temperature: number;
  maxTokens: number;
  reasoning?: ModelReasoningConfig;
};

const DEFAULT_EXECUTION_PROFILE: ModelExecutionProfile = {
  temperature: 0,
  maxTokens: 4_096,
};

const MODEL_EXECUTION_PROFILES: Readonly<
  Record<string, Partial<ModelExecutionProfile>>
> = {
  'ibm-granite/granite-4.2-8b': { reasoning: { enabled: false } },
  'z-ai/glm-5.3-flash': { reasoning: { effort: 'low' } },
};

export function getModelExecutionProfile(model: string): ModelExecutionProfile {
  return {
    ...DEFAULT_EXECUTION_PROFILE,
    ...(MODEL_EXECUTION_PROFILES[model] ?? {}),
  };
}
