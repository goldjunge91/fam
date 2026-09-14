import { View } from 'react-native';
import { moduleLockedOverlayStyles, Txt } from '@/constants/ui';

export function ModuleLockedOverlay() {
  return (
    <View style={moduleLockedOverlayStyles.overlay}>
      <View style={moduleLockedOverlayStyles.pill}>
        <View style={moduleLockedOverlayStyles.dot} />
        <Txt variant="body" weight="700" style={moduleLockedOverlayStyles.label}>
          Demnächst verfügbar
        </Txt>
      </View>
    </View>
  );
}
