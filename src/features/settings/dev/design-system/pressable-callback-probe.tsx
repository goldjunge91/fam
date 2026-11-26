import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { radius, space } from '@/components/theme/index';
import { Txt } from '@/constants/ui';

/** Dev-only probe for the native Pressable pressed-style callback. */
export function PressableCallbackProbe() {
  const { t } = useTranslation();
  const [tapCount, setTapCount] = useState(0);

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('dev.design.components.pressedTest')}
        onPress={() => setTapCount((count) => count + 1)}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
        <Txt variant="label" tone="onAccent" weight="700">
          {t('dev.design.components.pressedHold')}
        </Txt>
      </Pressable>
      <Txt variant="caption" tone="secondary">
        {t('dev.design.components.pressedHint')}
      </Txt>
      <Txt variant="caption" tone="secondary">
        {t('dev.design.components.recognizedTaps', { count: tapCount })}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    gap: theme.space.sm,
  },
  button: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    backgroundColor: theme.accent,
    opacity: 1,
    paddingHorizontal: space.lg,
    transform: [{ scale: 1 }],
  },
  buttonPressed: {
    opacity: 0.35,
    transform: [{ scale: 0.9 }],
  },
}));
