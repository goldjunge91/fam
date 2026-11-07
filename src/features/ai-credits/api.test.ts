import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { createElement, type ReactNode } from 'react';

import {
  aiCreditStatusQueryKey,
  fetchAiCreditStatus,
  parseAiCreditStatusResponse,
  useAiCreditStatus,
} from './api';

const mockGetSupabase = jest.fn();
jest.mock('@/lib/backend/supabase/remote-client', () => ({
  getSupabase: (...args: unknown[]) => mockGetSupabase(...args),
}));

const HOUSEHOLD_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_HOUSEHOLD_ID = '22222222-2222-4222-8222-222222222222';

const status = {
  householdId: HOUSEHOLD_ID,
  creditsUsed: 30,
  creditsRemaining: 70,
  creditLimit: 100 as const,
  warningReached: false,
  blocked: false,
};

function invoker(
  data: unknown = { households: [status], requestId: 'request-1' },
  error: unknown = null,
) {
  return { invoke: jest.fn().mockResolvedValue({ data, error }) };
}

describe('AI credit status query', () => {
  it('maps the server status and sends no household selector to the function', async () => {
    const functions = invoker();

    await expect(fetchAiCreditStatus(HOUSEHOLD_ID, functions)).resolves.toEqual(status);
    expect(functions.invoke).toHaveBeenCalledWith('ai-credit-status', { body: {} });
  });

  it('keeps the fixed 100-credit response and selects the requested household', () => {
    expect(
      parseAiCreditStatusResponse(
        {
          requestId: 'request-2',
          households: [status, { ...status, householdId: OTHER_HOUSEHOLD_ID }],
        },
        OTHER_HOUSEHOLD_ID,
      ),
    ).toEqual({ ...status, householdId: OTHER_HOUSEHOLD_ID });
  });

  it('does not invent a status when the server response is malformed or missing', async () => {
    await expect(
      fetchAiCreditStatus(HOUSEHOLD_ID, invoker({ households: [], requestId: 'request-3' })),
    ).rejects.toThrow('ai_credit_status_household_missing');
    await expect(
      fetchAiCreditStatus(
        HOUSEHOLD_ID,
        invoker({
          requestId: 'request-4',
          households: [{ ...status, creditLimit: 0 }],
        }),
      ),
    ).rejects.toThrow('ai_credit_status_invalid_response');
  });

  it('forwards function failures as a query error', async () => {
    await expect(
      fetchAiCreditStatus(HOUSEHOLD_ID, invoker(null, new Error('network'))),
    ).rejects.toThrow('ai_credit_status_request_failed');
  });

  it('disables the query without an active household and loads by household key otherwise', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
    });
    function Wrapper({ children }: { children: ReactNode }) {
      return createElement(QueryClientProvider, { client: queryClient }, children);
    }

    const disabled = await renderHook(() => useAiCreditStatus(null), { wrapper: Wrapper });
    expect(disabled.result.current.fetchStatus).toBe('idle');

    const functions = invoker();
    mockGetSupabase.mockReturnValue({ functions });
    const loaded = await renderHook(() => useAiCreditStatus(HOUSEHOLD_ID), { wrapper: Wrapper });
    await waitFor(() => expect(loaded.result.current.data?.creditsRemaining).toBe(70));
    expect(queryClient.getQueryData(aiCreditStatusQueryKey(HOUSEHOLD_ID))).toEqual(status);
    await disabled.unmount();
    await loaded.unmount();
    queryClient.clear();
  });
});
