import { Linking, type StyleProp, Switch, View, type ViewStyle } from 'react-native';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Card } from '@/components/ui/card';
import { Txt } from '@/constants/ui';
// `trackColor` benötigt echte Farbwerte statt CSS-Variablen.

export type PermissionState = { granted: boolean; canAskAgain: boolean };

// `readonly [...]` statt eines exakten 2-Tupels, damit auch Hooks wie
// `Location.useForegroundPermissions` passen, die zusätzliche Elemente liefern
// (z. B. eine separate `getPermission`-Funktion), die dieses Muster nicht braucht.
type UsePermission = () => readonly [
  PermissionState | null | undefined,
  () => Promise<unknown>,
  ...unknown[],
];

type PermissionCardProps = {
  title: string;
  label: string;
  grantedCopy: string;
  deniedCopy: string;
  usePermission: UsePermission;
  /** Aufgerufen, wenn der Nutzer den Schalter ausschaltet. Ohne Angabe passiert nichts —
   * die App kann eine erteilte OS-Berechtigung ohnehin nicht zurücknehmen. */
  onDisable?: () => Promise<void> | void;
  style?: StyleProp<ViewStyle>;
};

/**
 * Geteiltes Muster für "OS-Berechtigung anzeigen und umschalten": zeigt den aktuellen
 * granted-Status und fragt beim Einschalten erneut an, sofern das noch möglich ist
 * (`canAskAgain`) — sonst verweist der Schalter auf die Systemeinstellungen.
 */
export function PermissionCard({
  title,
  label,
  grantedCopy,
  deniedCopy,
  usePermission,
  onDisable,
  style,
}: PermissionCardProps) {
  const { colors } = useTheme();
  const [permission, requestPermission] = usePermission();

  const granted = permission?.granted ?? false;
  const canAskAgain = permission?.canAskAgain ?? true;

  async function handleToggle(value: boolean) {
    if (!value) {
      await onDisable?.();
      return;
    }
    // Nach dauerhafter Ablehnung hilft nur noch der Weg über die Systemeinstellungen.
    if (!canAskAgain) {
      Linking.openSettings();
      return;
    }
    await requestPermission();
  }

  return (
    <View style={style}>
      <Card title={title}>
        <View className="row-between">
          <View className="row-text">
            <Txt variant="body" weight="700">
              {label}
            </Txt>
            <Txt variant="body" tone="secondary" weight="500">
              {canAskAgain ? grantedCopy : deniedCopy}
            </Txt>
          </View>
          <Switch
            value={granted}
            onValueChange={handleToggle}
            trackColor={{ false: colors.border, true: colors.basil }}
          />
        </View>
      </Card>
    </View>
  );
}
