import { router } from 'expo-router';

import { Screen } from '@/components/layout/screen';
import { ContentCard } from '@/components/ui/content-card';
import { Button } from '@/constants/ui';

export function DevPreviewsScreen() {
  return (
    <Screen
      title="Vorschauen & Labs"
      subtitle="Design-System, Auth, Drax und Paywalls"
      back={{ label: 'Entwickler', href: '/settings/dev' }}
      backStyle="icon">
      <ContentCard title="Vorschauen">
        <Button
          title="Design-System-Referenz öffnen"
          variant="secondary"
          onPress={() => router.push('/settings/design-system')}
        />
        <Button
          title="Drax-Drag-Demo öffnen"
          variant="secondary"
          onPress={() => router.push('/settings/drax-demo')}
        />
        <Button
          title="Auth-Seiten testen"
          variant="secondary"
          onPress={() => router.push('/settings/auth-preview')}
        />
        <Button
          title="Plus-Paywall öffnen (Test Store)"
          variant="secondary"
          onPress={() =>
            router.push({ pathname: '/settings/plus-and-ai', params: { tier: 'plus' } })
          }
        />
        <Button
          title="KI-Paywall öffnen (Test Store)"
          variant="secondary"
          onPress={() => router.push({ pathname: '/settings/plus-and-ai', params: { tier: 'ai' } })}
        />
      </ContentCard>
    </Screen>
  );
}
