import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { TextField } from '@/components/forms/text-field';
import { ThemedText } from '@/components/theme/themed-text';
import { Button } from '@/components/ui/buttons';
import {
  authErrorMessage,
  confirmSignUpWithCode,
  resendConfirmationEmail,
  signIn,
  signOut,
} from '@/features/auth/api';
import { confirmationCodeSchema } from '@/features/auth/auth-schemas';
import { clearAuthDeepLinkError, subscribeAuthDeepLinkError } from '@/lib/auth-deep-link-state';
import { getSupabase } from '@/lib/supabase';

interface PendingAuthBannerProps {
  email: string;
  onConfirmed: () => void;
  onChangeEmail?: () => void;
  /** Nur im Speicher fuer die Wiederanmeldung nach bereits bestaetigtem Link. */
  password?: string;
}

export function PendingAuthBanner({
  email,
  onConfirmed,
  onChangeEmail,
  password,
}: PendingAuthBannerProps) {
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [resendFailed, setResendFailed] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [recovering, setRecovering] = useState(false);

  // Mehrere Bestaetigungswege koennen gleichzeitig feuern; der Wizard darf nur einmal wechseln.
  const confirmedRef = useRef(false);
  const onConfirmedRef = useRef(onConfirmed);
  useEffect(() => {
    onConfirmedRef.current = onConfirmed;
  });
  const confirmOnce = useCallback(() => {
    if (confirmedRef.current) return;
    confirmedRef.current = true;
    onConfirmedRef.current();
  }, []);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.4)).current;
  const liveDotAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const ringAnimation = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 1800,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1800,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(pulseOpacity, {
            toValue: 0.15,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0.4,
            duration: 1800,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );

    const dotAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(liveDotAnim, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(liveDotAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    );

    ringAnimation.start();
    dotAnimation.start();

    return () => {
      ringAnimation.stop();
      dotAnimation.stop();
    };
  }, [pulseAnim, pulseOpacity, liveDotAnim]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Deep-Link-Fehler erscheinen am Code-Feld, wo der Nutzer fortfahren kann.
  useEffect(() => {
    return subscribeAuthDeepLinkError((error) => {
      if (error) setCodeError(authErrorMessage(new Error(error)));
    });
  }, []);

  // Der Poll faengt Redirects ab, die die App im Hintergrund erreichen.
  useEffect(() => {
    let active = true;

    async function checkExistingSession() {
      try {
        const { data } = await getSupabase().auth.getSession();
        if (data.session && active) confirmOnce();
      } catch {}
    }

    const interval = setInterval(checkExistingSession, 3000);

    const { data: sub } = getSupabase().auth.onAuthStateChange((_event, session) => {
      if (session && active) {
        confirmOnce();
      }
    });

    return () => {
      active = false;
      clearInterval(interval);
      sub.subscription.unsubscribe();
    };
  }, [confirmOnce]);

  // Erkennt Bestaetigungen auf anderen Geraeten; 15 s laesst Reserve im IP-Rate-Limit.
  useEffect(() => {
    if (!password) return;
    let active = true;

    async function checkConfirmedOnServer() {
      try {
        const { data, error } = await signIn(email, password as string);
        if (!active || error || !data.session) return;

        if (!data.session.user.email_confirmed_at) {
          await signOut();
          return;
        }

        confirmOnce();
      } catch {}
    }

    const interval = setInterval(checkConfirmedOnServer, 15_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [email, password, confirmOnce]);

  async function handleConfirmCode() {
    if (confirming) return;
    setCodeError(null);
    clearAuthDeepLinkError();

    const parsed = confirmationCodeSchema.safeParse({ code });
    if (!parsed.success) {
      setCodeError(parsed.error.issues[0]?.message ?? 'Ungültiger Code.');
      return;
    }

    setConfirming(true);
    const { data, error } = await confirmSignUpWithCode(email, parsed.data.code);
    setConfirming(false);

    if (error) {
      setCodeError(authErrorMessage(error) || 'Der Code konnte nicht geprüft werden.');
      return;
    }
    if (!data.session) {
      setCodeError('Der Code wurde akzeptiert, aber es kam keine Sitzung zurück.');
      return;
    }

    confirmOnce();
  }

  /** Stellt nach bereits eingeloestem Link nur eine bestaetigte Session wieder her. */
  async function handleAlreadyConfirmed() {
    if (!password || recovering) return;
    setCodeError(null);
    setResendStatus(null);
    setRecovering(true);

    const { data, error } = await signIn(email, password);

    if (error) {
      setRecovering(false);
      setCodeError(authErrorMessage(error) || 'Anmeldung fehlgeschlagen.');
      return;
    }

    if (!data.session?.user.email_confirmed_at) {
      // Niemals eine Session ohne bestaetigte E-Mail uebernehmen.
      await signOut();
      setRecovering(false);
      setCodeError('Deine E-Mail-Adresse ist noch nicht bestätigt.');
      return;
    }

    setRecovering(false);
    clearAuthDeepLinkError();
    confirmOnce();
  }

  async function handleResend() {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setResendStatus(null);
    setResendFailed(false);

    const { error } = await resendConfirmationEmail(email);
    setResending(false);

    if (error) {
      setResendFailed(true);
      setResendStatus(authErrorMessage(error) || 'Fehler beim Senden.');
      return;
    }

    // Supabase bestaetigt den Versand auch dann, wenn keine Mail gesendet wird.
    setResendStatus(
      'Falls dein Konto noch nicht bestätigt ist, ist eine neue E-Mail unterwegs. ' +
        'Kommt nichts an, hast du den Link vermutlich schon benutzt — nutze dann den Button darunter.',
    );
    setCooldown(60);
  }

  return (
    <View className="pending-card">
      <View className="hero-container">
        {/* Animated.Value kann nicht ueber className gesetzt werden. */}
        <Animated.View
          className="pulse-ring"
          style={{ transform: [{ scale: pulseAnim }], opacity: pulseOpacity }}
        />
        <View className="icon-circle">
          <ThemedText type="controlActionLarge">✉️</ThemedText>
        </View>
      </View>

      <View className="row-center">
        <Animated.View className="live-dot" style={{ opacity: liveDotAnim }} />
        <ThemedText className="pending-title">Bestätigung ausstehend</ThemedText>
      </View>

      <View className="email-capsule">
        <ThemedText type="smallBold" themeColor="accent">
          {email}
        </ThemedText>
      </View>

      <ThemedText type="smallMuted" className="pending-description">
        Wir haben dir eine E-Mail geschickt. Klick den Link darin — egal auf welchem Gerät, die App
        merkt das von selbst und geht weiter. Oder gib den 6-stelligen Code aus der E-Mail hier ein.
      </ThemedText>

      <View className="code-block">
        <TextField
          testID="pending-auth-code"
          label="Code aus der E-Mail"
          value={code}
          onChangeText={(next) => {
            setCode(next.replace(/\D/g, '').slice(0, 6));
            setCodeError(null);
          }}
          error={codeError ?? undefined}
          placeholder="123456"
          keyboardType="number-pad"
          maxLength={6}
          autoComplete="sms-otp"
          textContentType="oneTimeCode"
          returnKeyType="go"
          onSubmitEditing={handleConfirmCode}
          className="code-input"
        />

        <Button
          label="Bestätigen"
          onPress={handleConfirmCode}
          loading={confirming}
          disabled={code.length !== 6}
        />
      </View>

      {resendStatus && (
        <ThemedText type={resendFailed ? 'smallDanger' : 'smallMuted'} className="text-center">
          {resendStatus}
        </ThemedText>
      )}

      <View className="action-list">
        <Button
          label={
            cooldown > 0 ? `Erneut senden (${cooldown}s)` : 'Bestätigungs-E-Mail erneut senden'
          }
          variant="secondary"
          onPress={handleResend}
          loading={resending}
          disabled={cooldown > 0}
        />

        {password && (
          <Button
            label="Jetzt prüfen"
            variant="secondary"
            onPress={handleAlreadyConfirmed}
            loading={recovering}
          />
        )}

        {onChangeEmail && (
          <Button
            label="Andere E-Mail-Adresse verwenden"
            variant="secondary"
            onPress={onChangeEmail}
          />
        )}
      </View>
    </View>
  );
}
