import { SymbolView } from 'expo-symbols';
import type React from 'react';

interface Props {
  size: number;
}

export function CameraIcon({ size }: Props): React.ReactElement {
  return <SymbolView name="camera.fill" size={size} tintColor="white" fallback={null} />;
}
