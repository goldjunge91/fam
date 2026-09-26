import { FontAwesome5 } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { StyleSheet } from 'react-native-unistyles';

import { BUTTON_DEPTH } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { motion } from '@/constants/motion';
import { PRESS_SPRING, Press, providerColors } from '@/constants/ui';

const styles = StyleSheet.create((theme) => ({
  depth: {
    width: 52,
    borderRadius: theme.radius.md,
    backgroundColor: theme.border,
    paddingBottom: BUTTON_DEPTH,
  },
  button: {
    width: 52,
    height: 52,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
    backgroundColor: theme.backgroundElement,
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
    overflow: 'hidden',
  },
}));

type AuthProvider = 'apple' | 'google';

function GoogleIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={providerColors.google.blue}
        d="M21.35 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.7 2.91-4.2 2.91-7.42Z"
      />
      <Path
        fill={providerColors.google.green}
        d="M12 21.5c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.7-1.72-5.47-4.03H3.28v2.53A9.74 9.74 0 0 0 12 21.5Z"
      />
      <Path
        fill={providerColors.google.yellow}
        d="M6.53 13.58A5.86 5.86 0 0 1 6.22 12c0-.55.1-1.08.31-1.58V7.89H3.28A9.5 9.5 0 0 0 2.25 12c0 1.48.35 2.88 1.03 4.11l3.25-2.53Z"
      />
      <Path
        fill={providerColors.google.red}
        d="M12 6.39c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.83 3.49 14.63 2.5 12 2.5a9.74 9.74 0 0 0-8.72 5.39l3.25 2.53C7.3 8.11 9.46 6.39 12 6.39Z"
      />
    </Svg>
  );
}

export function AuthProviderIconButton({
  accessibilityLabel,
  onPress,
  provider,
  testID,
}: {
  accessibilityLabel: string;
  onPress: () => void;
  provider: AuthProvider;
  testID?: string;
}) {
  const { colors } = useTheme();
  const depth = useSharedValue(0);
  const reducedMotion = useReducedMotion();
  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: reducedMotion ? 0 : depth.value }],
  }));

  return (
    <Animated.View style={styles.depth}>
      <Animated.View style={faceStyle}>
        <Press
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          onPress={onPress}
          onPressIn={() => {
            if (!reducedMotion)
              depth.value = withTiming(BUTTON_DEPTH, { duration: motion.pressIn });
          }}
          onPressOut={() => {
            depth.value = reducedMotion ? 0 : withSpring(0, PRESS_SPRING);
          }}
          style={styles.button}
          testID={testID}>
          {provider === 'google' ? (
            <GoogleIcon size={24} />
          ) : (
            <FontAwesome5 name="apple" size={24} color={colors.text} brand />
          )}
        </Press>
      </Animated.View>
    </Animated.View>
  );
}
