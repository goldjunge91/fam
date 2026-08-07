import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { Spacing } from '@/constants/theme';
import { authErrorMessage, signIn, signUp } from '@/features/auth/api';
import { useSession } from '@/features/auth/session-provider';
import { useTheme } from '@/hooks/use-theme';

interface AccountStepFormProps {
  onNext: () => void;
}

export function AccountStepForm({ onNext }: AccountStepFormProps) {
  const { session } = useSession();
  const theme = useTheme();

  const [authMode, setAuthMode] = useState<'sign_up' | 'sign_in'>('sign_up');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

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

    onNext();
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.heading, { color: theme.text }]}>Dein Account</Text>
      <Text style={[styles.subheading, { color: theme.textSecondary }]}>
        Erstelle ein Konto oder melde dich an, um deine Daten zu synchronisieren.
      </Text>

      {session ? (
        <View style={styles.activeContainer}>
          <View
            style={[
              styles.activeBanner,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}>
            <Text style={[styles.activeTitle, { color: theme.accent }]}>
              ✓ Angemeldet als: {session.user.email}
            </Text>
            <Text style={[styles.activeDesc, { color: theme.textSecondary }]}>
              Dein Account ist aktiv. Du kannst jetzt direkt zum nächsten Schritt wechseln.
            </Text>
          </View>

          <Button label="Weiter" onPress={onNext} />
        </View>
      ) : (
        <View style={styles.form}>
          <View style={[styles.tabToggle, { borderColor: theme.border }]}>
            <Pressable
              onPress={() => setAuthMode('sign_up')}
              style={[
                styles.tabButton,
                authMode === 'sign_up' && { backgroundColor: theme.accent },
              ]}>
              <Text
                style={[
                  styles.tabText,
                  { color: authMode === 'sign_up' ? '#ffffff' : theme.text },
                ]}>
                Registrieren
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setAuthMode('sign_in')}
              style={[
                styles.tabButton,
                authMode === 'sign_in' && { backgroundColor: theme.accent },
              ]}>
              <Text
                style={[
                  styles.tabText,
                  { color: authMode === 'sign_in' ? '#ffffff' : theme.text },
                ]}>
                Anmelden
              </Text>
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

          {authError && <Text style={{ color: theme.danger, fontSize: 13 }}>{authError}</Text>}

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

const styles = StyleSheet.create({
  container: {
    gap: Spacing.three,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
  },
  subheading: {
    fontSize: 14,
    lineHeight: 20,
  },
  activeContainer: {
    gap: Spacing.four,
    marginTop: Spacing.two,
  },
  activeBanner: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
    gap: Spacing.one,
  },
  activeTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  activeDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  form: {
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  tabToggle: {
    flexDirection: 'row',
    borderRadius: Spacing.two,
    overflow: 'hidden',
    borderWidth: 1,
    marginBottom: Spacing.one,
  },
  tabButton: {
    flex: 1,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
