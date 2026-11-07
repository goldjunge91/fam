import type { ReactNode } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { ProgressBar } from '@/components/ui/progress-bar';
import { Button, Card, Txt } from '@/constants/ui';

import type { AiCreditStatus } from '../api';
import { formatAiCreditRenewalDate } from '../month';

const styles = StyleSheet.create((theme) => ({
  content: {
    gap: theme.space.md,
  },
  heading: {
    gap: theme.space.xs,
  },
  progress: {
    gap: theme.space.xs,
  },
  progressLabel: {
    fontVariant: ['tabular-nums'],
  },
  loading: {
    minHeight: theme.space.xxl,
    justifyContent: 'center',
    gap: theme.space.xs,
  },
  error: {
    gap: theme.space.md,
  },
}));

type AiCreditCardProps = {
  householdId: string | null;
  status?: AiCreditStatus;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  now?: Date;
};

function CardFrame({ children }: { children: ReactNode }) {
  return <Card>{children}</Card>;
}

export function AiCreditCard({
  householdId,
  status,
  isLoading = false,
  isError = false,
  onRetry,
  now = new Date(),
}: AiCreditCardProps) {
  if (householdId === null) {
    return (
      <CardFrame>
        <View style={styles.content}>
          <Txt variant="heading" selectable>
            KI-Credits
          </Txt>
          <Txt tone="secondary" selectable>
            Kein aktiver Haushalt verfügbar.
          </Txt>
        </View>
      </CardFrame>
    );
  }

  if (isLoading) {
    return (
      <CardFrame>
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="KI-Credits werden geladen"
          accessibilityState={{ busy: true }}
          style={styles.loading}>
          <Txt variant="heading" selectable>
            KI-Credits
          </Txt>
          <Txt tone="secondary" selectable>
            Credits werden geladen.
          </Txt>
        </View>
      </CardFrame>
    );
  }

  if (isError || status === undefined) {
    return (
      <CardFrame>
        <View accessible accessibilityRole="alert" style={styles.error}>
          <View style={styles.heading}>
            <Txt variant="heading" selectable>
              KI-Credits
            </Txt>
            <Txt tone="secondary" selectable>
              Credits konnten nicht geladen werden.
            </Txt>
          </View>
          {onRetry ? (
            <Button title="Erneut versuchen" variant="secondary" onPress={onRetry} />
          ) : null}
        </View>
      </CardFrame>
    );
  }

  const blocked = status.blocked || status.creditsRemaining <= 0;
  const progress = status.creditLimit > 0 ? status.creditsRemaining / status.creditLimit : 0;
  const progressLabel = `${status.creditsRemaining} von ${status.creditLimit} Credits verfügbar`;

  return (
    <CardFrame>
      <View style={styles.content}>
        <View style={styles.heading}>
          <Txt variant="heading" selectable>
            KI-Credits
          </Txt>
          {blocked ? (
            <Txt variant="subheading" tone="danger" selectable>
              Keine Credits mehr verfügbar
            </Txt>
          ) : (
            <Txt variant="subheading" selectable style={styles.progressLabel}>
              {progressLabel}
            </Txt>
          )}
        </View>

        <View style={styles.progress}>
          <ProgressBar value={progress} accessibilityLabel={progressLabel} />
          {blocked ? (
            <Txt variant="caption" tone="secondary" selectable>
              Neue Credits ab {formatAiCreditRenewalDate(now)} (UTC)
            </Txt>
          ) : null}
        </View>
      </View>
    </CardFrame>
  );
}
