import { Image } from 'expo-image';
import { Pressable } from 'react-native';

import { ThemedText } from '@/components/theme/themed-text';

type ProfileButtonProps = {
  initials: string;
  avatarUrl?: string | null;
  onPress: () => void;
};

/** Runder Profilbutton im Haupt-Header: zeigt das Profilbild, sonst die Initialen. */
export function ProfileButton({ initials, avatarUrl, onPress }: ProfileButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Profil öffnen"
      className="btn-profile overflow-hidden">
      {avatarUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          accessibilityLabel="Profilbild"
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
        />
      ) : (
        <ThemedText type="small" themeColor="onAccent">
          {initials}
        </ThemedText>
      )}
    </Pressable>
  );
}
