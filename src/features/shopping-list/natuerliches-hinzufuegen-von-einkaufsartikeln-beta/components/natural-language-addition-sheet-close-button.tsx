import { StyleSheet } from 'react-native-unistyles';

import { CloseButton } from '@/constants/ui';

export function NaturalLanguageAdditionSheetCloseButton({
  onPress,
  accessibilityLabel = 'Schließen',
}: {
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <CloseButton
      onPress={onPress}
      hitSlop={6}
      accessibilityLabel={accessibilityLabel}
      style={styles.button}
    />
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
