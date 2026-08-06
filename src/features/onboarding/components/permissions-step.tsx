import { Button, Column, Host, Spacer, Text } from '@expo/ui';
import { Text as RNText, StyleSheet, View } from 'react-native';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useOnboarding } from '../context/onboarding-context';

interface PermissionsStepFormProps {
  onNext: () => void;
  onSkip: () => void;
}

export function PermissionsStepForm({ onNext, onSkip }: PermissionsStepFormProps) {
  const theme = useTheme();
  const { updatePermissionsData } = useOnboarding();

  const handlePermissions = async () => {
    updatePermissionsData({
      notificationsRequested: true,
      cameraRequested: true,
    });
    onNext();
  };

  return (
    <Host matchContents>
      <Column style={styles.container}>
        <Text textStyle={{ ...styles.heading, color: theme.text }}>Erlaubnisse & Funktionen</Text>
        <Text textStyle={{ ...styles.subheading, color: theme.textSecondary }}>
          Damit die App optimal funktioniert, empfehlen wir folgende Berechtigungen:
        </Text>

        <Spacer size={Spacing.three} />

        <View style={styles.permissionList}>
          <View
            style={[
              styles.permCard,
              { borderColor: theme.border, backgroundColor: theme.backgroundElement },
            ]}>
            <RNText style={[styles.permTitle, { color: theme.text }]}>🔔 Benachrichtigungen</RNText>
            <RNText style={[styles.permDesc, { color: theme.textSecondary }]}>
              Erhalte rechtzeitige Erinnerungen, bevor Lebensmittel im Kühlschrank ablaufen.
            </RNText>
          </View>

          <Spacer size={Spacing.two} />

          <View
            style={[
              styles.permCard,
              { borderColor: theme.border, backgroundColor: theme.backgroundElement },
            ]}>
            <RNText style={[styles.permTitle, { color: theme.text }]}>📷 Kamera-Zugriff</RNText>
            <RNText style={[styles.permDesc, { color: theme.textSecondary }]}>
              Scanne Barcodes von Lebensmitteln oder QR-Codes für den Haushaltsbeitritt.
            </RNText>
          </View>
        </View>

        <Spacer size={Spacing.four} />

        <View style={styles.buttonRow}>
          <Button onPress={handlePermissions}>Berechtigungen erlauben</Button>
          <Button onPress={onSkip}>Jetzt nicht</Button>
        </View>
      </Column>
    </Host>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.four,
  },
  heading: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  subheading: {
    fontSize: 14,
  },
  permissionList: {
    width: '100%',
  },
  permCard: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
  },
  permTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  permDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
