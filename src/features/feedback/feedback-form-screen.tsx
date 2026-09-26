import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Screen } from '@/components/layout/screen';
import { ContentCard } from '@/components/ui/content-card';
import { Button, SegmentedControl, TextField, Txt } from '@/constants/ui';
import { useSession } from '@/features/auth/session-provider';
import { type FeedbackType, useCreateTicketMutation } from '@/features/feedback/api';
import { FEEDBACK_TYPE_LABELS } from '@/features/feedback/labels';

const TYPE_OPTIONS = (Object.keys(FEEDBACK_TYPE_LABELS) as FeedbackType[]).map((value) => ({
  value,
  label: FEEDBACK_TYPE_LABELS[value],
}));

const styles = StyleSheet.create((theme) => ({
  form: {
    gap: theme.space.lg,
  },
}));

export function FeedbackFormScreen() {
  const { session } = useSession();
  const userId = session?.user.id;

  const [type, setType] = useState<FeedbackType>('bug');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdTicketNumber, setCreatedTicketNumber] = useState<number | null>(null);

  const mutation = useCreateTicketMutation();

  async function handleSubmit() {
    if (!userId) return;

    const trimmedSubject = subject.trim();
    const trimmedBody = body.trim();
    if (!trimmedSubject || !trimmedBody) {
      setErrorMsg('Bitte fülle Betreff und Nachricht aus.');
      return;
    }

    setErrorMsg(null);
    try {
      const ticket = await mutation.mutateAsync({
        userId,
        type,
        subject: trimmedSubject,
        body: trimmedBody,
      });
      setCreatedTicketNumber(ticket.ticket_number);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Ein unerwarteter Fehler ist aufgetreten.');
    }
  }

  if (createdTicketNumber !== null) {
    return (
      <Screen title="Feedback geben" back={{ label: 'Feedback' }}>
        <ContentCard>
          <View style={styles.form}>
            <Txt variant="body" weight="700">
              Danke für dein Feedback!
            </Txt>
            <Txt variant="body">{`Dein Ticket #${createdTicketNumber} ist eingegangen. Wir melden uns, sobald sich etwas tut.`}</Txt>
            <Button
              title="Meine Tickets ansehen"
              onPress={() => router.replace('/settings/feedback')}
            />
          </View>
        </ContentCard>
      </Screen>
    );
  }

  return (
    <Screen title="Feedback geben" back={{ label: 'Zurück' }}>
      <ContentCard>
        <View style={styles.form}>
          <SegmentedControl
            label="Art des Feedbacks"
            options={TYPE_OPTIONS}
            selected={type}
            onSelect={setType}
            selectionRole="radio"
          />

          <TextField
            label="Betreff"
            value={subject}
            onChangeText={setSubject}
            placeholder="Kurze Zusammenfassung"
          />

          <TextField
            label="Nachricht"
            value={body}
            onChangeText={setBody}
            placeholder="Was ist passiert, oder was schlägst du vor?"
            multiline
            numberOfLines={5}
            size="large"
          />

          {errorMsg ? (
            <Txt variant="body" tone="danger">
              {errorMsg}
            </Txt>
          ) : null}

          <Button title="Absenden" onPress={handleSubmit} loading={mutation.isPending} />
        </View>
      </ContentCard>
    </Screen>
  );
}
