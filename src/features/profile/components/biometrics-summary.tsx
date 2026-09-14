import { Pressable, View } from 'react-native';

import { Card, Txt } from '@/constants/ui';
import {
  ACTIVITY_OPTIONS,
  formatBirthDate,
  type ProfileBiometrics,
  SEX_OPTIONS,
} from '@/features/profile/domain/biometrics';
import { profileEditStyles } from '@/features/profile/profile-edit-styles';

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
    <Card style={profileEditStyles.biometricsCard}>
      <View style={profileEditStyles.biometricsHeader}>
        <Txt variant="body" weight="700">
          Körper &amp; Aktivität
        </Txt>
        <Pressable
          onPress={onPress}
          role="button"
          aria-label={`Körper & Aktivität bearbeiten. ${accessibleSummary}`}
          style={profileEditStyles.biometricsEdit}>
          <Txt variant="body" tone="primary" weight="700">
            Bearbeiten
          </Txt>
        </Pressable>
      </View>

      <View style={profileEditStyles.biometricsWeight}>
        <View style={profileEditStyles.biometricsWeightCopy}>
          <Txt variant="body" tone="secondary">
            Aktuelles Gewicht
          </Txt>
          <Txt variant="heading">{weight}</Txt>
        </View>
        <Txt variant="caption" tone="secondary">
          Neuester Eintrag
        </Txt>
      </View>

      <View
        style={[
          profileEditStyles.biometricsFactsRow,
          profileEditStyles.biometricsFactsRowBordered,
        ]}>
        <View style={[profileEditStyles.biometricsFact, profileEditStyles.biometricsFactBordered]}>
          <Txt variant="caption" tone="secondary">
            Größe
          </Txt>
          <Txt variant="body" weight="700">
            {height}
          </Txt>
        </View>
        <View style={profileEditStyles.biometricsFact}>
          <Txt variant="caption" tone="secondary">
            Geburtsdatum
          </Txt>
          <Txt variant="body" weight="700">
            {birthDate}
          </Txt>
        </View>
      </View>

      <View style={profileEditStyles.biometricsFactsRow}>
        <View style={[profileEditStyles.biometricsFact, profileEditStyles.biometricsFactBordered]}>
          <Txt variant="caption" tone="secondary">
            Berechnungsbasis
          </Txt>
          <Txt variant="body" weight="700">
            {sex}
          </Txt>
        </View>
        <View style={profileEditStyles.biometricsFact}>
          <Txt variant="caption" tone="secondary">
            Aktivität
          </Txt>
          <Txt variant="body" weight="700">
            {activity}
          </Txt>
        </View>
      </View>
      <Txt variant="caption" tone="secondary" style={profileEditStyles.privateNote}>
        Privat · im Verlauf gespeichert
      </Txt>
    </Card>
  );
}
