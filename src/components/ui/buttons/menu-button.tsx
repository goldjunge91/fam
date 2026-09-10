import { Pressable, StyleSheet } from "react-native";

import { radius, withAlpha } from "@/components/theme/index";
import { useTheme } from "@/components/theme/ThemeProvider";
import { IconButton } from "@/constants/ui";

type MenuButtonProps = {
  onPress: () => void;
};

/** Einheitlicher Menuebutton fuer die zentralen App-Bereiche. */
export function MenuButton({ onPress }: MenuButtonProps) {
  const { colors } = useTheme();

  return (
    <IconButton
      icon="menu"
      onPress={onPress}
      accessibilityLabel="Menü öffnen"
      color={colors.premiumActionText}
      bg={withAlpha(colors.backgroundElement, 1)}
      size={54}
      iconSize={20}
      style={styles.button}
    />
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.lg,
  },
});
