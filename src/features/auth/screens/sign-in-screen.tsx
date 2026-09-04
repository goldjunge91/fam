import { Link } from 'expo-router';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { Screen } from '@/components/layout/screen';
import { Card } from '@/components/ui/card';
import { Txt } from '@/constants/ui';
import { AuthProviderOptions } from '@/features/auth/components/auth-provider-options';
import { SignInForm } from '@/features/auth/forms/sign-in-form';

export function SignInScreen() {
  return (
    <Screen title="Anmelden" subtitle="Schön, dass du wieder da bist">
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
            <Txt variant="link" tone="accent">
              Noch kein Konto? Registrieren
            </Txt>
          </Link>

          <Link href="/forgot-password" asChild>
            <Txt variant="link" tone="secondary">
              Passwort vergessen
            </Txt>
          </Link>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
