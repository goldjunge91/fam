import { useRef } from 'react';
import { ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Press, Txt } from '@/constants/ui';

const BAR_HEIGHT = 34;
const DAY_TARGET_WIDTH = 44;
const MAX_BAR_KCAL = 2600;

export type DiaryWeekStripDay = {
  isoDate: string;
  weekday: string;
  relativeLabel: string;
  fullLabel: string;
  kcal: number;
  kcalLabel: string;
  overGoal: boolean;
};

const styles = StyleSheet.create((theme) => ({
  hint: {
    alignSelf: 'center',
    marginBottom: theme.space.xs / 2,
  },
  strip: {
    borderRadius: theme.radius.md,
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
    paddingTop: theme.space.sm + theme.space.xs,
    paddingHorizontal: theme.space.lg,
    paddingBottom: theme.space.sm,
    overflow: 'hidden',
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.space.sm,
  },
  dayContainer: {
    width: DAY_TARGET_WIDTH,
  },
  day: {
    width: DAY_TARGET_WIDTH,
    minHeight: DAY_TARGET_WIDTH,
    alignItems: 'center',
    gap: theme.space.xs + theme.space.xs / 2,
    paddingTop: theme.space.xs,
  },
  dayLabel: {
    fontSize: theme.font.sizes.micro,
    lineHeight: 12,
  },
  barTrack: {
    width: 5,
    height: BAR_HEIGHT,
    borderRadius: theme.radius.xs / 2,
    backgroundColor: theme.backgroundSoft,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: theme.radius.xs / 2,
    backgroundColor: theme.accent,
  },
  barFillWarning: {
    backgroundColor: theme.warning,
  },
  dayDot: {
    width: 4,
    height: 4,
    borderRadius: theme.radius.xs / 4,
    backgroundColor: 'transparent',
  },
  dayDotActive: {
    backgroundColor: theme.accent,
  },
  dateLine: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: theme.space.xs / 2,
    paddingBottom: theme.space.sm + theme.space.xs,
    gap: theme.space.xs / 4,
  },
}));

export function DiaryWeekStrip({
  days,
  selectedDate,
  onSelect,
}: {
  days: DiaryWeekStripDay[];
  selectedDate: string;
  onSelect: (isoDate: string) => void;
}) {
  const stripRef = useRef<ScrollView>(null);
  const hasScrolledToToday = useRef(false);
  const selectedDay = days.find((day) => day.isoDate === selectedDate) ?? days[days.length - 1];

  if (!selectedDay) return null;

  function scrollToToday() {
    if (hasScrolledToToday.current) return;
    hasScrolledToToday.current = true;
    stripRef.current?.scrollToEnd({ animated: false });
  }

  return (
    <>
      <Txt variant="caption" tone="secondary" weight="600" style={styles.hint} center>
        Tippe auf einen Tag · wische für ältere Tage
      </Txt>
      <View style={styles.strip}>
        <ScrollView
          ref={stripRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          style={styles.scroll}
          onContentSizeChange={scrollToToday}>
          {days.map((day) => {
            const fillHeight =
              day.kcal > 0
                ? Math.max(4, Math.min(BAR_HEIGHT, (day.kcal / MAX_BAR_KCAL) * BAR_HEIGHT))
                : 0;
            const isSelected = day.isoDate === selectedDay.isoDate;

            return (
              <Press
                key={day.isoDate}
                onPress={() => onSelect(day.isoDate)}
                role="button"
                aria-label={`${day.relativeLabel}, ${day.fullLabel}, ${day.kcalLabel}`}
                containerStyle={styles.dayContainer}
                style={styles.day}>
                <Txt
                  variant="caption"
                  tone={isSelected ? 'accent' : 'secondary'}
                  weight={isSelected ? '700' : '600'}
                  style={styles.dayLabel}>
                  {day.weekday}
                </Txt>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      day.overGoal && styles.barFillWarning,
                      { height: fillHeight },
                    ]}
                  />
                </View>
                <View style={[styles.dayDot, isSelected && styles.dayDotActive]} />
              </Press>
            );
          })}
        </ScrollView>
      </View>
      <View style={styles.dateLine}>
        <Txt variant="label" tone="accent" weight="700">
          {selectedDay.relativeLabel}
        </Txt>
        <Txt variant="caption" tone="secondary" weight="500">
          {selectedDay.fullLabel}
        </Txt>
      </View>
    </>
  );
}
