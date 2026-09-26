import { Screen } from '@/components/layout/screen';
import { ContentCard } from '@/components/ui/content-card';
import { Txt } from '@/constants/ui';

export function ExecuTorchSpeechToTextScreen() {
  return (
    <Screen
      title="ExecuTorch Speech-to-Text"
      subtitle="Lokale Sprachverarbeitung auf dem Gerät"
      back={{ label: 'Entwickler', href: '/settings/dev' }}
      backStyle="icon">
      <ContentCard title="Auf dieser Plattform nicht verfügbar">
        <Txt variant="body" tone="secondary">
          ExecuTorch und die lokale Mikrofonaufnahme benötigen die nativen iOS- oder Android-Module.
        </Txt>
      </ContentCard>
    </Screen>
  );
}
