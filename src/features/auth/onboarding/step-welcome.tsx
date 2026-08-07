import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

export function StepWelcome() {
  return (
    <Card title="Schritt 1: Willkommen bei Fam App!">
      <ThemedText style={{ marginTop: Spacing.one, lineHeight: 22 }}>
        Deine familiäre All-in-One Lösung zum Verwalten von Vorräten, gemeinsamen Einkaufslisten und
        Rezepten.
      </ThemedText>
      <View style={styles.featureList}>
        <View style={styles.featureRow}>
          <ThemedText style={styles.featureIcon}>🧊</ThemedText>
          <View style={styles.featureTextContainer}>
            <ThemedText type="smallBold">Vorräte im Blick</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Kühlschrank, Gefrierfach und Vorratsschrank übersichtlich verwalten.
            </ThemedText>
          </View>
        </View>
        <View style={styles.featureRow}>
          <ThemedText style={styles.featureIcon}>🛒</ThemedText>
          <View style={styles.featureTextContainer}>
            <ThemedText type="smallBold">Geteilte Einkaufsliste</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Einkäufe gemeinsam in Echtzeit planen und beim Einkaufen abhaken.
            </ThemedText>
          </View>
        </View>
        <View style={styles.featureRow}>
          <ThemedText style={styles.featureIcon}>🔄</ThemedText>
          <View style={styles.featureTextContainer}>
            <ThemedText type="smallBold">Offline & Sync</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Funktioniert auch ohne Netz und synchronisiert automatisch im Hintergrund.
            </ThemedText>
          </View>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  featureList: {
    gap: Spacing.three,
    marginTop: Spacing.three,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  featureIcon: {
    fontSize: 24,
  },
  featureTextContainer: {
    flex: 1,
    gap: 2,
  },
});
