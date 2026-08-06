import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function StepIndicator({ currentStep, totalSteps = 6 }: { currentStep: number; totalSteps?: number }) {
  const theme = useTheme();

  return (
    <View style={styles.stepDots}>
      {Array.from({ length: totalSteps }).map((_, i) => {
        const active = i + 1 === currentStep;
        return (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: active ? theme.accent : theme.border,
                width: active ? 22 : 8,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stepDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
    marginVertical: Spacing.two,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
});
