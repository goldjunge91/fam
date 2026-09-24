import { Link, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Screen } from '@/components/layout/screen';
import { Txt } from '@/constants/ui';
import { AuthFormCard } from '@/features/auth/components/auth-form-card';

const styles = StyleSheet.create((theme) => ({
  links: {
    alignItems: 'center',
    gap: theme.space.sm,
    marginTop: theme.space.xl + theme.space.xs,
  },
}));

export function SignInScreen() {
  const { t } = useTranslation();

  return (
    <Screen title={t('auth.signIn.title')}>
      <AuthFormCard mode="sign_in" onSuccess={() => router.replace('/')} />

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
