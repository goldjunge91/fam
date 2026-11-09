export type AssistantPageContext =
  | { kind: 'recipe'; recipeId: string }
  | { kind: 'meal_plan'; weekStartDate: string };

export type AssistantAttachmentMimeType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'application/pdf';

/** A validated attachment sent only with the current Assistant request. */
export type AssistantAttachment = {
  filename: string;
  mimeType: AssistantAttachmentMimeType;
  data: string;
};

/** Local file metadata before the file is read and encoded for the Gateway. */
export type AssistantAttachmentInput = {
  uri: string;
  name: string;
  mimeType: AssistantAttachmentMimeType;
};

export type AssistantAttachmentMetadata = Pick<AssistantAttachment, 'filename' | 'mimeType'>;

export type AssistantMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
  attachmentName?: string;
  attachments?: AssistantAttachmentMetadata[];
  pageContext?: AssistantPageContext;
  suggestions?: string[];
  proposals?: AssistantProposal[];
  /** Indizes erfolgreich übernommener Vorschläge, lokal im verschlüsselten Verlauf gespeichert. */
  appliedProposalIndexes?: number[];
  toolTrace?: AssistantToolName[];
};

export type AssistantToolName =
  | 'search_recipes'
  | 'get_inventory'
  | 'get_shopping_list'
  | 'propose_meal_plan'
  | 'suggest_ingredient_swap'
  | 'propose_shopping_list_item'
  | 'propose_shopping_list_items';

export type AssistantProposalFoodRuleCoverage = {
  status: 'clear';
  rulesUpdatedAt: string | null;
  recipeVersions: Array<{
    recipeId: string;
    recipeUpdatedAt: string;
    coverageVersion: string;
  }>;
};

export type AssistantProposal =
  | {
      kind: 'meal_plan_proposal.v1';
      foodRulesUpdatedAt: string | null;
      /** Absent only in saved conversations created before current evidence versions existed. */
      foodRuleCoverage?: AssistantProposalFoodRuleCoverage;
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
      /** Absent only in saved conversations created before current evidence versions existed. */
      foodRuleCoverage?: AssistantProposalFoodRuleCoverage;
      recipeId: string;
      recipeTitle: string;
      ingredientItemId?: string;
      ingredientName: string;
      replacement: string;
      rationale: string;
      safetyNote: string;
    }
  | {
      kind: 'shopping_list_proposal.v1';
      summary: string;
      items: Array<{
        name: string;
        quantity: number;
        unit: 'g' | 'kg' | 'ml' | 'l' | 'piece' | 'package' | 'portion';
        foodRuleStatus: 'clear' | 'unknown';
      }>;
    }
  | {
      kind: 'shopping_list_item_proposal.v1';
      name: string;
      quantity: number;
      unit: 'g' | 'kg' | 'ml' | 'l' | 'piece' | 'package' | 'portion';
      foodRuleStatus: 'clear' | 'unknown';
    };

export type AssistantThread = {
  id: string;
  title: string;
  model: string;
  messages: AssistantMessage[];
  createdAt: string;
  updatedAt: string;
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

export function createLocalId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
