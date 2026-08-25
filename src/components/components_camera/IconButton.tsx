import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { BlurContainer, type BlurContainerProps } from './BlurContainer';

type SupportedIcon =
  | 'close'
  | 'camera'
  | 'camera.rotate'
  | 'xmark'
  | 'arrow.triangle.2.circlepath.camera'
  | 'camera.fill';

interface Props extends BlurContainerProps {
  iconName: SupportedIcon | string;
  onPress: () => void;
}

function resolveSymbolName(name: string): SymbolViewProps['name'] {
  switch (name) {
    case 'close':
    case 'xmark':
      return 'xmark';
    case 'camera.rotate':
    case 'arrow.triangle.2.circlepath.camera':
      return 'arrow.triangle.2.circlepath.camera';
    default:
      return 'camera.fill';
  }
}

export function IconButton({ iconName, children, onPress, ...props }: Props): React.ReactElement {
  const symbolName = resolveSymbolName(iconName);

  return (
    <Pressable onPress={onPress} {...props}>
      <BlurContainer style={styles.container}>
        {children}
        <SymbolView name={symbolName} size={22} tintColor="white" fallback={null} />
      </BlurContainer>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 9999,
    overflow: 'hidden',
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
