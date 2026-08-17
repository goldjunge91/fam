import { Pressable } from 'react-native';

import { ThemedText } from '@/components/themed-text';

type ProfileButtonProps = {
  initials: string;
  onPress: () => void;
};

/** Runder Profilbutton im Haupt-Header. */
export function ProfileButton({ initials, onPress }: ProfileButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Profil öffnen"
      className="btn-profile">
      <ThemedText type="small" themeColor="onAccent">
        {initials}
      </ThemedText>
    </Pressable>
  );
}


