import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { authErrorMessage, resendConfirmationEmail, signIn } from '@/features/auth/api';
import { useTheme } from '@/hooks/use-theme';
import { getSupabase } from '@/lib/supabase';

interface PendingAuthBannerProps {
  email: string;
  password?: string;
  onConfirmed: () => void;
  onChangeEmail?: () => void;
}

export function PendingAuthBanner({
  email,
  password,
  onConfirmed,
  onChangeEmail,
}: PendingAuthBannerProps) {
  const theme = useTheme();
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Pulse animations for Liquid Ring & Live Indicator
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.4)).current;
  const liveDotAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Liquid pulse ring animation
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

    // iOS Live Activity dot pulse
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

  // Cooldown timer for resend email
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Polling check every 3s to detect confirmation
  useEffect(() => {
    let active = true;

    async function checkAuthStatus() {
      try {
        const supabase = getSupabase();
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session) {
          if (active) onConfirmed();
          return;
        }

        if (password) {
          const { data: signInData, error } = await signIn(email, password);
          if (!error && signInData.session) {
            if (active) onConfirmed();
            return;
          }
        }
      } catch {
        // Silent catch during polling
      }
    }

    const interval = setInterval(checkAuthStatus, 3000);

    // Listen to Supabase auth state changes (e.g. via deep link redirect)
    const { data: sub } = getSupabase().auth.onAuthStateChange((_event, session) => {
      if (session && active) {
        onConfirmed();
      }
    });

    return () => {
      active = false;
      clearInterval(interval);
      sub.subscription.unsubscribe();
    };
  }, [email, password, onConfirmed]);

  async function handleResend() {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setResendStatus(null);

    const { error } = await resendConfirmationEmail(email);
    setResending(false);

    if (error) {
      setResendStatus(authErrorMessage(error) || 'Fehler beim Senden.');
    } else {
      setResendStatus('Bestätigungs-E-Mail erneut gesendet!');
      setCooldown(60);
    }
  }

  return (
    <View
      style={[
        styles.glassCard,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: theme.border,
        },
      ]}>
      {/* Liquid Pulse Hero Badge */}
      <View style={styles.heroContainer}>
        <Animated.View
          style={[
            styles.pulseRing,
            {
              backgroundColor: theme.accent,
              transform: [{ scale: pulseAnim }],
              opacity: pulseOpacity,
            },
          ]}
        />
        <View style={[styles.iconCircle, { backgroundColor: theme.accent }]}>
          <ThemedText style={styles.iconSymbol}>✉️</ThemedText>
        </View>
      </View>

      {/* Live Status Header */}
      <View style={styles.headerRow}>
        <Animated.View
          style={[styles.liveDot, { backgroundColor: '#F59E0B', opacity: liveDotAnim }]}
        />
        <ThemedText type="subtitle" style={styles.titleText}>
          Bestätigung ausstehend
        </ThemedText>
      </View>

      {/* Email Capsule Badge */}
      <View style={[styles.emailCapsule, { backgroundColor: theme.backgroundSelected }]}>
        <ThemedText type="smallBold" style={{ color: theme.accent }}>
          {email}
        </ThemedText>
      </View>

      {/* Description */}
      <ThemedText type="small" themeColor="textSecondary" style={styles.descriptionText}>
        Wir haben dir einen Bestätigungslink per E-Mail gesendet. Sobald du auf den Link klickst,
        loggt dich die App automatisch ein und geht von alleine weiter.
      </ThemedText>

      {resendStatus && (
        <ThemedText
          type="small"
          themeColor={
            resendStatus.includes('erfolgreich') || resendStatus.includes('gesendet')
              ? 'accent'
              : 'danger'
          }
          style={{ textAlign: 'center' }}>
          {resendStatus}
        </ThemedText>
      )}

      {/* Liquid Action Buttons */}
      <View style={styles.actions}>
        <Button
          label={
            cooldown > 0 ? `Erneut senden (${cooldown}s)` : 'Bestätigungs-E-Mail erneut senden'
          }
          variant="secondary"
          onPress={handleResend}
          loading={resending}
          disabled={cooldown > 0}
        />

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

const styles = StyleSheet.create({
  glassCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.three,
    alignItems: 'center',
  },
  heroContainer: {
    width: 64,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: Spacing.one,
  },
  pulseRing: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  iconSymbol: {
    fontSize: 22,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  titleText: {
    fontSize: 18,
    fontWeight: '700',
  },
  emailCapsule: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: 16,
  },
  descriptionText: {
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: Spacing.two,
  },
  actions: {
    width: '100%',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
});
