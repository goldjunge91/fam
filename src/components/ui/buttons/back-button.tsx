import { type Href, router, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable } from 'react-native';
import { FamIcon } from '@/components/icons/fam-icon';
import { space } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';

const ARROW_BUTTON_SIZE = space.xxxl;

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
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={variant === 'header' ? label : `Zurück zu ${label}`}
        className="btn-back-arrow"
        style={{ backgroundColor: colors.backgroundSelected }}>
        <FamIcon name="arrow" size={ARROW_BUTTON_SIZE} color={colors.text} />
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`Zurück zu ${label}`}
      className="self-start pt-two pb-one pr-three">
      <Txt variant="body" tone="primary" weight="700">
        {`‹ ${label}`}
      </Txt>
    </Pressable>
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
