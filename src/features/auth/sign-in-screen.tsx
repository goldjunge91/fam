import { Link } from 'expo-router';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { Screen } from '@/components/layout/screen';
import { ThemedText } from '@/components/theme/themed-text';
import { Card } from '@/components/ui/card';
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
            <ThemedText type="link">Noch kein Konto? Registrieren</ThemedText>
          </Link>

          <Link href="/forgot-password" asChild>
            <ThemedText type="link" themeColor="textSecondary">
              Passwort vergessen
            </ThemedText>
          </Link>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
