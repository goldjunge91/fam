import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { getSupabase } from '@/lib/backend/supabase/remote-client';

export type AiCreditStatus = {
  householdId: string;
  creditsUsed: number;
  creditsRemaining: number;
  creditLimit: number;
  warningReached: boolean;
  blocked: boolean;
};

const aiCreditStatusSchema = z.strictObject({
  householdId: z.string().min(1),
  creditsUsed: z.number().int().nonnegative(),
  creditsRemaining: z.number().int().nonnegative(),
  creditLimit: z.number().int().positive(),
  warningReached: z.boolean(),
  blocked: z.boolean(),
});

const aiCreditStatusResponseSchema = z.strictObject({
  households: z.array(aiCreditStatusSchema),
  requestId: z.string().min(1),
});

type FunctionsInvoker = {
  invoke: (
    functionName: string,
    options: { body: Record<string, never> },
  ) => Promise<{ data: unknown; error: unknown }>;
};

export function aiCreditStatusQueryKey(householdId: string | null) {
  return ['ai-credits', 'status', householdId] as const;
}

export function parseAiCreditStatusResponse(data: unknown, householdId: string): AiCreditStatus {
  const parsed = aiCreditStatusResponseSchema.safeParse(data);
  if (!parsed.success) throw new Error('ai_credit_status_invalid_response');

  const status = parsed.data.households.find((item) => item.householdId === householdId);
  if (!status) throw new Error('ai_credit_status_household_missing');
  return status;
}

export async function fetchAiCreditStatus(
  householdId: string,
  functions: FunctionsInvoker = getSupabase().functions,
): Promise<AiCreditStatus> {
  if (householdId.trim().length === 0) throw new Error('ai_credit_status_household_missing');

  let result: { data: unknown; error: unknown };
  try {
    result = await functions.invoke('ai-credit-status', { body: {} });
  } catch {
    throw new Error('ai_credit_status_request_failed');
  }
  if (result.error) throw new Error('ai_credit_status_request_failed');
  return parseAiCreditStatusResponse(result.data, householdId);
}

export function useAiCreditStatus(householdId: string | null) {
  return useQuery({
    queryKey: aiCreditStatusQueryKey(householdId),
    queryFn: () => {
      if (householdId === null) throw new Error('ai_credit_status_household_missing');
      return fetchAiCreditStatus(householdId);
    },
    enabled: householdId !== null && householdId.trim().length > 0,
    networkMode: 'always',
  });
}
