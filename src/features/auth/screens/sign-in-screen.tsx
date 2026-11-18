import { Link, router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Screen } from '@/components/layout/screen';
import { Txt } from '@/constants/ui';
import { AuthFormCard } from '@/features/auth/components/auth-form-card';
import { useSession } from '@/features/auth/session-provider';

const styles = StyleSheet.create((theme) => ({
  links: {
    alignItems: 'center',
    gap: theme.space.sm,
    marginTop: theme.space.xxl,
  },
}));

export function SignInScreen() {
  const { t } = useTranslation();
  const { session } = useSession();
  const retryEntryWhenSessionReady = useRef(false);

  useEffect(() => {
    if (!session || !retryEntryWhenSessionReady.current) return;
    retryEntryWhenSessionReady.current = false;
    router.replace('/');
  }, [session]);

  function enterAppAfterSignIn() {
    // Der erste Replace kann noch gegen den ausgeloggten Route-Guard laufen.
    // Sobald der SessionProvider nachzieht, wiederholen wir den Einstieg genau einmal.
    retryEntryWhenSessionReady.current = !session;
    router.replace('/');
  }

  return (
    <Screen title={t('auth.signIn.title')}>
      <AuthFormCard mode="sign_in" onSuccess={enterAppAfterSignIn} />

      <View style={styles.links}>
        <Link href="/sign-up" asChild>
          <Txt variant="label" tone="accent">
            {t('auth.signIn.registerPrompt')}
          </Txt>
        </Link>

        <Link href="/forgot-password" asChild>
          <Txt variant="label" tone="secondary">
            {t('auth.signIn.forgotPassword')}
          </Txt>
        </Link>
      </View>
    </Screen>
  );
}
