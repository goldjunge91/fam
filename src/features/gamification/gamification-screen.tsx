import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/layout/screen';
import { font, radius, space } from '@/components/theme';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Button, Card, Txt } from '@/constants/ui';
import { celebrate } from '@/lib/celebration';
import { useStreak } from '@/lib/streak';

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
  heroEmoji: {
    fontSize: font.sizes.xxxl,
    lineHeight: font.lineHeights.display,
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
  const streak = useStreak();
  const hasStreak = streak.count > 0;
  const status = hasStreak
    ? streak.activeToday
      ? 'Heute aktiv'
      : 'Gestern aktiv'
    : streak.best > 0
      ? 'Neue Serie starten'
      : 'Starte deine erste Serie';
  const nextMilestone = getNextMilestone(streak.count);

  return (
    <Screen
      title="Gamification"
      subtitle="Kleine Schritte, die sich summieren"
      back={{ label: 'Einstellungen', href: '/settings' }}
      backStyle="icon">
      <Card
        style={{
          ...styles.hero,
          backgroundColor: colors.accent,
          borderColor: colors.accent,
        }}>
        <View style={styles.heroHeader}>
          <View style={{ flex: 1, gap: space.sm }}>
            <Txt variant="caption" tone="inverse" weight="700">
              DEIN KOCHSTREAK
            </Txt>
            <View style={styles.heroMetric}>
              <Txt variant="display" tone="inverse" selectable>
                {streak.count}
              </Txt>
              <Txt variant="body" tone="inverse">
                {streak.count === 1 ? 'Tag am Stück' : 'Tage am Stück'}
              </Txt>
            </View>
          </View>
          <Txt variant="body" style={styles.heroEmoji} selectable>
            🔥
          </Txt>
        </View>
        <Txt variant="body" tone="inverse" weight="700">
          {status}
        </Txt>
      </Card>

      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Txt variant="caption" tone="secondary" weight="700">
            BESTER WERT
          </Txt>
          <Txt variant="title" selectable>
            {streak.best} Tage
          </Txt>
          <Txt variant="caption" tone="secondary">
            dein persönlicher Rekord
          </Txt>
        </Card>
        <Card style={styles.statCard}>
          <Txt variant="caption" tone="secondary" weight="700">
            NÄCHSTES ZIEL
          </Txt>
          <Txt variant="title" selectable>
            {nextMilestone} Tage
          </Txt>
          <Txt variant="caption" tone="secondary">
            einfach weiter dranbleiben
          </Txt>
        </Card>
      </View>

      <Card style={styles.sectionCard}>
        <Txt variant="heading">So funktioniert dein Streak</Txt>
        <Txt variant="body" tone="secondary">
          Koche ein Rezept oder schließe einen Einkaufsrun ab, um den heutigen Tag zu zählen. Bleib
          bis morgen dran, damit deine Serie weiter wächst.
        </Txt>
      </Card>

      {__DEV__ ? (
        <Card style={styles.devCard}>
          <View style={{ gap: space.xs }}>
            <Txt variant="caption" tone="accent" weight="700">
              __DEV__
            </Txt>
            <Txt variant="heading">Celebrations testen</Txt>
            <Txt variant="body" tone="secondary">
              Löst die globale Celebration direkt aus. Der Bereich ist in Production Builds nicht
              sichtbar.
            </Txt>
          </View>
          <View style={styles.buttonStack}>
            <Button
              title="Celebration ohne Nachricht"
              variant="secondary"
              full
              onPress={() => celebrate()}
            />
            <Button
              title="Celebration mit Nachricht"
              variant="primary"
              full
              onPress={() => celebrate('🎉 Celebration getestet')}
            />
            <Button
              title="Streak-Badge testen"
              variant="accent"
              accentKey="nourish"
              full
              onPress={() => celebrate('🔥 7 Tage Streak!')}
            />
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}
