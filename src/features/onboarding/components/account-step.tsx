import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { TextField } from '@/components/forms/text-field';
import { Button } from '@/components/ui/buttons';
import { authErrorMessage, signIn, signUp } from '@/features/auth/api';
import { PendingAuthBanner } from '@/features/auth/components/pending-auth-banner';
import { useSession } from '@/features/auth/session-provider';

interface AccountStepFormProps {
  onNext: () => void;
}

export function AccountStepForm({ onNext }: AccountStepFormProps) {
  const { session } = useSession();

  const [authMode, setAuthMode] = useState<'sign_up' | 'sign_in'>('sign_up');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  async function handleAuthSubmit() {
    if (authLoading) return;
    setAuthError(null);
    if (!authEmail.trim() || !authPassword) {
      setAuthError('Bitte E-Mail und Passwort eingeben.');
      return;
    }

    setAuthLoading(true);
    const result =
      authMode === 'sign_up'
        ? await signUp(authEmail.trim(), authPassword)
        : await signIn(authEmail.trim(), authPassword);
    setAuthLoading(false);

    if (result.error) {
      setAuthError(authErrorMessage(result.error));
      return;
    }

    // Ist E-Mail-Bestaetigung aktiv, kommt ein User ohne Session zurueck.
    // Dann muss die App im Warteraum (PendingAuthBanner) auf die Bestaetigung warten.
    if (authMode === 'sign_up' && !result.data?.session) {
      setPendingEmail(authEmail.trim());
      return;
    }

    onNext();
  }

  if (pendingEmail) {
    return (
      <View className="gap-three">
        <PendingAuthBanner
          email={pendingEmail}
          password={authPassword}
          onConfirmed={onNext}
          onChangeEmail={() => setPendingEmail(null)}
        />
      </View>
    );
  }

  return (
    <View className="gap-three">
      <Text className="perm-heading">Dein Account</Text>
      <Text className="perm-subheading">
        Erstelle ein Konto oder melde dich an, um deine Daten zu synchronisieren.
      </Text>

      {session ? (
        <View className="account-active-container">
          <View className="account-active-banner">
            <Text className="account-active-title">✓ Angemeldet als: {session.user.email}</Text>
            <Text className="perm-desc">
              Dein Account ist aktiv. Du kannst jetzt direkt zum nächsten Schritt wechseln.
            </Text>
          </View>

          <Button label="Weiter" onPress={onNext} />
        </View>
      ) : (
        <View className="account-form">
          <View className="account-tab-toggle">
            <Pressable
              onPress={() => setAuthMode('sign_up')}
              className={`account-tab-button ${authMode === 'sign_up' ? 'account-tab-button-active' : ''}`}>
              <Text
                className={`account-tab-text ${authMode === 'sign_up' ? 'text-on-accent' : 'text-text'}`}>
                Registrieren
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setAuthMode('sign_in')}
              className={`account-tab-button ${authMode === 'sign_in' ? 'account-tab-button-active' : ''}`}>
              <Text
                className={`account-tab-text ${authMode === 'sign_in' ? 'text-on-accent' : 'text-text'}`}>
                Anmelden
              </Text>
            </Pressable>
          </View>

          <TextField
            testID="onboarding-account-email"
            label="E-Mail Adresse"
            value={authEmail}
            onChangeText={setAuthEmail}
            placeholder="name@beispiel.de"
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextField
            testID="onboarding-account-password"
            label="Passwort"
            value={authPassword}
            onChangeText={setAuthPassword}
            placeholder="Dein Passwort"
            secureTextEntry
          />

          {authError && <Text className="account-error-text">{authError}</Text>}

          <Button
            label={authMode === 'sign_up' ? 'Konto erstellen & weiter' : 'Anmelden & weiter'}
            onPress={handleAuthSubmit}
            loading={authLoading}
          />
        </View>
      )}
    </View>
  );
}
