import { Easing } from 'react-native-reanimated';

/** Shared motion roles. Feature-specific choreography stays with its effect. */
export const motion = {
  pressIn: 60,
  pressFeedback: 70,
  progress: 700,
  navigation: 220,
  feedbackFast: 160,
  feedbackExit: 320,
  progressIndeterminate: 1600,
  attentionPulse: 900,
  splashColorCycle: 1800,
  iconBounceIn: 450,
  iconBounceOut: 700,
  iconGlow: 60 * 1000 * 4,
  jiggleBase: 140,
  jiggleStagger: 10,
  jiggleReset: 100,
  speechIntensityRelease: 180,
  spring: {
    interactive: { damping: 15, stiffness: 200 },
    celebrationPop: { damping: 8, stiffness: 320 },
    celebrationSettle: { damping: 12, stiffness: 260 },
    press: { damping: 14, stiffness: 320, mass: 0.5 },
    buttonPop: { damping: 9, stiffness: 380, mass: 0.5 },
  },
  easing: {
    standard: Easing.inOut(Easing.cubic),
    emphasized: Easing.out(Easing.cubic),
    iconElastic: Easing.elastic(0.7),
    logoElastic: Easing.elastic(1.2),
    jiggle: Easing.inOut(Easing.sin),
    linear: Easing.linear,
  },
} as const;
