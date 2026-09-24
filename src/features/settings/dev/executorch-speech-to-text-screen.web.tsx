import { Screen } from '@/components/layout/screen';
import { Card } from '@/components/ui/card';
import { Txt } from '@/constants/ui';

export function ExecuTorchSpeechToTextScreen() {
  return (
    <Screen
      title="ExecuTorch Speech-to-Text"
      subtitle="Lokale Sprachverarbeitung auf dem Gerät"
      back={{ label: 'Entwickler', href: '/settings/dev' }}
      backStyle="icon">
      <Card title="Auf dieser Plattform nicht verfügbar">
        <Txt variant="body" tone="secondary">
          ExecuTorch und die lokale Mikrofonaufnahme benötigen die nativen iOS- oder Android-Module.
        </Txt>
      </Card>
    </Screen>
  );
}
