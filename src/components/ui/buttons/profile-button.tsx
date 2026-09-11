import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';

import { radius } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Press, Txt } from '@/constants/ui';

type ProfileButtonProps = {
  initials: string;
  avatarUrl?: string | null;
  onPress: () => void;
};

/** Runder Profilbutton im Haupt-Header: zeigt das Profilbild, sonst die Initialen. */
export function ProfileButton({ initials, avatarUrl, onPress }: ProfileButtonProps) {
  const { colors } = useTheme();

  // Statischer Style statt Pressable-Style-Funktion: Letztere wird auf dem Gerät
  // nicht angewendet, der Button blieb dann ohne Größe und Hintergrund unsichtbar.
  return (
    <Press
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Profil öffnen"
      style={[styles.button, { backgroundColor: colors.accent }]}>
      {avatarUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          accessibilityLabel="Profilbild"
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
        />
      ) : (
        <Txt variant="body" tone="onAccent" weight="500">
          {initials}
        </Txt>
      )}
    </Press>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 58,
    height: 58,
    borderRadius: radius.famLarge,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
