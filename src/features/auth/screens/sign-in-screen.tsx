import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { Screen } from '@/components/layout/screen';
import { Card } from '@/components/ui/card';
import { Txt } from '@/constants/ui';
import { AuthProviderOptions } from '@/features/auth/components/auth-provider-options';
import { SignInForm } from '@/features/auth/forms/sign-in-form';

export function SignInScreen() {
  const { t } = useTranslation();

  return (
    <Screen title={t('auth.signIn.title')} subtitle={t('auth.signIn.subtitle')}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Haupt-Anmeldeformular */}
        <Card>
          <View className="gap-three">
            <SignInForm />
            <AuthProviderOptions mode="sign_in" />
          </View>
        </Card>

        {/* Links zu Registrierung & Passwort vergessen */}
        <View className="link-stack">
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
      </KeyboardAvoidingView>
    </Screen>
  );
}
