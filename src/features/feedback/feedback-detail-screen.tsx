import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { TextField } from '@/components/forms/text-field';
import { Screen } from '@/components/layout/screen';
import { ThemedText } from '@/components/theme/themed-text';
import { ThemedView } from '@/components/theme/themed-view';
import { Button } from '@/components/ui/buttons';
import { Card } from '@/components/ui/card';
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

function MessageBubble({ message }: { message: FeedbackMessage }) {
  const isStaff = message.author_type === 'staff';

  return (
    <ThemedView
      type="backgroundElement"
      className={`gap-one rounded-card p-two ${isStaff ? 'bg-accent/10' : ''}`}>
      <ThemedText type="small" themeColor="textSecondary">
        {isStaff ? 'Team' : 'Du'} · {new Date(message.created_at).toLocaleDateString('de-DE')}
      </ThemedText>
      <ThemedText>{message.body}</ThemedText>
    </ThemedView>
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
      {ticket ? (
        <Card>
          <View className="gap-one">
            <ThemedText type="smallBold">{ticket.subject}</ThemedText>
            <View className="flex-row items-center justify-between">
              <ThemedText type="small" themeColor="textSecondary">
                {FEEDBACK_TYPE_LABELS[ticket.type]}
              </ThemedText>
              <ThemedText type="smallBold" themeColor={FEEDBACK_STATUS_COLORS[ticket.status]}>
                {FEEDBACK_STATUS_LABELS[ticket.status]}
              </ThemedText>
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
        <ThemedText type="small" themeColor="textSecondary">
          Dieses Ticket ist geschlossen. Neue Antworten sind nicht mehr möglich.
        </ThemedText>
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
            {errorMsg ? <ThemedText type="smallDanger">{errorMsg}</ThemedText> : null}
            <Button label="Senden" onPress={handleSend} loading={mutation.isPending} />
          </View>
        </Card>
      )}
    </Screen>
  );
}
