import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Screen } from '@/components/layout/screen';
import { ContentCard } from '@/components/ui/content-card';
import { Button, SegmentedControl, TextField, Txt } from '@/constants/ui';
import { useSession } from '@/features/auth/session-provider';
import { type FeedbackType, useCreateTicketMutation } from '@/features/feedback/api';
import { FEEDBACK_TYPE_VALUES, getFeedbackTypeLabel } from '@/features/feedback/labels';

const styles = StyleSheet.create((theme) => ({
  form: {
    gap: theme.space.lg,
  },
}));

export function FeedbackFormScreen() {
  const { t } = useTranslation();
  const { session } = useSession();
  const userId = session?.user.id;

  const [type, setType] = useState<FeedbackType>('bug');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdTicketNumber, setCreatedTicketNumber] = useState<number | null>(null);
  const typeOptions = FEEDBACK_TYPE_VALUES.map((value) => ({
    value,
    label: getFeedbackTypeLabel(t, value),
  }));

  const mutation = useCreateTicketMutation();

  async function handleSubmit() {
    if (!userId) return;

    const trimmedSubject = subject.trim();
    const trimmedBody = body.trim();
    if (!trimmedSubject || !trimmedBody) {
      setErrorMsg(t('feedback.form.missing'));
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
      setErrorMsg(err instanceof Error ? err.message : t('feedback.detail.unexpected'));
    }
  }

  if (createdTicketNumber !== null) {
    return (
      <Screen title={t('feedback.form.title')} back={{ label: t('feedback.detail.back') }}>
        <ContentCard>
          <View style={styles.form}>
            <Txt variant="body" weight="700">
              {t('feedback.form.thanks')}
            </Txt>
            <Txt variant="body">{t('feedback.form.received', { number: createdTicketNumber })}</Txt>
            <Button
              title={t('feedback.form.viewTickets')}
              onPress={() => router.replace('/settings/feedback')}
            />
          </View>
        </ContentCard>
      </Screen>
    );
  }

  return (
    <Screen title={t('feedback.form.title')} back={{ label: t('feedback.form.back') }}>
      <ContentCard>
        <View style={styles.form}>
          <SegmentedControl
            label={t('feedback.form.type')}
            options={typeOptions}
            selected={type}
            onSelect={setType}
            selectionRole="radio"
          />

          <TextField
            label={t('feedback.form.subject')}
            value={subject}
            onChangeText={setSubject}
            placeholder={t('feedback.form.subjectPlaceholder')}
          />

          <TextField
            label={t('feedback.form.message')}
            value={body}
            onChangeText={setBody}
            placeholder={t('feedback.form.messagePlaceholder')}
            multiline
            numberOfLines={5}
            size="large"
          />

          {errorMsg ? (
            <Txt variant="body" tone="danger">
              {errorMsg}
            </Txt>
          ) : null}

          <Button
            title={t('feedback.form.submit')}
            onPress={handleSubmit}
            loading={mutation.isPending}
          />
        </View>
      </ContentCard>
    </Screen>
  );
}
