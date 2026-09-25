import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { Dimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolateColor,
  Keyframe,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';

import { Colors, radius } from '@/components/theme/index';
import { useSession } from '@/features/auth/session-provider';

const INITIAL_SCALE_FACTOR = Dimensions.get('screen').height / 90;
const DURATION = 600;
const SPLASH_ICON_SIZE = 180;
const SPLASH_MIN_DISPLAY_DURATION = 2400;
const SPLASH_BACKGROUND = Colors.light.background;
const SPLASH_ICON = require('@/assets/splash/fam-splash-icon.png');
const SPLASH_COLOR_STOPS = [
  Colors.light.background,
  Colors.light.accent,
  Colors.light.premiumGradientStart,
  Colors.light.premiumGradientEnd,
  Colors.light.background,
];
const SPLASH_COLOR_INPUTS = [0, 0.25, 0.5, 0.75, 1];

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    backgroundColor: SPLASH_BACKGROUND,
  },
  splashImageContainer: {
    width: SPLASH_ICON_SIZE,
    height: SPLASH_ICON_SIZE,
  },
  splashImage: {
    width: SPLASH_ICON_SIZE,
    height: SPLASH_ICON_SIZE,
  },
  iconRoot: {
    width: 128,
    height: 128,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
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
    backgroundColor: Colors.light.accent,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  expoLogo: {
    width: 76,
    height: 71,
  },
});

export function AnimatedSplashOverlay() {
  const { isLoading } = useSession();
  const [visible, setVisible] = useState(true);
  const startedAt = useRef(Date.now());
  const colorProgress = useSharedValue(0);
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);
  const rotation = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    // The native splash is only the OS launch surface. The React Native overlay
    // takes over immediately and stays visible while the session initializes.
    SplashScreen.hide();
    colorProgress.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.cubic) }),
      -1,
      true,
    );
    scale.value = withRepeat(
      withSequence(
        withTiming(1.45, { duration: 450, easing: Easing.inOut(Easing.cubic) }),
        withTiming(0.72, { duration: 700, easing: Easing.inOut(Easing.cubic) }),
        withTiming(1, { duration: 450, easing: Easing.out(Easing.cubic) }),
      ),
      -1,
      false,
    );
    translateY.value = withRepeat(
      withSequence(
        withTiming(-90, { duration: 450, easing: Easing.out(Easing.cubic) }),
        withTiming(90, { duration: 700, easing: Easing.inOut(Easing.cubic) }),
        withTiming(0, { duration: 450, easing: Easing.out(Easing.cubic) }),
      ),
      -1,
      false,
    );
    rotation.value = withRepeat(
      withSequence(
        withTiming(-14, { duration: 450, easing: Easing.out(Easing.cubic) }),
        withTiming(14, { duration: 700, easing: Easing.inOut(Easing.cubic) }),
        withTiming(0, { duration: 450, easing: Easing.out(Easing.cubic) }),
      ),
      -1,
      false,
    );

    return () => {
      cancelAnimation(colorProgress);
      cancelAnimation(scale);
      cancelAnimation(translateY);
      cancelAnimation(rotation);
    };
  }, [colorProgress, rotation, scale, translateY]);

  useEffect(() => {
    if (isLoading) return;

    const remaining = Math.max(0, SPLASH_MIN_DISPLAY_DURATION - (Date.now() - startedAt.current));
    const exitTimer = setTimeout(() => {
      cancelAnimation(colorProgress);
      cancelAnimation(scale);
      cancelAnimation(translateY);
      cancelAnimation(rotation);
      opacity.value = 0;
      setVisible(false);
    }, remaining);

    return () => {
      clearTimeout(exitTimer);
      cancelAnimation(opacity);
    };
  }, [colorProgress, isLoading, opacity, rotation, scale, translateY]);

  const overlayStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(colorProgress.value, SPLASH_COLOR_INPUTS, SPLASH_COLOR_STOPS),
  }));

  const imageStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { rotate: `${rotation.value}deg` },
      { scale: scale.value },
    ],
  }));

  if (!visible) return null;

  return (
    <Animated.View
      accessible
      accessibilityLabel="fam wird geladen"
      accessibilityRole="progressbar"
      style={[styles.overlay, overlayStyle]}>
      <Animated.View style={[styles.splashImageContainer, imageStyle]}>
        <Image style={styles.splashImage} source={SPLASH_ICON} />
      </Animated.View>
    </Animated.View>
  );
}

const keyframe = new Keyframe({
  0: {
    transform: [{ scale: INITIAL_SCALE_FACTOR }],
  },
  100: {
    transform: [{ scale: 1 }],
    easing: Easing.elastic(0.7),
  },
});

const logoKeyframe = new Keyframe({
  0: {
    transform: [{ scale: 1.3 }],
    opacity: 0,
  },
  40: {
    transform: [{ scale: 1.3 }],
    opacity: 0,
    easing: Easing.elastic(0.7),
  },
  100: {
    opacity: 1,
    transform: [{ scale: 1 }],
    easing: Easing.elastic(0.7),
  },
});

const glowKeyframe = new Keyframe({
  0: {
    transform: [{ rotateZ: '0deg' }],
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

      <Animated.View entering={keyframe.duration(DURATION)} style={styles.expoLogoBackground} />
      <Animated.View style={styles.logoContainer} entering={logoKeyframe.duration(DURATION)}>
        <Image style={styles.expoLogo} source={require('@/assets/images/expo-logo.png')} />
      </Animated.View>
    </View>
  );
}
