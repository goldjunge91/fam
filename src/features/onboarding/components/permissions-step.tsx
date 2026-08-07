import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Button } from '@/components/button';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { requestNotificationPermissions } from '@/lib/notifications';
import { useOnboarding } from '../context/onboarding-context';

// Defensiver Import: expo-camera ist nur in einem nativen Dev-Build verfügbar.
// biome-ignore lint/suspicious/noExplicitAny: Dynamic Expo Camera Module
let requestCameraPermissionsAsync: any = null;
try {
  const ExpoCamera = require('expo-camera');
  if (ExpoCamera?.requestCameraPermissionsAsync) {
    requestCameraPermissionsAsync = ExpoCamera.requestCameraPermissionsAsync;
  }
} catch {
  requestCameraPermissionsAsync = null;
}

interface PermissionsStepFormProps {
  onNext: () => void;
  onSkip: () => void;
}

export function PermissionsStepForm({ onNext, onSkip }: PermissionsStepFormProps) {
  const theme = useTheme();
  const { state, updatePermissionsData } = useOnboarding();

  const [notifications, setNotifications] = useState(
    state.permissions.notificationsRequested ?? true,
  );
  const [camera, setCamera] = useState(state.permissions.cameraRequested ?? true);

  const handlePermissions = async () => {
    // Kamera-Berechtigung anfordern wenn aktiviert
    if (camera && requestCameraPermissionsAsync) {
      try {
        await requestCameraPermissionsAsync();
      } catch {
        // Graceful Fallback — nur im nativen Build verfügbar
      }
    }

    // Benachrichtigungs-Berechtigung anfordern wenn aktiviert
    if (notifications) {
      try {
        await requestNotificationPermissions();
      } catch {
        // Graceful Fallback — nur im nativen Build verfügbar
      }
    }

    updatePermissionsData({
      notificationsRequested: notifications,
      cameraRequested: camera,
    });
    onNext();
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.heading, { color: theme.text }]}>Erlaubnisse & Funktionen</Text>
      <Text style={[styles.subheading, { color: theme.textSecondary }]}>
        Damit die App optimal funktioniert, empfehlen wir folgende Berechtigungen:
      </Text>

      <View style={styles.permissionList}>
        <Pressable
          onPress={() => setNotifications((prev) => !prev)}
          style={[
            styles.permCard,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: notifications ? theme.accent : theme.border,
            },
          ]}>
          <View style={styles.permRow}>
            <View style={styles.permTextCol}>
              <Text style={[styles.permTitle, { color: theme.text }]}>🔔 Benachrichtigungen</Text>
              <Text style={[styles.permDesc, { color: theme.textSecondary }]}>
                Erhalte rechtzeitige Erinnerungen, bevor Lebensmittel im Kühlschrank ablaufen.
              </Text>
            </View>
            <Switch value={notifications} onValueChange={setNotifications} />
          </View>
        </Pressable>

        <Pressable
          onPress={() => setCamera((prev) => !prev)}
          style={[
            styles.permCard,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: camera ? theme.accent : theme.border,
            },
          ]}>
          <View style={styles.permRow}>
            <View style={styles.permTextCol}>
              <Text style={[styles.permTitle, { color: theme.text }]}>📷 Kamera-Zugriff</Text>
              <Text style={[styles.permDesc, { color: theme.textSecondary }]}>
                Scanne Barcodes von Lebensmitteln oder QR-Codes für den Haushaltsbeitritt.
              </Text>
            </View>
            <Switch value={camera} onValueChange={setCamera} />
          </View>
        </Pressable>
      </View>

      <View style={styles.buttonRow}>
        <View style={styles.buttonCol}>
          <Button label="Festlegen & Weiter" onPress={handlePermissions} />
        </View>
        <View style={styles.buttonCol}>
          <Button label="Jetzt nicht" variant="secondary" onPress={onSkip} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.three,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
  },
  subheading: {
    fontSize: 14,
    lineHeight: 20,
  },
  permissionList: {
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  permCard: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
  },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  permTextCol: {
    flex: 1,
    paddingRight: Spacing.two,
  },
  permTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  permDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  buttonCol: {
    flex: 1,
  },
});
