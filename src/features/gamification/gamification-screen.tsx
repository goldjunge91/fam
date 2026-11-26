import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Screen } from '@/components/layout/screen';
import { radius, space } from '@/components/theme';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Button, Card, Txt } from '@/constants/ui';
import { celebrate } from './celebration';
import { useStreak } from './streak';

const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100, 365] as const;

const styles = StyleSheet.create({
  hero: {
    gap: space.md,
    borderRadius: radius.xl,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.md,
  },
  heroMetric: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: space.md,
  },
  statCard: {
    flex: 1,
    gap: space.xs,
  },
  sectionCard: {
    gap: space.sm,
  },
  devCard: {
    gap: space.md,
  },
  buttonStack: {
    gap: space.sm,
  },
});

function getNextMilestone(count: number): number {
  return STREAK_MILESTONES.find((milestone) => milestone > count) ?? count + 1;
}

export function GamificationScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const streak = useStreak();
  const hasStreak = streak.count > 0;
  const statusKey = hasStreak
    ? streak.activeToday
      ? 'gamification.activeToday'
      : 'gamification.activeYesterday'
    : streak.best > 0
      ? 'gamification.startNew'
      : 'gamification.startFirst';
  const nextMilestone = getNextMilestone(streak.count);

  return (
    <Screen
      title={t('gamification.title')}
      subtitle={t('gamification.subtitle')}
      back={{ label: t('gamification.back'), href: '/settings' }}
      backStyle="icon">
      <Card style={[styles.hero, { backgroundColor: colors.accent, borderColor: colors.accent }]}>
        <View style={styles.heroHeader}>
          <View style={{ flex: 1, gap: space.sm }}>
            <Txt variant="caption" tone="onAccent" weight="700">
              {t('gamification.yourStreak')}
            </Txt>
            <View style={styles.heroMetric}>
              <Txt variant="display" tone="onAccent" selectable>
                {streak.count}
              </Txt>
              <Txt variant="body" tone="onAccent">
                {t(streak.count === 1 ? 'gamification.daySingular' : 'gamification.dayPlural')}
              </Txt>
            </View>
          </View>
          <Txt variant="display" selectable>
            🔥
          </Txt>
        </View>
        <Txt variant="body" tone="onAccent" weight="700">
          {t(statusKey)}
        </Txt>
      </Card>

      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Txt variant="caption" tone="secondary" weight="700">
            {t('gamification.bestValue')}
          </Txt>
          <Txt variant="title" selectable>
            {t('gamification.days', { count: streak.best })}
          </Txt>
          <Txt variant="caption" tone="secondary">
            {t('gamification.personalRecord')}
          </Txt>
        </Card>
        <Card style={styles.statCard}>
          <Txt variant="caption" tone="secondary" weight="700">
            {t('gamification.nextGoal')}
          </Txt>
          <Txt variant="title" selectable>
            {t('gamification.days', { count: nextMilestone })}
          </Txt>
          <Txt variant="caption" tone="secondary">
            {t('gamification.keepGoing')}
          </Txt>
        </Card>
      </View>

      <Card style={styles.sectionCard}>
        <Txt variant="heading">{t('gamification.howItWorks')}</Txt>
        <Txt variant="body" tone="secondary">
          {t('gamification.howItWorksHint')}
        </Txt>
      </Card>

      {__DEV__ ? (
        <Card style={styles.devCard}>
          <View style={{ gap: space.xs }}>
            <Txt variant="caption" tone="accent" weight="700">
              {t('gamification.developmentLabel')}
            </Txt>
            <Txt variant="heading">{t('gamification.celebrations')}</Txt>
            <Txt variant="body" tone="secondary">
              {t('gamification.celebrationsHint')}
            </Txt>
          </View>
          <View style={styles.buttonStack}>
            <Button
              title={t('gamification.celebrationWithoutMessage')}
              variant="secondary"
              full
              onPress={() => celebrate()}
            />
            <Button
              title={t('gamification.celebrationWithMessage')}
              variant="primary"
              full
              onPress={() => celebrate(t('gamification.celebrationTested'))}
            />
            <Button
              title={t('gamification.streakBadge')}
              variant="accent"
              accentKey="nourish"
              full
              onPress={() => celebrate(t('gamification.streakSeven'))}
            />
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}
