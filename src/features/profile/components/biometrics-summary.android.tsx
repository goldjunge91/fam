import { Pressable, View } from 'react-native';

import { Surface, Txt } from '@/constants/ui';
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
        <Txt variant="body" weight="700">
          Körper &amp; Aktivität
        </Txt>
        <Pressable
          onPress={onPress}
          role="button"
          aria-label={`Körper & Aktivität bearbeiten. ${accessibleSummary}`}
          className="profile-section-edit">
          <Txt variant="body" tone="primary" weight="700">
            Bearbeiten
          </Txt>
        </Pressable>
      </View>

      <Surface tone="surface" className="profile-biometrics-summary">
        <View className="profile-biometrics-weight">
          <View className="gap-half">
            <Txt variant="body" tone="secondary">
              Aktuelles Gewicht
            </Txt>
            <Txt variant="heading">{weight}</Txt>
          </View>
          <Txt variant="caption" tone="secondary">
            Neuester Eintrag
          </Txt>
        </View>

        <View className="profile-biometrics-facts-row profile-biometrics-facts-row-bordered">
          <View className="profile-biometrics-fact profile-biometrics-fact-bordered">
            <Txt variant="caption" tone="secondary">
              Größe
            </Txt>
            <Txt variant="body" weight="700">
              {height}
            </Txt>
          </View>
          <View className="profile-biometrics-fact">
            <Txt variant="caption" tone="secondary">
              Geburtsdatum
            </Txt>
            <Txt variant="body" weight="700">
              {birthDate}
            </Txt>
          </View>
        </View>

        <View className="profile-biometrics-facts-row">
          <View className="profile-biometrics-fact profile-biometrics-fact-bordered">
            <Txt variant="caption" tone="secondary">
              Berechnungsbasis
            </Txt>
            <Txt variant="body" weight="700">
              {sex}
            </Txt>
          </View>
          <View className="profile-biometrics-fact">
            <Txt variant="caption" tone="secondary">
              Aktivität
            </Txt>
            <Txt variant="body" weight="700">
              {activity}
            </Txt>
          </View>
        </View>
      </Surface>

      <Txt variant="caption" tone="secondary" className="px-one">
        Privat · im Verlauf gespeichert
      </Txt>
    </View>
  );
}
