import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Screen } from '@/components/layout/screen';
import { ContentCard } from '@/components/ui/content-card';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, Press, Surface, Txt } from '@/constants/ui';
import { useSession } from '@/features/auth/session-provider';
import { type FeedbackTicket, useMyTickets } from '@/features/feedback/api';
import {
  FEEDBACK_STATUS_COLORS,
  getFeedbackStatusLabel,
  getFeedbackTypeLabel,
} from '@/features/feedback/labels';
import { useFeedbackRealtime } from '@/features/feedback/use-feedback-realtime';

const BANNER_DURATION_MS = 4000;
const STATUS_TONE = {
  textSecondary: 'secondary',
  warning: 'warning',
  success: 'success',
} as const;

const styles = StyleSheet.create((theme) => ({
  ticketContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ticketCopy: {
    flex: 1,
    gap: theme.space.xs,
  },
  banner: {
    borderRadius: theme.radius.md,
    padding: theme.space.sm,
    marginBottom: theme.space.sm,
  },
  listContent: {
    paddingVertical: theme.space.sm,
  },
  separator: {
    height: theme.space.sm,
  },
}));

function TicketRow({ ticket }: { ticket: FeedbackTicket }) {
  const { i18n, t } = useTranslation();
  return (
    <Press onPress={() => router.push(`/settings/feedback/${ticket.id}`)}>
      <ContentCard>
        <View style={styles.ticketContent}>
          <View style={styles.ticketCopy}>
            <Txt variant="body" weight="700">{`#${ticket.ticket_number} · ${ticket.subject}`}</Txt>
            <Txt variant="body" tone="secondary">
              {`${getFeedbackTypeLabel(t, ticket.type)} · ${new Date(ticket.created_at).toLocaleDateString(i18n.language)}`}
            </Txt>
          </View>
          <Txt
            variant="body"
            weight="700"
            tone={STATUS_TONE[FEEDBACK_STATUS_COLORS[ticket.status]]}>
            {getFeedbackStatusLabel(t, ticket.status)}
          </Txt>
        </View>
      </ContentCard>
    </Press>
  );
}

export function FeedbackListScreen() {
  const { t } = useTranslation();
  const { session } = useSession();
  const userId = session?.user.id;

  const { data: tickets, isLoading } = useMyTickets(userId);

  const [banner, setBanner] = useState<string | null>(null);
  const onTicketInProgress = useCallback(() => {
    setBanner(t('feedback.list.statusUpdate'));
  }, [t]);
  useFeedbackRealtime({ userId, onTicketInProgress });

  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(() => setBanner(null), BANNER_DURATION_MS);
    return () => clearTimeout(timer);
  }, [banner]);

  const action = (
    <Button title={t('feedback.list.new')} onPress={() => router.push('/settings/feedback/new')} />
  );

  if (isLoading) {
    return (
      <Screen
        title={t('feedback.list.title')}
        action={action}
        back={{ label: t('feedback.list.back'), href: '/settings' }}>
        <View />
      </Screen>
    );
  }

  if (!tickets || tickets.length === 0) {
    return (
      <Screen
        title={t('feedback.list.title')}
        action={action}
        back={{ label: t('feedback.list.back'), href: '/settings' }}>
        <ContentCard>
          <EmptyState
            symbol="bubble.left.and.bubble.right"
            title={t('feedback.list.emptyTitle')}
            hint={t('feedback.list.emptyHint')}
          />
        </ContentCard>
      </Screen>
    );
  }

  return (
    <Screen
      title={t('feedback.list.title')}
      action={action}
      scroll={false}
      back={{ label: t('feedback.list.back'), href: '/settings' }}>
      {banner ? (
        <Surface tone="surface" style={styles.banner}>
          <Txt variant="body">{banner}</Txt>
        </Surface>
      ) : null}
      <FlashList
        data={tickets}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => <TicketRow ticket={item} />}
      />
    </Screen>
  );
}
