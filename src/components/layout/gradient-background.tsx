import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import type { GradientSpec } from '@/components/theme/index';

type GradientBackgroundProps = GradientSpec;

const styles = StyleSheet.create((theme) => ({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.background,
  },
}));

/** Preserves the screen-background contract while rendering a flat theme surface. */
export function GradientBackground(_props: GradientBackgroundProps) {
  return <View pointerEvents="none" style={styles.root} />;
}
