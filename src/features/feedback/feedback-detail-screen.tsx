import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { TextField } from '@/components/forms/text-field';
import { Screen } from '@/components/layout/screen';
import { withAlpha } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Card } from '@/components/ui/card';
import { Button, Surface, Txt } from '@/constants/ui';
import { useSession } from '@/features/auth/session-provider';
import {
  type FeedbackMessage,
  useSendReplyMutation,
  useTicket,
  useTicketMessages,
} from '@/features/feedback/api';
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

function MessageBubble({ message }: { message: FeedbackMessage }) {
  const { colors } = useTheme();
  const isStaff = message.author_type === 'staff';

  return (
    <Surface
      tone="surface"
      className="gap-one rounded-card p-two"
      style={{ backgroundColor: isStaff ? withAlpha(colors.basil, 0.1) : colors.surface }}>
      <Txt variant="body" tone="secondary">
        {isStaff ? 'Team' : 'Du'} · {new Date(message.created_at).toLocaleDateString('de-DE')}
      </Txt>
      <Txt variant="body">{message.body}</Txt>
    </Surface>
  );
}

export function FeedbackDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const userId = session?.user.id;

  const { data: ticket } = useTicket(id);
  const { data: messages } = useTicketMessages(id);
  const mutation = useSendReplyMutation();

  const [reply, setReply] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [banner, setBanner] = useState<string | null>(null);
  const onStaffReply = useCallback(() => {
    setBanner('Das Team hat geantwortet.');
  }, []);
  useFeedbackRealtime({ userId, ticketId: id, onStaffReply });

  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(() => setBanner(null), BANNER_DURATION_MS);
    return () => clearTimeout(timer);
  }, [banner]);

  const isClosed = ticket?.status === 'closed';

  async function handleSend() {
    if (!userId || !id) return;
    const trimmed = reply.trim();
    if (!trimmed) return;

    setErrorMsg(null);
    try {
      await mutation.mutateAsync({ ticketId: id, userId, body: trimmed });
      setReply('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Ein unerwarteter Fehler ist aufgetreten.');
    }
  }

  return (
    <Screen title={ticket ? `#${ticket.ticket_number}` : 'Ticket'} back={{ label: 'Feedback' }}>
      {banner ? (
        <Surface tone="surface" className="rounded-card p-two">
          <Txt variant="body">{banner}</Txt>
        </Surface>
      ) : null}
      {ticket ? (
        <Card>
          <View className="gap-one">
            <Txt variant="body" weight="700">
              {ticket.subject}
            </Txt>
            <View className="flex-row items-center justify-between">
              <Txt variant="body" tone="secondary">
                {FEEDBACK_TYPE_LABELS[ticket.type]}
              </Txt>
              <Txt
                variant="body"
                weight="700"
                tone={STATUS_TONE[FEEDBACK_STATUS_COLORS[ticket.status]]}>
                {FEEDBACK_STATUS_LABELS[ticket.status]}
              </Txt>
            </View>
          </View>
        </Card>
      ) : null}

      <View className="gap-two">
        {(messages ?? []).map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </View>

      {isClosed ? (
        <Txt variant="body" tone="secondary">
          Dieses Ticket ist geschlossen. Neue Antworten sind nicht mehr möglich.
        </Txt>
      ) : (
        <Card>
          <View className="gap-three">
            <TextField
              label="Antworten"
              value={reply}
              onChangeText={setReply}
              placeholder="Deine Nachricht"
              multiline
              numberOfLines={3}
            />
            {errorMsg ? (
              <Txt variant="body" tone="danger">
                {errorMsg}
              </Txt>
            ) : null}
            <Button title="Senden" onPress={handleSend} loading={mutation.isPending} />
          </View>
        </Card>
      )}
    </Screen>
  );
}
