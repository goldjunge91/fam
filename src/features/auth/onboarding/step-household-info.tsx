import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

export function StepHouseholdInfo() {
  return (
    <Card title="Schritt 3: Gemeinsam im Haushalt">
      <ThemedText style={{ marginTop: Spacing.one, lineHeight: 22 }}>
        Verbinde dich mit deiner Familie oder deiner WG.
      </ThemedText>
      <View style={styles.featureList}>
        <View style={styles.featureRow}>
          <ThemedText style={styles.featureIcon}>👥</ThemedText>
          <View style={styles.featureTextContainer}>
            <ThemedText type="smallBold">Haushalt erstellen oder beitreten</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Lade andere Personen über einen Einladungs-Code in deinen Haushalt ein.
            </ThemedText>
          </View>
        </View>
        <View style={styles.featureRow}>
          <ThemedText style={styles.featureIcon}>📱</ThemedText>
          <View style={styles.featureTextContainer}>
            <ThemedText type="smallBold">Gleichzeitiges Abgleichen</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Alle Änderungen seht ihr sofort auf allen verbundenen Smartphones.
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
