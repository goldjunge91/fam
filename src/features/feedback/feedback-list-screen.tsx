import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Screen } from '@/components/layout/screen';
import { space } from '@/components/theme/index';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, Surface, Txt } from '@/constants/ui';
import { useSession } from '@/features/auth/session-provider';
import { type FeedbackTicket, useMyTickets } from '@/features/feedback/api';
import {
  FEEDBACK_STATUS_COLORS,
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_TYPE_LABELS,
} from '@/features/feedback/labels';
import { useFeedbackRealtime } from '@/features/feedback/use-feedback-realtime';

const BANNER_DURATION_MS = 4000;
const STATUS_TONE = {
  textSecondary: 'secondary',
  warning: 'warning',
  success: 'success',
} as const;

function TicketRow({ ticket }: { ticket: FeedbackTicket }) {
  return (
    <Pressable onPress={() => router.push(`/settings/feedback/${ticket.id}`)}>
      <Card>
        <View className="flex-row items-center justify-between">
          <View className="flex-1 gap-one">
            <Txt variant="body" weight="700">{`#${ticket.ticket_number} · ${ticket.subject}`}</Txt>
            <Txt variant="body" tone="secondary">
              {`${FEEDBACK_TYPE_LABELS[ticket.type]} · ${new Date(ticket.created_at).toLocaleDateString('de-DE')}`}
            </Txt>
          </View>
          <Txt
            variant="body"
            weight="700"
            tone={STATUS_TONE[FEEDBACK_STATUS_COLORS[ticket.status]]}>
            {FEEDBACK_STATUS_LABELS[ticket.status]}
          </Txt>
        </View>
      </Card>
    </Pressable>
  );
}

export function FeedbackListScreen() {
  const { session } = useSession();
  const userId = session?.user.id;

  const { data: tickets, isLoading } = useMyTickets(userId);

  const [banner, setBanner] = useState<string | null>(null);
  const onTicketInProgress = useCallback(() => {
    setBanner('Ein Ticket ist jetzt in Bearbeitung.');
  }, []);
  useFeedbackRealtime({ userId, onTicketInProgress });

  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(() => setBanner(null), BANNER_DURATION_MS);
    return () => clearTimeout(timer);
  }, [banner]);

  const action = <Button title="+ Neu" onPress={() => router.push('/settings/feedback/new')} />;

  if (isLoading) {
    return (
      <Screen title="Feedback" action={action} back={{ label: 'Einstellungen', href: '/settings' }}>
        <View />
      </Screen>
    );
  }

  if (!tickets || tickets.length === 0) {
    return (
      <Screen title="Feedback" action={action} back={{ label: 'Einstellungen', href: '/settings' }}>
        <Card>
          <EmptyState
            symbol="bubble.left.and.bubble.right"
            title="Noch kein Feedback"
            hint="Melde einen Fehler oder teile eine Anregung — wir informieren dich hier über den Fortschritt."
          />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen
      title="Feedback"
      action={action}
      scroll={false}
      back={{ label: 'Einstellungen', href: '/settings' }}>
      {banner ? (
        <Surface tone="surface" className="rounded-card p-two mb-two">
          <Txt variant="body">{banner}</Txt>
        </Surface>
      ) : null}
      <FlashList
        data={tickets}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingVertical: space.sm }}
        ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
        renderItem={({ item }) => <TicketRow ticket={item} />}
      />
    </Screen>
  );
}
