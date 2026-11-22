export type GatewayProvider = 'openrouter' | 'groq';

export const DEFAULT_AI_GATEWAY_PROVIDER: GatewayProvider = 'openrouter';

export const ALLOWED_MODELS = [
  'ibm-granite/granite-4.2-8b',
  'google/gemma-4-26b-a4b-it',
  'qwen/qwen3.8-flash',
  'z-ai/glm-5.3-flash',
  'google/gemma-4-31b-it',
  'minimax/minimax-m3:free',
] as const;

export const GROQ_ALLOWED_MODELS = [
  'qwen/qwen3.8-27b',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'openai/gpt-oss-safeguard-20b',
  'meta-llama/llama-prompt-guard-2-22m',
  'meta-llama/llama-prompt-guard-2-86m',
] as const;

export const PROVIDER_DEFAULT_MODELS: Readonly<Record<GatewayProvider, string>> = {
  openrouter: 'z-ai/glm-5.3-flash',
  groq: 'qwen/qwen3.8-27b',
};

export const SHARED_COMPLETION_MAX_TOKENS = 1_536;
export const MAX_GATEWAY_OUTPUT_TOKENS = 8_192;
export const DEFAULT_COMPLETION_TEMPERATURE = 0;

export const DEFAULT_MEDIA_FALLBACK = {
  provider: 'openrouter',
  model: 'qwen/qwen3.8-flash',
} as const satisfies { provider: GatewayProvider; model: string };

export const GROQ_TRANSCRIPTION_PROFILE = {
  provider: 'groq',
  model: 'whisper-large-v3-turbo',
} as const satisfies { provider: GatewayProvider; model: string };

export const AI_GATEWAY_FLOWS = {
  assistant: 'assistant',
  inventoryCapture: 'inventory_capture',
  cookingFromInventory: 'cooking_from_inventory',
  recipeImport: 'recipe_import',
  localModelTest: 'local_model_test',
} as const;

export type AiGatewayFlow = typeof AI_GATEWAY_FLOWS[keyof typeof AI_GATEWAY_FLOWS];

export type AiGatewayProjectDefaults = {
  provider: GatewayProvider;
  model: string;
};

export type GroqReasoningParameters = Readonly<{
  reasoning_format: 'hidden';
  reasoning_effort: 'none';
}>;

export type OpenRouterReasoningParameters = Readonly<{
  enabled: false;
}>;

export type AiGatewayReasoningParameters = {
  groq?: GroqReasoningParameters;
  openrouter?: OpenRouterReasoningParameters;
};

type AiGatewayFlowProfile = Readonly<{
  maxTokens?: number;
  temperature?: number;
  reasoning?: Readonly<{
    groqQwen?: GroqReasoningParameters;
  }>;
}>;

const GROQ_QWEN_HIDDEN_REASONING: GroqReasoningParameters = {
  reasoning_format: 'hidden',
  reasoning_effort: 'none',
};

const GRANITE_OPENROUTER_REASONING: OpenRouterReasoningParameters = {
  enabled: false,
};

export const AI_GATEWAY_FLOW_PROFILES: Record<AiGatewayFlow, AiGatewayFlowProfile> = {
  [AI_GATEWAY_FLOWS.assistant]: {},
  [AI_GATEWAY_FLOWS.inventoryCapture]: {},
  [AI_GATEWAY_FLOWS.cookingFromInventory]: {
    maxTokens: 4_096,
    reasoning: { groqQwen: GROQ_QWEN_HIDDEN_REASONING },
  },
  [AI_GATEWAY_FLOWS.recipeImport]: {
    reasoning: { groqQwen: GROQ_QWEN_HIDDEN_REASONING },
  },
  [AI_GATEWAY_FLOWS.localModelTest]: {
    maxTokens: 1_024,
  },
};

const GRANITE_MODEL = 'ibm-granite/granite-4.2-8b';
const GROQ_QWEN_MODEL = 'qwen/qwen3.8-27b';

export type ResolvedAiGatewayFlowConfig = {
  flow: AiGatewayFlow;
  provider: GatewayProvider;
  model: string;
  maxTokens: number;
  temperature: number;
  reasoning: AiGatewayReasoningParameters;
};

export function resolveAiGatewayFlowConfig(
  flow: AiGatewayFlow,
  projectDefaults: AiGatewayProjectDefaults,
): ResolvedAiGatewayFlowConfig {
  const profile = AI_GATEWAY_FLOW_PROFILES[flow];
  const reasoning: AiGatewayReasoningParameters = {};

  if (
    projectDefaults.provider === 'groq' &&
    projectDefaults.model === GROQ_QWEN_MODEL &&
    profile.reasoning?.groqQwen !== undefined
  ) {
    reasoning.groq = profile.reasoning.groqQwen;
  }
  if (projectDefaults.provider === 'openrouter' && projectDefaults.model === GRANITE_MODEL) {
    reasoning.openrouter = GRANITE_OPENROUTER_REASONING;
  }

  return {
    flow,
    provider: projectDefaults.provider,
    model: projectDefaults.model,
    maxTokens: profile.maxTokens ?? SHARED_COMPLETION_MAX_TOKENS,
    temperature: profile.temperature ?? DEFAULT_COMPLETION_TEMPERATURE,
    reasoning,
  };
}
