import { Image } from 'expo-image';
import { Press, profileButtonStyles, Txt } from '@/constants/ui';

type ProfileButtonProps = {
  initials: string;
  avatarUrl?: string | null;
  onPress: () => void;
};

/** Runder Profilbutton im Haupt-Header: zeigt das Profilbild, sonst die Initialen. */
export function ProfileButton({ initials, avatarUrl, onPress }: ProfileButtonProps) {
  // Statischer Style statt Pressable-Style-Funktion: Letztere wird auf dem Gerät
  // nicht angewendet, der Button blieb dann ohne Größe und Hintergrund unsichtbar.
  return (
    <Press
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Profil öffnen"
      style={profileButtonStyles.button}>
      {avatarUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          accessibilityLabel="Profilbild"
          accessible={false}
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
