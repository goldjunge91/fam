import { LinearTransition } from 'react-native-reanimated';

export const DASHBOARD_LAYOUT_TRANSITION = LinearTransition.springify()
  .damping(18)
  .stiffness(240)
  .mass(0.6);
