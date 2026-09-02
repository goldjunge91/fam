import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/theme/themed-text';
import { ThemedView } from '@/components/theme/themed-view';
import {
  ACTIVITY_OPTIONS,
  formatBirthDate,
  type ProfileBiometrics,
  SEX_OPTIONS,
} from '@/features/profile/domain/biometrics';

function formatNumber(value: number | null, unit: string) {
  return value === null
    ? 'Nicht gesetzt'
    : `${value.toLocaleString('de-DE', { maximumFractionDigits: 1 })} ${unit}`;
}

export function BiometricsSummary({
  value,
  onPress,
}: {
  value: ProfileBiometrics;
  onPress: () => void;
}) {
  const height = formatNumber(value.heightCm, 'cm');
  const weight = formatNumber(value.weightKg, 'kg');
  const birthDate = formatBirthDate(value.birthDate);
  const sex = SEX_OPTIONS.find((option) => option.value === value.sex)?.label ?? 'Nicht gesetzt';
  const activity =
    ACTIVITY_OPTIONS.find((option) => option.value === value.activityLevel)?.label ??
    'Nicht gesetzt';
  const accessibleSummary = `${height}, ${weight}, ${birthDate}, ${sex}, ${activity}`;

  return (
    <View className="gap-two">
      <View className="profile-section-header">
        <ThemedText type="smallBold">Körper &amp; Aktivität</ThemedText>
        <Pressable
          onPress={onPress}
          role="button"
          aria-label={`Körper & Aktivität bearbeiten. ${accessibleSummary}`}
          className="profile-section-edit">
          <ThemedText type="smallBold" themeColor="accent">
            Bearbeiten
          </ThemedText>
        </Pressable>
      </View>

      <ThemedView type="backgroundElement" className="profile-biometrics-summary">
        <View className="profile-biometrics-weight">
          <View className="gap-half">
            <ThemedText type="smallMuted">Aktuelles Gewicht</ThemedText>
            <ThemedText type="headingSmall">{weight}</ThemedText>
          </View>
          <ThemedText type="captionCompact" themeColor="textSecondary">
            Neuester Eintrag
          </ThemedText>
        </View>

        <View className="profile-biometrics-facts-row profile-biometrics-facts-row-bordered">
          <View className="profile-biometrics-fact profile-biometrics-fact-bordered">
            <ThemedText type="captionCompact" themeColor="textSecondary">
              Größe
            </ThemedText>
            <ThemedText type="smallBold">{height}</ThemedText>
          </View>
          <View className="profile-biometrics-fact">
            <ThemedText type="captionCompact" themeColor="textSecondary">
              Geburtsdatum
            </ThemedText>
            <ThemedText type="smallBold">{birthDate}</ThemedText>
          </View>
        </View>

        <View className="profile-biometrics-facts-row">
          <View className="profile-biometrics-fact profile-biometrics-fact-bordered">
            <ThemedText type="captionCompact" themeColor="textSecondary">
              Berechnungsbasis
            </ThemedText>
            <ThemedText type="smallBold">{sex}</ThemedText>
          </View>
          <View className="profile-biometrics-fact">
            <ThemedText type="captionCompact" themeColor="textSecondary">
              Aktivität
            </ThemedText>
            <ThemedText type="smallBold">{activity}</ThemedText>
          </View>
        </View>
      </ThemedView>

      <ThemedText type="captionCompact" themeColor="textSecondary" className="px-one">
        Privat · im Verlauf gespeichert
      </ThemedText>
    </View>
  );
}
