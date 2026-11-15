export type AiProvider = 'openrouter' | 'groq';
export type AiModelsByProvider = Record<AiProvider, string>;

export const AI_PROVIDERS = ['openrouter', 'groq'] as const satisfies readonly AiProvider[];

export const AI_PROVIDER_LABELS: Record<AiProvider, string> = {
  openrouter: 'OpenRouter',
  groq: 'Groq',
};

export type AiModelOption = {
  id: string;
  label: string;
  description: string;
  supportsImages: boolean;
};

export const AI_MODEL_CATALOG: Record<AiProvider, readonly AiModelOption[]> = {
  openrouter: [
    {
      id: 'z-ai/glm-5.3-flash',
      label: 'GLM 5.3 Flash',
      description: 'Schnell und für alle fam-AI-Abläufe freigegeben',
      supportsImages: true,
    },
    {
      id: 'qwen/qwen3.8-flash',
      label: 'Qwen 3.8 Flash',
      description: 'Schnell, mit Bildverarbeitung',
      supportsImages: true,
    },
    {
      id: 'google/gemma-4-26b-a4b-it',
      label: 'Gemma 4 26B',
      description: 'Kompaktes multimodales Modell',
      supportsImages: true,
    },
    {
      id: 'google/gemma-4-31b-it',
      label: 'Gemma 4 31B',
      description: 'Größeres multimodales Modell',
      supportsImages: true,
    },
    {
      id: 'ibm-granite/granite-4.2-8b',
      label: 'Granite 4.2 8B',
      description: 'Kleines Textmodell',
      supportsImages: false,
    },
    {
      id: 'minimax/minimax-m3:free',
      label: 'MiniMax M3',
      description: 'Textmodell über OpenRouter',
      supportsImages: false,
    },
  ],
  groq: [
    {
      id: 'qwen/qwen3.8-27b',
      label: 'Qwen 3.8 27B',
      description: 'Free Plan · Bilder, JSON und Tool-Aufrufe',
      supportsImages: true,
    },
    {
      id: 'openai/gpt-oss-120b',
      label: 'GPT-OSS 120B',
      description: 'Free Plan · Starkes Textmodell mit JSON und Tools',
      supportsImages: false,
    },
    {
      id: 'openai/gpt-oss-20b',
      label: 'GPT-OSS 20B',
      description: 'Free Plan · Schnelles Textmodell mit JSON und Tools',
      supportsImages: false,
    },
    {
      id: 'openai/gpt-oss-safeguard-20b',
      label: 'GPT-OSS Safeguard 20B',
      description: 'Free Plan · Auf Sicherheitsklassifikation spezialisiert',
      supportsImages: false,
    },
    {
      id: 'meta-llama/llama-prompt-guard-2-22m',
      label: 'Llama Prompt Guard 2 22M',
      description: 'Free Plan · Kleiner Prompt-Injection-Klassifikator',
      supportsImages: false,
    },
    {
      id: 'meta-llama/llama-prompt-guard-2-86m',
      label: 'Llama Prompt Guard 2 86M',
      description: 'Free Plan · Prompt-Injection-Klassifikator',
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
