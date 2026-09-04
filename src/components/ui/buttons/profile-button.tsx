import { Image } from 'expo-image';
import { Pressable } from 'react-native';

import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';

type ProfileButtonProps = {
  initials: string;
  avatarUrl?: string | null;
  onPress: () => void;
};

/** Runder Profilbutton im Haupt-Header: zeigt das Profilbild, sonst die Initialen. */
export function ProfileButton({ initials, avatarUrl, onPress }: ProfileButtonProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Profil öffnen"
      className="btn-profile overflow-hidden"
      style={{ backgroundColor: colors.basil }}>
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
    </Pressable>
  );
}
