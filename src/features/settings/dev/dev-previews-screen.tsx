import { Redirect, router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Screen } from '@/components/layout/screen';
import { ContentCard } from '@/components/ui/content-card';
import { Button } from '@/constants/ui';
import { useDevToolsAccess } from '@/hooks/use-dev-tools-access';

export function DevPreviewsScreen() {
  const { t } = useTranslation();
  const hasAccess = useDevToolsAccess();

  if (!hasAccess) {
    return <Redirect href="/settings" />;
  }

  return (
    <Screen
      title={t('dev.previews.title')}
      subtitle={t('dev.previews.subtitle')}
      back={{ label: t('dev.tools.title'), href: '/settings/dev' }}
      backStyle="icon">
      <ContentCard title={t('dev.previews.card')}>
        <Button
          title={t('dev.previews.designSystem')}
          variant="secondary"
          onPress={() => router.push('/settings/design-system')}
        />
        <Button
          title={t('dev.previews.drax')}
          variant="secondary"
          onPress={() => router.push('/settings/drax-demo')}
        />
        <Button
          title={t('dev.previews.auth')}
          variant="secondary"
          onPress={() => router.push('/settings/auth-preview')}
        />
        <Button
          title={t('dev.previews.receipt')}
          variant="secondary"
          onPress={() => router.push('/settings/dev/dummy-receipt-screen')}
        />
        <Button
          title={t('dev.previews.plusPaywall')}
          variant="secondary"
          onPress={() =>
            router.push({ pathname: '/settings/plus-and-ai', params: { tier: 'plus' } })
          }
        />
        <Button
          title={t('dev.previews.aiPaywall')}
          variant="secondary"
          onPress={() => router.push({ pathname: '/settings/plus-and-ai', params: { tier: 'ai' } })}
        />
      </ContentCard>
    </Screen>
  );
}
