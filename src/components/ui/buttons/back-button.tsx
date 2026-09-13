import { type Href, router, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { FamIcon } from '@/components/icons/fam-icon';
import { space } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Press, Txt } from '@/constants/ui';

const ARROW_BUTTON_SIZE = space.xxxl;

const styles = StyleSheet.create((theme) => ({
  arrowButton: {
    width: 45,
    height: 45,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.backgroundSoft,
  },
  textButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    paddingTop: theme.space.sm,
    paddingBottom: theme.space.xs,
    paddingRight: theme.space.lg,
  },
}));

export type BackTarget = {
  /** Das Ziel beim Namen, z. B. `Einstellungen`. Erscheint als `‹ Einstellungen` bzw. als Accessibility-Label. */
  label: string;
  /** Ausweichziel, falls keine Navigationshistorie vorhanden ist. */
  href?: Href;
};

export function goBackTo(href: Href | undefined) {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  if (href) router.replace(href);
}

type BackButtonProps = BackTarget & {
  variant?: 'text' | 'arrow' | 'header';
  /** Eigene Rueck-Aktion, etwa um einen Entwurf vor dem Verlassen zu verwerfen. */
  onPress?: () => void;
};

/** Zentraler Zurueckbutton mit optionalem sicheren Ausweichziel. */
export function BackButton({ label, href, variant = 'text', onPress }: BackButtonProps) {
  const { colors } = useTheme();
  const handlePress = onPress ?? (() => goBackTo(href));

  if (variant === 'arrow' || variant === 'header') {
    return (
      <Press
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={variant === 'header' ? label : `Zurück zu ${label}`}
        style={styles.arrowButton}>
        <FamIcon name="arrow" size={ARROW_BUTTON_SIZE} color={colors.text} />
      </Press>
    );
  }

  return (
    <Press
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`Zurück zu ${label}`}
      style={styles.textButton}>
      <Txt variant="body" tone="primary" weight="700">
        {`‹ ${label}`}
      </Txt>
    </Press>
  );
}

/** Rendert den Zurueckbutton nur, wenn der Navigator wirklich zurueck kann. */
export function AutoBackButton({ label, variant }: Pick<BackButtonProps, 'label' | 'variant'>) {
  const navigation = useNavigation();
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    const update = () => setCanGoBack(navigation.canGoBack());
    update();

    const unsubscribeState = navigation.addListener('state', update);
    const unsubscribeFocus = navigation.addListener('focus', update);

    return () => {
      unsubscribeState();
      unsubscribeFocus();
    };
  }, [navigation]);

  return canGoBack ? <BackButton label={label} variant={variant} /> : null;
}
