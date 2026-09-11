import { Pressable } from "react-native";
import { MenuIcon } from "@/components/icons/fam-icon";
import { useTheme } from "@/components/theme/ThemeProvider";
import { colors } from "@/components/theme";
import { accessibilityLabel } from "@expo/ui/swift-ui/modifiers";

type MenuButtonProps = {
  onPress: () => void;
};

/** Einheitlicher Menuebutton fuer die zentralen App-Bereiche. */
export function MenuButton({ onPress }: MenuButtonProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Menü öffnen"
      className="btn-menu"
      style={{ backgroundColor: colors.backgroundSoft }}>
      <MenuIcon color={colors.text} />
    </Pressable>
  );
}
