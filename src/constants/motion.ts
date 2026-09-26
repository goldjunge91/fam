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
  spring: {
    interactive: { damping: 15, stiffness: 200 },
    celebrationPop: { damping: 8, stiffness: 320 },
    celebrationSettle: { damping: 12, stiffness: 260 },
  },
  easing: {
    standard: Easing.inOut(Easing.cubic),
    emphasized: Easing.out(Easing.cubic),
    linear: Easing.linear,
  },
} as const;
