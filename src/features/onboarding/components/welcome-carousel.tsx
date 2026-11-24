import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Button, Press, Surface, Txt } from '@/constants/ui';

const SLIDES = [
  {
    id: 'slide-1',
    icon: '🏠',
    titleKey: 'onboarding.welcome.slides.home.title',
    descriptionKey: 'onboarding.welcome.slides.home.description',
  },
  {
    id: 'slide-2',
    icon: '🛒',
    titleKey: 'onboarding.welcome.slides.shopping.title',
    descriptionKey: 'onboarding.welcome.slides.shopping.description',
  },
  {
    id: 'slide-3',
    icon: '🍎',
    titleKey: 'onboarding.welcome.slides.tracking.title',
    descriptionKey: 'onboarding.welcome.slides.tracking.description',
  },
] as const;

interface WelcomeCarouselProps {
  onStart: () => void;
}

const styles = StyleSheet.create((theme) => ({
  root: {
    alignItems: 'center',
    gap: theme.space.lg,
    paddingVertical: theme.space.sm,
  },
  iconCircle: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: theme.space.sm,
    borderRadius: theme.radius.pill,
  },
  subtitle: {
    paddingHorizontal: theme.space.sm,
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.space.sm,
  },
  paginationButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paginationDot: {
    width: theme.space.sm,
    height: theme.space.sm,
    marginHorizontal: theme.space.xs,
    borderRadius: theme.radius.s,
  },
  paginationDotExpanded: {
    width: 24,
  },
  buttonContainer: {
    width: '100%',
    marginTop: theme.space.sm,
  },
}));

export function WelcomeCarousel({ onStart }: WelcomeCarouselProps) {
  const { t } = useTranslation();
  const [slideIndex, setSlideIndex] = useState(0);

  const isLast = slideIndex === SLIDES.length - 1;
  const current = SLIDES[slideIndex];

  return (
    <View style={styles.root}>
      <Surface tone="surface" style={styles.iconCircle}>
        <Txt variant="display" center>
          {current.icon}
        </Txt>
      </Surface>

      <Txt variant="subheading" weight="700" center>
        {t(current.titleKey)}
      </Txt>

      <Txt variant="body" tone="secondary" center style={styles.subtitle}>
        {t(current.descriptionKey)}
      </Txt>

      <View
        style={styles.paginationRow}
        accessibilityRole="tablist"
        accessibilityLabel={t('onboarding.welcome.pagination')}>
        {SLIDES.map((slide, idx) => (
          <Press
            key={slide.id}
            onPress={() => setSlideIndex(idx)}
            accessibilityRole="tab"
            accessibilityLabel={t('onboarding.welcome.slide', { number: idx + 1 })}
            accessibilityState={{ selected: idx === slideIndex }}
            haptic="selection"
            selected={idx === slideIndex}
            style={styles.paginationButton}>
            <View
              style={[styles.paginationDot, idx === slideIndex && styles.paginationDotExpanded]}
            />
          </Press>
        ))}
      </View>

      <View style={styles.buttonContainer}>
        {isLast ? (
          <Button title={t('onboarding.welcome.start')} onPress={onStart} />
        ) : (
          <Button
            title={t('onboarding.welcome.next')}
            onPress={() => setSlideIndex((prev) => Math.min(SLIDES.length - 1, prev + 1))}
          />
        )}
      </View>
    </View>
  );
}
