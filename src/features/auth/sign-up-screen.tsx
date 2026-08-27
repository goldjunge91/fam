import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { Screen } from '@/components/layout/screen';
import { ThemedText } from '@/components/theme/themed-text';
import { Button } from '@/components/ui/buttons';
import { Card } from '@/components/ui/card';
import { AuthProviderOptions } from '@/features/auth/components/auth-provider-options';
import { PendingAuthBanner } from '@/features/auth/components/pending-auth-banner';
import { type PendingSignUp, SignUpForm } from '@/features/auth/forms/sign-up-form';

export function SignUpScreen() {
  const [pendingSignUp, setPendingSignUp] = useState<PendingSignUp | null>(null);

  if (pendingSignUp) {
    return (
      <Screen
        title="Konto aktivieren"
        subtitle="E-Mail-Bestätigung ausstehend"
        back={{ label: 'Anmelden', href: '/sign-in' }}>
        {/* Banner/Hinweis für ausstehende E-Mail-Bestätigung */}
        <PendingAuthBanner
          email={pendingSignUp.email}
          password={pendingSignUp.password}
          onConfirmed={() => router.replace('/onboarding')}
          onChangeEmail={() => setPendingSignUp(null)}
        />
      </Screen>
    );
  }

  return (
    <Screen
      title="Konto erstellen"
      subtitle="Für dich und deinen Haushalt"
      back={{ label: 'Anmelden', href: '/sign-in' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Haupt-Registrierungsformular */}
        <Card>
          <View className="gap-three">
            <SignUpForm
              onSuccess={() => router.replace('/onboarding')}
              onPendingVerification={setPendingSignUp}
            />
            <AuthProviderOptions mode="sign_up" />

            {/* Datenschutz- & Haushalts-Hinweis */}
            <ThemedText type="smallMuted">
              Vorrat und Einkaufsliste teilst du später mit deinem Haushalt. Kalorien, Gewicht und
              Ziele bleiben privat.
            </ThemedText>
          </View>
        </Card>

        {/* Wechsel zur Anmeldung */}
        <Button
          label="Ich habe schon ein Konto"
          variant="secondary"
          onPress={() => router.replace('/sign-in')}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}
