import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Screen } from '@/components/layout/screen';
import { ThemedText } from '@/components/theme/themed-text';
import { ThemedView } from '@/components/theme/themed-view';
import { Button } from '@/components/ui/buttons';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Spacing } from '@/constants/layout';
import { useSession } from '@/features/auth/session-provider';
import { type FeedbackTicket, useMyTickets } from '@/features/feedback/api';
import {
  FEEDBACK_STATUS_COLORS,
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_TYPE_LABELS,
} from '@/features/feedback/labels';
import { useFeedbackRealtime } from '@/features/feedback/use-feedback-realtime';

const BANNER_DURATION_MS = 4000;

function TicketRow({ ticket }: { ticket: FeedbackTicket }) {
  return (
    <Pressable onPress={() => router.push(`/settings/feedback/${ticket.id}`)}>
      <Card>
        <View className="flex-row items-center justify-between">
          <View className="flex-1 gap-one">
            <ThemedText type="smallBold">{`#${ticket.ticket_number} · ${ticket.subject}`}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {`${FEEDBACK_TYPE_LABELS[ticket.type]} · ${new Date(ticket.created_at).toLocaleDateString('de-DE')}`}
            </ThemedText>
          </View>
          <ThemedText type="smallBold" themeColor={FEEDBACK_STATUS_COLORS[ticket.status]}>
            {FEEDBACK_STATUS_LABELS[ticket.status]}
          </ThemedText>
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

  const action = <Button label="+ Neu" onPress={() => router.push('/settings/feedback/new')} />;

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
        <ThemedView type="backgroundElement" className="rounded-card p-two mb-two">
          <ThemedText type="small">{banner}</ThemedText>
        </ThemedView>
      ) : null}
      <FlashList
        data={tickets}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingVertical: Spacing.two }}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.two }} />}
        renderItem={({ item }) => <TicketRow ticket={item} />}
      />
    </Screen>
  );
}
