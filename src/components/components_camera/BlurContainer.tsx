import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import type React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

export interface BlurContainerProps extends ViewProps {
  tint?: 'dark' | 'light';
}

export function BlurContainer({
  tint = 'dark',
  style,
  children,
  ...props
}: BlurContainerProps): React.ReactElement {
  const canUseGlass = isGlassEffectAPIAvailable();
  const bgStyle = tint === 'dark' ? styles.dark : styles.light;

  if (canUseGlass) {
    return (
      <View style={[styles.overflow, style]} {...props}>
        <GlassView
          glassEffectStyle={tint === 'dark' ? 'regular' : 'clear'}
          style={StyleSheet.absoluteFill}
        />
        {children}
      </View>
    );
  }

  return (
    <View style={[styles.overflow, bgStyle, style]} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  overflow: {
    overflow: 'hidden',
  },
  dark: {
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  light: {
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
  },
});
