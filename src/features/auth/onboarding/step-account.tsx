import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { authErrorMessage, signIn, signInWithOAuthProvider, signUp } from '@/features/auth/api';
import { PendingAuthBanner } from '@/features/auth/components/pending-auth-banner';
import { useSession } from '@/features/auth/session-provider';
import { useTheme } from '@/hooks/use-theme';

export function StepAccount({ onNext }: { onNext: () => void }) {
  const { session } = useSession();
  const theme = useTheme();

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

    if (authMode === 'sign_up' && result.data?.session === null) {
      setPendingEmail(authEmail.trim());
      return;
    }

    onNext();
  }

  if (pendingEmail && !session) {
    return (
      <PendingAuthBanner
        email={pendingEmail}
        password={authPassword}
        onConfirmed={onNext}
        onChangeEmail={() => setPendingEmail(null)}
      />
    );
  }

  return (
    <Card title="Schritt 4: Account erstellen / Einloggen">
      {session ? (
        <View style={styles.form}>
          <ThemedText type="smallBold" themeColor="accent">
            ✓ Angemeldet als: {session.user.email}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Dein Account ist aktiv. Du kannst jetzt direkt zum nächsten Schritt wechseln.
          </ThemedText>
          <Button label="Weiter zu Schritt 5" onPress={onNext} />
        </View>
      ) : (
        <View style={styles.form}>
          <View style={styles.tabToggle}>
            <Pressable
              onPress={() => setAuthMode('sign_up')}
              style={[
                styles.tabButton,
                authMode === 'sign_up' && { backgroundColor: theme.accent },
              ]}>
              <ThemedText
                type="smallBold"
                style={authMode === 'sign_up' ? styles.choiceSelected : undefined}>
                Registrieren
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setAuthMode('sign_in')}
              style={[
                styles.tabButton,
                authMode === 'sign_in' && { backgroundColor: theme.accent },
              ]}>
              <ThemedText
                type="smallBold"
                style={authMode === 'sign_in' ? styles.choiceSelected : undefined}>
                Anmelden
              </ThemedText>
            </Pressable>
          </View>

          <TextField
            label="E-Mail Adresse"
            value={authEmail}
            onChangeText={setAuthEmail}
            placeholder="name@beispiel.de"
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextField
            label="Passwort"
            value={authPassword}
            onChangeText={setAuthPassword}
            placeholder="Dein Passwort"
            secureTextEntry
          />

          {authError ? (
            <ThemedText type="small" themeColor="danger">
              {authError}
            </ThemedText>
          ) : null}

          <Button
            label={authMode === 'sign_up' ? 'Konto erstellen & weiter' : 'Anmelden & weiter'}
            onPress={handleAuthSubmit}
            loading={authLoading}
          />

          <View style={styles.divider}>
            <ThemedText type="small" themeColor="textSecondary">
              oder weiter mit
            </ThemedText>
          </View>

          <Button
            label="  Mit Apple anmelden"
            variant="secondary"
            onPress={async () => {
              const { error } = await signInWithOAuthProvider('apple');
              if (error) setAuthError(authErrorMessage(error));
            }}
          />
          <Button
            label="🌐  Mit Google anmelden"
            variant="secondary"
            onPress={async () => {
              const { error } = await signInWithOAuthProvider('google');
              if (error) setAuthError(authErrorMessage(error));
            }}
          />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.three,
  },
  tabToggle: {
    flexDirection: 'row',
    borderRadius: Spacing.two,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ccc',
    marginBottom: Spacing.one,
  },
  tabButton: {
    flex: 1,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  choiceSelected: {
    color: '#ffffff',
  },
  divider: {
    alignItems: 'center',
    marginVertical: Spacing.one,
  },
});
