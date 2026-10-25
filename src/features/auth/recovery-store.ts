import type { AuthError } from '@supabase/supabase-js';
import { create } from 'zustand';
import {
  discardPasswordRecoverySession,
  getPrimarySessionUserId,
  requestPasswordReset,
  transferPasswordRecoverySession,
  updatePasswordWithRecoveryClient,
  verifyPasswordRecoveryCode,
} from '@/features/auth/api';
import type { AuthDeepLinkTokens } from '@/features/auth/domain/auth-deep-link';
import {
  createPasswordRecoveryClient,
  type TypedSupabaseClient,
} from '@/lib/backend/supabase/remote-client';
import { confirmationCodeSchema, emailSchema, newPasswordValueSchema } from '@/lib/db/zod/auth.zod';

const RESEND_COOLDOWN_MS = 60_000;

type RecoveryPhase = 'entry' | 'legacy-verifying' | 'verified' | 'updated' | 'sign-in-required';
type RecoveryOperation = 'sending' | 'verifying' | 'saving' | null;
type RecoveryOutcome = 'signed-in' | 'existing-session' | 'sign-in-required';

type RecoveryActionResult =
  | { status: 'ok'; outcome?: RecoveryOutcome }
  | { status: 'busy' | 'cancelled' | 'missing-session' }
  | { status: 'error'; error: AuthError | Error };

interface RecoveryState {
  phase: RecoveryPhase;
  email: string;
  code: string;
  legacyLinkFailed: boolean;
  operation: RecoveryOperation;
  cooldownUntil: number | null;
  recoveryClient: TypedSupabaseClient | null;
  primaryUserId: string | null | undefined;
  recoveryUserId: string | null;
  outcome: RecoveryOutcome | null;
  generation: number;
  setEmail: (email: string) => void;
  setCode: (code: string) => void;
  markLegacyRecoveryLinkFailed: () => void;
  requestCode: (email?: string) => Promise<RecoveryActionResult>;
  verifyCode: () => Promise<RecoveryActionResult>;
  savePassword: (password: string) => Promise<RecoveryActionResult>;
  openLegacyRecoveryLink: (tokens: AuthDeepLinkTokens) => Promise<'opened' | 'failed' | 'ignored'>;
  changeEmail: () => Promise<boolean>;
  cancel: () => Promise<boolean>;
}

function initialState(
  generation = 0,
): Pick<
  RecoveryState,
  | 'phase'
  | 'email'
  | 'code'
  | 'legacyLinkFailed'
  | 'operation'
  | 'cooldownUntil'
  | 'recoveryClient'
  | 'primaryUserId'
  | 'recoveryUserId'
  | 'outcome'
  | 'generation'
> {
  return {
    phase: 'entry',
    email: '',
    code: '',
    legacyLinkFailed: false,
    operation: null,
    cooldownUntil: null,
    recoveryClient: null,
    primaryUserId: undefined,
    recoveryUserId: null,
    outcome: null,
    generation,
  };
}

function asError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = error.message;
    if (typeof message === 'string') return new Error(message);
  }
  return new Error('Recovery request failed');
}

function isCurrent(generation: number): boolean {
  return usePasswordRecoveryStore.getState().generation === generation;
}

async function capturePrimaryUserId(): Promise<string | null | undefined> {
  try {
    return await getPrimarySessionUserId();
  } catch {
    return undefined;
  }
}

async function discard(client: TypedSupabaseClient | null): Promise<void> {
  if (!client) return;
  try {
    await discardPasswordRecoverySession(client);
  } catch {
    // The client is non-persistent; dropping its reference still clears local app state.
  }
}

