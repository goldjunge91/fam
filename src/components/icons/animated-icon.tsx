import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';
import { Dimensions, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const INITIAL_SCALE_FACTOR = Dimensions.get('screen').height / 90;
const DURATION = 600;
const SPLASH_BACKGROUND = '#F8F4EF';
const SPLASH_ICON = require('@/assets/splash/fam-splash-icon.png');

export function AnimatedSplashOverlay() {
  const [animate, setAnimate] = useState(false);
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  const splashKeyframe = new Keyframe({
    0: {
      transform: [{ scale: 1 }],
      opacity: 1,
    },
    45: {
      transform: [{ scale: 1.02 }],
      opacity: 1,
    },
    100: {
      opacity: 0,
      transform: [{ scale: 1.06 }],
      easing: Easing.out(Easing.cubic),
    },
  });

  // Image (expo-image) ist bei NativeWind nicht registriert (kein
  // cssInterop) — className wird stillschweigend ignoriert, style bleibt
  // hier zwingend.
  const image = (
    <Image style={{ width: 180, height: 180 }} source={SPLASH_ICON} />
  );

  return animate ? (
    <Animated.View
      entering={splashKeyframe.duration(DURATION).withCallback((finished) => {
        'worklet';
        if (finished) {
          scheduleOnRN(setVisible, false);
        }
      })}
      className="absolute inset-0 items-center justify-center z-[1000]"
      style={{ backgroundColor: SPLASH_BACKGROUND }}>
      {image}
    </Animated.View>
  ) : (
    <View
      onLayout={() => {
        SplashScreen.hideAsync().finally(() => {
          setAnimate(true);
        });
      }}
      className="absolute inset-0 items-center justify-center z-[1000]"
      style={{ backgroundColor: SPLASH_BACKGROUND }}>
      {image}
    </View>
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
    <View className="justify-center items-center w-[128px] h-[128px] z-[100]">
      <Animated.View
        entering={glowKeyframe.duration(60 * 1000 * 4)}
        className="w-[201px] h-[201px] absolute">
        {/* Image (expo-image) ist bei NativeWind nicht registriert. */}
        <Image
          style={{ width: 201, height: 201, position: 'absolute' }}
          source={require('@/assets/images/logo-glow.png')}
        />
      </Animated.View>

      <Animated.View
        entering={keyframe.duration(DURATION)}
        className="w-[128px] h-[128px] rounded-[40px] absolute bg-[#208AEF]"
      />
      <Animated.View
        className="justify-center items-center"
        entering={logoKeyframe.duration(DURATION)}>
        {/* Image (expo-image) ist bei NativeWind nicht registriert. */}
        <Image
          style={{ width: 76, height: 71 }}
          source={require('@/assets/images/expo-logo.png')}
        />
      </Animated.View>
    </View>
  );
}
