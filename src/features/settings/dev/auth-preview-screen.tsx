import { Redirect, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Screen } from '@/components/layout/screen';
import { Button, Card, Txt } from '@/constants/ui';
import { useDevToolsAccess } from '@/hooks/use-dev-tools-access';

const AUTH_ROUTES = [
  {
    titleKey: 'dev.auth.routes.signIn.title',
    descriptionKey: 'dev.auth.routes.signIn.description',
    route: '/sign-in',
  },
  {
    titleKey: 'dev.auth.routes.signUp.title',
    descriptionKey: 'dev.auth.routes.signUp.description',
    route: '/sign-up',
  },
  {
    titleKey: 'dev.auth.routes.forgotPassword.title',
    descriptionKey: 'dev.auth.routes.forgotPassword.description',
    route: '/forgot-password',
  },
  {
    titleKey: 'dev.auth.routes.resetPassword.title',
    descriptionKey: 'dev.auth.routes.resetPassword.description',
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
  const { t } = useTranslation();
  const hasAccess = useDevToolsAccess();

  if (!hasAccess) {
    return <Redirect href="/settings" />;
  }

  return (
    <Screen
      title={t('dev.auth.title')}
      subtitle={t('dev.auth.subtitle')}
      back={{ label: t('dev.tools.title'), href: '/settings/dev' }}>
      <Card>
        <View style={styles.intro}>
          <Txt variant="body" weight="700">
            {t('dev.auth.cardTitle')}
          </Txt>
          <Txt variant="body" tone="secondary">
            {t('dev.auth.intro')}
          </Txt>
        </View>
      </Card>

      <View style={styles.actions}>
        {AUTH_ROUTES.map((item) => (
          <Button
            key={item.route}
            title={t(item.titleKey)}
            variant="secondary"
            onPress={() => router.push(item.route)}
            accessibilityLabel={`${t(item.titleKey)}: ${t(item.descriptionKey)}`}
          />
        ))}
      </View>
    </Screen>
  );
}
