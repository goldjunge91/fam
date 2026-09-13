import { router } from 'expo-router';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Screen } from '@/components/layout/screen';
import { Button, Card, Txt } from '@/constants/ui';

const AUTH_ROUTES = [
  {
    title: 'Anmeldung öffnen',
    description: 'Sign-in-Formular, OAuth und Passwort-Link testen',
    route: '/sign-in',
  },
  {
    title: 'Registrierung öffnen',
    description: 'Sign-up-Formular und E-Mail-Bestätigung testen',
    route: '/sign-up',
  },
  {
    title: 'Passwort-Link anfordern',
    description: 'E-Mail-Eingabe und Fehlerzustände testen',
    route: '/forgot-password',
  },
  {
    title: 'Neues Passwort setzen',
    description: 'Passwort- und Bestätigungsfeld testen',
    route: '/reset-password',
  },
] as const;

const styles = StyleSheet.create((theme) => ({
  intro: {
    gap: theme.space.sm,
  },
  actions: {
    gap: theme.space.sm,
  },
}));

/** Developer entry point for exercising the real authentication routes. */
export function AuthPreviewScreen() {
  return (
    <Screen
      title="Auth testen"
      subtitle="Echte Auth-Routen im Dev-Build"
      back={{ label: 'Entwickler', href: '/settings/dev' }}>
      <Card>
        <View style={styles.intro}>
          <Txt variant="body" weight="700">
            Auth-Seiten
          </Txt>
          <Txt variant="body" tone="secondary">
            Öffne einen echten Screen und teste Eingabe, Fokus, Fehler, Loading und Navigation.
          </Txt>
        </View>
      </Card>

      <View style={styles.actions}>
        {AUTH_ROUTES.map((item) => (
          <Button
            key={item.route}
            title={item.title}
            variant="secondary"
            onPress={() => router.push(item.route)}
            accessibilityLabel={`${item.title}: ${item.description}`}
          />
        ))}
      </View>
    </Screen>
  );
}
