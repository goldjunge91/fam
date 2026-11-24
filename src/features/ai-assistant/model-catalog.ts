export type AiProvider = 'openrouter' | 'groq';
export type AiModelsByProvider = Record<AiProvider, string>;

export const AI_PROVIDERS = ['openrouter', 'groq'] as const satisfies readonly AiProvider[];

export const AI_PROVIDER_LABEL_KEYS = {
  openrouter: 'dev.ai.providers.openrouter',
  groq: 'dev.ai.providers.groq',
} as const satisfies Record<AiProvider, `dev.ai.providers.${string}`>;

type AiModelCopyKey = `dev.ai.models.${string}.${'label' | 'description'}`;

export type AiModelOption = {
  id: string;
  labelKey: AiModelCopyKey;
  descriptionKey: AiModelCopyKey;
  supportsImages: boolean;
};

export const AI_MODEL_CATALOG: Record<AiProvider, readonly AiModelOption[]> = {
  openrouter: [
    {
      id: 'z-ai/glm-5.3-flash',
      labelKey: 'dev.ai.models.glm53Flash.label',
      descriptionKey: 'dev.ai.models.glm53Flash.description',
      supportsImages: true,
    },
    {
      id: 'qwen/qwen3.8-flash',
      labelKey: 'dev.ai.models.qwen38Flash.label',
      descriptionKey: 'dev.ai.models.qwen38Flash.description',
      supportsImages: true,
    },
    {
      id: 'google/gemma-4-26b-a4b-it',
      labelKey: 'dev.ai.models.gemma426.label',
      descriptionKey: 'dev.ai.models.gemma426.description',
      supportsImages: true,
    },
    {
      id: 'google/gemma-4-31b-it',
      labelKey: 'dev.ai.models.gemma431.label',
      descriptionKey: 'dev.ai.models.gemma431.description',
      supportsImages: true,
    },
    {
      id: 'ibm-granite/granite-4.2-8b',
      labelKey: 'dev.ai.models.granite42.label',
      descriptionKey: 'dev.ai.models.granite42.description',
      supportsImages: false,
    },
    {
      id: 'minimax/minimax-m3:free',
      labelKey: 'dev.ai.models.minimaxM3.label',
      descriptionKey: 'dev.ai.models.minimaxM3.description',
      supportsImages: false,
    },
  ],
  groq: [
    {
      id: 'qwen/qwen3.8-27b',
      labelKey: 'dev.ai.models.qwen3827.label',
      descriptionKey: 'dev.ai.models.qwen3827.description',
      supportsImages: true,
    },
    {
      id: 'openai/gpt-oss-120b',
      labelKey: 'dev.ai.models.gptOss120.label',
      descriptionKey: 'dev.ai.models.gptOss120.description',
      supportsImages: false,
    },
    {
      id: 'openai/gpt-oss-20b',
      labelKey: 'dev.ai.models.gptOss20.label',
      descriptionKey: 'dev.ai.models.gptOss20.description',
      supportsImages: false,
    },
    {
      id: 'openai/gpt-oss-safeguard-20b',
      labelKey: 'dev.ai.models.gptOssSafeguard.label',
      descriptionKey: 'dev.ai.models.gptOssSafeguard.description',
      supportsImages: false,
    },
    {
      id: 'meta-llama/llama-prompt-guard-2-22m',
      labelKey: 'dev.ai.models.promptGuard22.label',
      descriptionKey: 'dev.ai.models.promptGuard22.description',
      supportsImages: false,
    },
    {
      id: 'meta-llama/llama-prompt-guard-2-86m',
      labelKey: 'dev.ai.models.promptGuard86.label',
      descriptionKey: 'dev.ai.models.promptGuard86.description',
      supportsImages: false,
    },
  ],
};

export const DEFAULT_AI_MODELS: Record<AiProvider, string> = {
  openrouter: 'z-ai/glm-5.3-flash',
  groq: 'qwen/qwen3.8-27b',
};

export function isAiProvider(value: unknown): value is AiProvider {
  return value === 'openrouter' || value === 'groq';
}

export function isModelAvailable(provider: AiProvider, model: string): boolean {
  return AI_MODEL_CATALOG[provider].some((option) => option.id === model);
}

export function isValidAiModelId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 160 &&
    /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(value)
  );
}
