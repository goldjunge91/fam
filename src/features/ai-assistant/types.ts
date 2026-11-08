export type AssistantMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
  attachmentName?: string;
  suggestions?: string[];
  proposals?: AssistantProposal[];
  toolTrace?: AssistantToolName[];
};

export type AssistantToolName =
  | 'search_recipes'
  | 'get_inventory'
  | 'propose_meal_plan'
  | 'suggest_ingredient_swap';

export type AssistantProposal =
  | {
      kind: 'meal_plan_proposal.v1';
      foodRulesUpdatedAt: string | null;
      meals: Array<{
        date: string;
        mealSlot: 'breakfast' | 'lunch' | 'dinner';
        recipeId: string;
        recipeTitle: string;
        recipeUpdatedAt: string;
        portions: number;
        rationale: string;
      }>;
      safetyNote: string;
    }
  | {
      kind: 'ingredient_swap_proposal.v1';
      foodRulesUpdatedAt: string | null;
      recipeId: string;
      recipeTitle: string;
      ingredientName: string;
      replacement: string;
      rationale: string;
      safetyNote: string;
    };

export type AssistantThread = {
  id: string;
  title: string;
  model: string;
  messages: AssistantMessage[];
  createdAt: string;
  updatedAt: string;
};

export type AiConsentRecord = {
  version: 'fam-ai-v2';
  acceptedAt: string;
};

export type AssistantHistoryMessage = Pick<AssistantMessage, 'role' | 'text'>;

export type AssistantReply = {
  requestId: string;
  skill: 'fam-assistant';
  model: string;
  result: {
    kind: 'assistant_reply.v1';
    text: string;
    suggestions: string[];
    proposals: AssistantProposal[];
    toolTrace: AssistantToolName[];
  };
  usage?: {
    total_tokens?: number;
    cost?: number;
  };
};

export type AiCreditStatus = {
  creditsUsed: number;
  creditsRemaining: number;
  creditLimit: number;
  warningReached: boolean;
  blocked: boolean;
};

export const DEFAULT_AI_MODEL = 'z-ai/glm-5.3-flash';
export const AI_CONSENT_VERSION = 'fam-ai-v2';

export function createLocalId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
