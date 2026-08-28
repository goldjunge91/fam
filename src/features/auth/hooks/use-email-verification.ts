import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  confirmSignUpWithCode,
  resendConfirmationEmail,
  signIn,
  signOut,
} from '@/features/auth/api';
import { authErrorMessage } from '@/features/auth/domain/auth-error-message';
import { clearAuthDeepLinkError, subscribeAuthDeepLinkError } from '@/lib/auth-deep-link-state';
import { confirmationCodeSchema } from '@/lib/db/zod/auth.zod';
import { getSupabase } from '@/lib/supabase';

interface EmailVerificationOptions {
  email: string;
  password?: string;
  onConfirmed: () => void;
}

function isConfirmedSessionForEmail(session: Session | null, email: string): boolean {
  return Boolean(
    session?.user.email_confirmed_at &&
      session.user.email?.toLowerCase() === email.trim().toLowerCase(),
  );
}

export function useEmailVerification({ email, password, onConfirmed }: EmailVerificationOptions) {
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [resendFailed, setResendFailed] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const confirmedRef = useRef(false);
  const onConfirmedRef = useRef(onConfirmed);

  useEffect(() => {
    onConfirmedRef.current = onConfirmed;
  }, [onConfirmed]);

  const confirmOnce = useCallback(() => {
    if (confirmedRef.current) return;
    confirmedRef.current = true;
    onConfirmedRef.current();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((value) => value - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  useEffect(
    () =>
      subscribeAuthDeepLinkError((error) => {
        if (error) setCodeError(authErrorMessage(new Error(error)));
      }),
    [],
  );

  useEffect(() => {
    let active = true;
    const supabase = getSupabase();

    async function checkExistingSession() {
      try {
        const { data } = await supabase.auth.getSession();
        if (active && isConfirmedSessionForEmail(data.session, email)) confirmOnce();
      } catch {
        // Der Auth-State-Listener bleibt bei einem lokalen Lesefehler aktiv.
      }
    }

    void checkExistingSession();
    const interval = setInterval(checkExistingSession, 3000);
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active && isConfirmedSessionForEmail(session, email)) confirmOnce();
    });

    return () => {
      active = false;
      clearInterval(interval);
      subscription.subscription.unsubscribe();
    };
  }, [email, confirmOnce]);

  useEffect(() => {
    if (!password) return;
    const verificationPassword = password;
    let active = true;

    async function checkConfirmedOnServer() {
      try {
        const { data, error } = await signIn(email, verificationPassword);
        if (!active || error || !data.session) return;

        if (!data.session.user.email_confirmed_at) {
          await signOut();
          return;
        }

        confirmOnce();
      } catch {
        // Netzwerkaussetzer beim Polling sind kein sichtbarer Formularfehler.
      }
    }

    const interval = setInterval(checkConfirmedOnServer, 15_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [email, password, confirmOnce]);

  function setCodeInput(value: string) {
    setCode(value.replace(/\D/g, '').slice(0, 6));
    setCodeError(null);
  }

  async function confirmCode() {
    if (confirming) return;
    setCodeError(null);
    clearAuthDeepLinkError();

    const parsed = confirmationCodeSchema.safeParse({ code });
    if (!parsed.success) {
      setCodeError(parsed.error.issues[0]?.message ?? 'Ungültiger Code.');
      return;
    }

    setConfirming(true);
    try {
      const { data, error } = await confirmSignUpWithCode(email, parsed.data.code);
      if (error) {
        setCodeError(authErrorMessage(error) ?? 'Der Code konnte nicht geprüft werden.');
        return;
      }
      if (!data.session) {
        setCodeError('Der Code wurde akzeptiert, aber es kam keine Sitzung zurück.');
        return;
      }
      confirmOnce();
    } catch (error) {
      setCodeError(
        authErrorMessage(error instanceof Error ? error : new Error('Codeprüfung fehlgeschlagen.')),
      );
    } finally {
      setConfirming(false);
    }
  }

  async function checkConfirmation() {
    if (!password || recovering) return;
    setCodeError(null);
    setResendStatus(null);
    setRecovering(true);

    try {
      const { data, error } = await signIn(email, password);
      if (error) {
        setCodeError(authErrorMessage(error) ?? 'Anmeldung fehlgeschlagen.');
        return;
      }
      if (!data.session?.user.email_confirmed_at) {
        await signOut();
        setCodeError('Deine E-Mail-Adresse ist noch nicht bestätigt.');
        return;
      }

      clearAuthDeepLinkError();
      confirmOnce();
    } catch (error) {
      setCodeError(
        authErrorMessage(error instanceof Error ? error : new Error('Anmeldung fehlgeschlagen.')),
      );
    } finally {
      setRecovering(false);
    }
  }

  async function resendEmail() {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setResendStatus(null);
    setResendFailed(false);

    try {
      const { error } = await resendConfirmationEmail(email);
      if (error) {
        setResendFailed(true);
        setResendStatus(authErrorMessage(error) ?? 'Fehler beim Senden.');
        return;
      }

      setResendStatus(
        'Falls dein Konto noch nicht bestätigt ist, ist eine neue E-Mail unterwegs. ' +
          'Kommt nichts an, hast du den Link vermutlich schon benutzt — nutze dann den Button darunter.',
      );
      setCooldown(60);
    } catch (error) {
      setResendFailed(true);
      setResendStatus(
        authErrorMessage(error instanceof Error ? error : new Error('Fehler beim Senden.')),
      );
    } finally {
      setResending(false);
    }
  }

  return {
    code,
    codeError,
    confirming,
    recovering,
    resending,
    resendStatus,
    resendFailed,
    cooldown,
    setCodeInput,
    confirmCode,
    checkConfirmation,
    resendEmail,
  };
}
