import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { moduleLockedOverlayStyles, Txt } from '@/constants/ui';

export function ModuleLockedOverlay() {
  const { t } = useTranslation();
  return (
    <View style={moduleLockedOverlayStyles.overlay}>
      <View style={moduleLockedOverlayStyles.pill}>
        <View style={moduleLockedOverlayStyles.dot} />
        <Txt variant="body" weight="700" style={moduleLockedOverlayStyles.label}>
          {t('common.moduleGate.locked')}
        </Txt>
      </View>
    </View>
  );
}
