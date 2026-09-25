import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';

import { radius } from '@/components/theme/index';

const DURATION = 300;

const styles = StyleSheet.create({
  iconRoot: {
    width: 128,
    height: 128,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    width: 201,
    height: 201,
    position: 'absolute',
  },
  expoLogoBackground: {
    width: 128,
    height: 128,
    position: 'absolute',
    borderRadius: radius.xxl,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  expoLogo: {
    width: 76,
    height: 71,
    position: 'absolute',
  },
});

export function AnimatedSplashOverlay() {
  return null;
}

const keyframe = new Keyframe({
  0: {
    transform: [{ scale: 0 }],
  },
  60: {
    transform: [{ scale: 1.2 }],
    easing: Easing.elastic(1.2),
  },
  100: {
    transform: [{ scale: 1 }],
    easing: Easing.elastic(1.2),
  },
});

const logoKeyframe = new Keyframe({
  0: {
    opacity: 0,
  },
  60: {
    transform: [{ scale: 1.2 }],
    opacity: 0,
    easing: Easing.elastic(1.2),
  },
  100: {
    transform: [{ scale: 1 }],
    opacity: 1,
    easing: Easing.elastic(1.2),
  },
});

const glowKeyframe = new Keyframe({
  0: {
    transform: [{ rotateZ: '-180deg' }, { scale: 0.8 }],
    opacity: 0,
  },
  [DURATION / 1000]: {
    transform: [{ rotateZ: '0deg' }, { scale: 1 }],
    opacity: 1,
    easing: Easing.elastic(0.7),
  },
  100: {
    transform: [{ rotateZ: '7200deg' }],
  },
});

export function AnimatedIcon() {
  return (
    <View style={styles.iconRoot}>
      <Animated.View entering={glowKeyframe.duration(60 * 1000 * 4)} style={styles.glow}>
        <Image style={styles.glow} source={require('@/assets/images/logo-glow.png')} />
      </Animated.View>

      <Animated.View entering={keyframe.duration(DURATION)} style={styles.expoLogoBackground}>
        <LinearGradient colors={['#3c9ffe', '#0274df']} style={styles.expoLogoBackground} />
      </Animated.View>

      <Animated.View style={styles.logoContainer} entering={logoKeyframe.duration(DURATION)}>
        <Image style={styles.expoLogo} source={require('@/assets/images/expo-logo.png')} />
      </Animated.View>
    </View>
  );
}
