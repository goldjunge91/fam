import { useTranslation } from 'react-i18next';

import { Screen } from '@/components/layout/screen';
import { ContentCard } from '@/components/ui/content-card';
import { Txt } from '@/constants/ui';

export function ExecuTorchSpeechToTextScreen() {
  const { t } = useTranslation();

  return (
    <Screen
      title={t('dev.executorch.title')}
      subtitle={t('dev.executorch.webSubtitle')}
      back={{ label: t('dev.tools.title'), href: '/settings/dev' }}
      backStyle="icon">
      <ContentCard title={t('dev.executorch.webUnavailable')}>
        <Txt variant="body" tone="secondary">
          {t('dev.executorch.webHint')}
        </Txt>
      </ContentCard>
    </Screen>
  );
}