export const usePasswordRecoveryStore = create<RecoveryState>((set, get) => ({
  ...initialState(),
  setEmail: (email) =>
    set((state) => {
      if (state.operation || state.phase !== 'entry') return state;
      if (state.email === email) return state;
      return { email, code: '', cooldownUntil: null };
    }),
  setCode: (code) => set({ code: code.replace(/\D/g, '').slice(0, 6) }),
  markLegacyRecoveryLinkFailed: () => set({ legacyLinkFailed: true }),

  requestCode: async (inputEmail) => {
    const current = get();
    if (current.operation) return { status: 'busy' };
    if (current.phase !== 'entry') return { status: 'busy' };

    const parsedEmail = emailSchema.safeParse(inputEmail ?? current.email);
    if (!parsedEmail.success) {
      return {
        status: 'error',
        error: new Error(parsedEmail.error.issues[0]?.message ?? 'Invalid email'),
      };
    }
    if (
      current.cooldownUntil &&
      current.cooldownUntil > Date.now() &&
      parsedEmail.data === current.email
    ) {
      return { status: 'busy' };
    }

    const generation = current.generation + 1;
    set({
      operation: 'sending',
      generation,
      email: parsedEmail.data,
      code: '',
      legacyLinkFailed: false,
    });

    const primaryUserId = current.primaryUserId ?? (await capturePrimaryUserId());
    if (!isCurrent(generation)) return { status: 'cancelled' };
    set({ primaryUserId });

    try {
      const { error } = await requestPasswordReset(parsedEmail.data);
      if (!isCurrent(generation)) return { status: 'cancelled' };
      if (error) {
        set({ operation: null });
        return { status: 'error', error };
      }

      set({ operation: null, cooldownUntil: Date.now() + RESEND_COOLDOWN_MS });
      return { status: 'ok' };
    } catch (error) {
      if (!isCurrent(generation)) return { status: 'cancelled' };
      set({ operation: null });
      return { status: 'error', error: asError(error) };
    }
  },

  verifyCode: async () => {
    const current = get();
    if (current.operation) return { status: 'busy' };
    if (current.phase !== 'entry') return { status: 'busy' };

    const parsedEmail = emailSchema.safeParse(current.email);
    const parsedCode = confirmationCodeSchema.safeParse({ code: current.code });
    if (!parsedEmail.success) {
      return {
        status: 'error',
        error: new Error(parsedEmail.error.issues[0]?.message ?? 'Invalid email'),
      };
    }
    if (!parsedCode.success) {
      return {
        status: 'error',
        error: new Error(parsedCode.error.issues[0]?.message ?? 'Invalid code'),
      };
    }

    const generation = current.generation + 1;
    set({
      operation: 'verifying',
      generation,
      email: parsedEmail.data,
      code: parsedCode.data.code,
      legacyLinkFailed: false,
    });

    const primaryUserId = current.primaryUserId ?? (await capturePrimaryUserId());
    if (!isCurrent(generation)) return { status: 'cancelled' };
    set({ primaryUserId });

    let client: TypedSupabaseClient | null = null;
    try {
      client = createPasswordRecoveryClient();
      const { data, error } = await verifyPasswordRecoveryCode(
        client,
        parsedEmail.data,
        parsedCode.data.code,
      );
      if (!isCurrent(generation)) {
        await discard(client);
        return { status: 'cancelled' };
      }
      if (error) {
        await discard(client);
        if (!isCurrent(generation)) return { status: 'cancelled' };
        set({ operation: null });
        return { status: 'error', error };
      }
      if (!data.session) {
        await discard(client);
        if (!isCurrent(generation)) return { status: 'cancelled' };
        set({ operation: null });
        return { status: 'missing-session' };
      }

      set({
        operation: null,
        phase: 'verified',
        recoveryClient: client,
        recoveryUserId: data.session.user.id,
        cooldownUntil: null,
        legacyLinkFailed: false,
      });
      return { status: 'ok' };
    } catch (error) {
      await discard(client);
      if (!isCurrent(generation)) return { status: 'cancelled' };
      set({ operation: null });
      return { status: 'error', error: asError(error) };
    }
  },

  savePassword: async (password) => {
    const current = get();
    if (current.operation) return { status: 'busy' };
    if (current.phase !== 'verified' || !current.recoveryClient) {
      return { status: 'missing-session' };
    }
    const parsedPassword = newPasswordValueSchema.safeParse(password);
    if (!parsedPassword.success) {
      return {
        status: 'error',
        error: new Error(parsedPassword.error.issues[0]?.message ?? 'Invalid password'),
      };
    }

    const generation = current.generation + 1;
    const client = current.recoveryClient;
    set({ operation: 'saving', generation });

    try {
      const { error } = await updatePasswordWithRecoveryClient(client, parsedPassword.data);
      if (!isCurrent(generation)) {
        await discard(client);
        return { status: 'cancelled' };
      }
      if (error) {
        set({ operation: null });
        return { status: 'error', error };
      }

      let transfer:
        | 'transferred'
        | 'primary-session-preserved'
        | 'sign-in-required'
        | 'transfer-uncertain';
      try {
        transfer =
          current.primaryUserId === undefined
            ? 'sign-in-required'
            : await transferPasswordRecoverySession(client, current.primaryUserId);
      } catch {
        transfer = 'transfer-uncertain';
      }
      if (!isCurrent(generation)) {
        if (transfer !== 'transferred' && transfer !== 'transfer-uncertain') await discard(client);
        return { status: 'cancelled' };
      }

      if (transfer === 'primary-session-preserved' || transfer === 'sign-in-required') {
        await discard(client);
      }

      const outcome: RecoveryOutcome =
        transfer === 'transferred'
          ? 'signed-in'
          : transfer === 'primary-session-preserved'
            ? 'existing-session'
            : 'sign-in-required';
      set({
        phase:
          transfer === 'sign-in-required' || transfer === 'transfer-uncertain'
            ? 'sign-in-required'
            : 'updated',
        operation: null,
        recoveryClient: null,
        recoveryUserId: null,
        code: '',
        cooldownUntil: null,
        outcome,
      });
      return { status: 'ok', outcome };
    } catch (error) {
      if (!isCurrent(generation)) {
        await discard(client);
        return { status: 'cancelled' };
      }
      set({ operation: null });
      return { status: 'error', error: asError(error) };
    }
  },

  changeEmail: async () => {
    const current = get();
    if (current.operation === 'saving') return false;
    const generation = current.generation + 1;
    set({
      phase: 'entry',
      code: '',
      operation: null,
      recoveryClient: null,
      recoveryUserId: null,
      cooldownUntil: null,
      outcome: null,
      legacyLinkFailed: false,
      generation,
    });
    await discard(current.recoveryClient);
    return true;
  },

  openLegacyRecoveryLink: async (tokens) => {
    const current = get();
    if (
      current.operation ||
      current.phase !== 'entry' ||
      current.email.trim() !== '' ||
      current.code !== ''
    ) {
      return 'ignored';
    }

    const generation = current.generation + 1;
    set({ phase: 'legacy-verifying', operation: 'verifying', generation });
    const primaryUserId = current.primaryUserId ?? (await capturePrimaryUserId());
    if (!isCurrent(generation)) return 'ignored';
    set({ primaryUserId });

    let client: TypedSupabaseClient | null = null;
    try {
      client = createPasswordRecoveryClient();
      const { data, error } = await client.auth.setSession({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      });
      if (!isCurrent(generation)) {
        await discard(client);
        return 'ignored';
      }
      if (error || !data.session) {
        await discard(client);
        if (!isCurrent(generation)) return 'ignored';
        set({ phase: 'entry', operation: null, legacyLinkFailed: true });
        return 'failed';
      }

      set({
        phase: 'verified',
        operation: null,
        recoveryClient: client,
        recoveryUserId: data.session.user.id,
        legacyLinkFailed: false,
      });
      return 'opened';
    } catch {
      await discard(client);
      if (!isCurrent(generation)) return 'ignored';
      set({ phase: 'entry', operation: null, legacyLinkFailed: true });
      return 'failed';
    }
  },

  cancel: async () => {
    const current = get();
    if (current.operation === 'saving') return false;
    const generation = current.generation + 1;
    set({ ...initialState(generation) });
    await discard(current.recoveryClient);
    return true;
  },
}));
