export const DEFAULT_BROCHURE_AI_MAX_CALLS = 20;
export const DEFAULT_BROCHURE_AI_MAX_TOKENS = 300;
export const DEFAULT_BROCHURE_AI_TIMEOUT_MS = 45_000;
export const MAX_BROCHURE_AI_MAX_CALLS = 1_000;
export const MAX_BROCHURE_AI_MAX_TOKENS = 2_048;
export const MAX_BROCHURE_AI_TIMEOUT_MS = 120_000;

export type BrochureAiBudgetOptions = {
  maxCalls: number;
  maxTokens: number;
  timeoutMs: number;
};

type Environment = Record<string, string | undefined>;

function argumentValue(args: readonly string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  return args.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function finiteInteger(
  value: string | undefined,
  fallback: number,
  name: string,
  minimum: number,
  maximum: number,
): number {
  if (value === undefined) return fallback;
  const normalized = value.trim();
  const parsed = Number(normalized);
  if (
    normalized.length === 0 ||
    !Number.isSafeInteger(parsed) ||
    parsed < minimum ||
    parsed > maximum
  ) {
    throw new Error(
      `${name} muss eine endliche ganze Zahl zwischen ${minimum} und ${maximum} sein.`,
    );
  }
  return parsed;
}

export function parseBrochureAiBudget(
  args: readonly string[],
  environment: Environment,
): BrochureAiBudgetOptions {
  return {
    maxCalls: finiteInteger(
      argumentValue(args, 'ai-max-calls') ?? environment.BROCHURE_AI_MAX_CALLS,
      DEFAULT_BROCHURE_AI_MAX_CALLS,
      '--ai-max-calls / BROCHURE_AI_MAX_CALLS',
      0,
      MAX_BROCHURE_AI_MAX_CALLS,
    ),
    maxTokens: finiteInteger(
      argumentValue(args, 'ai-max-tokens') ?? environment.BROCHURE_AI_MAX_TOKENS,
      DEFAULT_BROCHURE_AI_MAX_TOKENS,
      '--ai-max-tokens / BROCHURE_AI_MAX_TOKENS',
      1,
      MAX_BROCHURE_AI_MAX_TOKENS,
    ),
    timeoutMs: finiteInteger(
      argumentValue(args, 'ai-timeout-ms') ?? environment.BROCHURE_AI_TIMEOUT_MS,
      DEFAULT_BROCHURE_AI_TIMEOUT_MS,
      '--ai-timeout-ms / BROCHURE_AI_TIMEOUT_MS',
      1,
      MAX_BROCHURE_AI_TIMEOUT_MS,
    ),
  };
}

export class AiCallBudget {
  private used = 0;

  constructor(private readonly maxCalls: number) {
    if (!Number.isSafeInteger(maxCalls) || maxCalls < 0) {
      throw new Error('Das KI-Aufrufbudget muss eine endliche, nicht negative Ganzzahl sein.');
    }
  }

  get callsMade(): number {
    return this.used;
  }

  get exhausted(): boolean {
    return this.used >= this.maxCalls;
  }

  tryConsume(): boolean {
    if (this.exhausted) return false;
    this.used += 1;
    return true;
  }
}
