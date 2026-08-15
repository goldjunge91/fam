import { Pressable, StyleSheet } from 'react-native';

import { FontSize, ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

type ProfileButtonProps = {
  initials: string;
  onPress: () => void;
};

/** Runder Profilbutton im Haupt-Header. */
export function ProfileButton({ initials, onPress }: ProfileButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Profil öffnen"
      style={[styles.button, { backgroundColor: theme.accent }]}>
      <ThemedText style={styles.initials}>{initials}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: '#fff',
    ...FontSize[14],
    lineHeight: 20,
    fontWeight: '500',
  },
});
