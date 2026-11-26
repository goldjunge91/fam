import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Card, Press, Txt } from '@/constants/ui';
import {
  formatBirthDate,
  getActivityLabel,
  getSexLabel,
  type ProfileBiometrics,
} from '@/features/profile/domain/biometrics';
import { profileEditStyles } from '@/features/profile/profile-edit-styles';

function formatNumber(value: number | null, unit: string, notSet: string, locale: string) {
  return value === null
    ? notSet
    : `${value.toLocaleString(locale, { maximumFractionDigits: 1 })} ${unit}`;
}

export function BiometricsSummary({
  value,
  onPress,
}: {
  value: ProfileBiometrics;
  onPress: () => void;
}) {
  const { t, i18n } = useTranslation();
  const notSet = t('profile.summary.notSet');
  const height = formatNumber(value.heightCm, 'cm', notSet, i18n.language);
  const weight = formatNumber(value.weightKg, 'kg', notSet, i18n.language);
  const birthDate = formatBirthDate(value.birthDate) ?? notSet;
  const sex = value.sex ? getSexLabel(t, value.sex) : notSet;
  const activity = value.activityLevel ? getActivityLabel(t, value.activityLevel) : notSet;
  const accessibleSummary = [height, weight, birthDate, sex, activity].join(', ');

  return (
    <Card style={profileEditStyles.biometricsCard}>
      <View style={profileEditStyles.biometricsHeader}>
        <Txt variant="body" weight="700">
          {t('profile.summary.bodyActivity')}
        </Txt>
        <Press
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={t('profile.summary.editSummary', {
            label: t('profile.summary.bodyActivity'),
            summary: accessibleSummary,
          })}
          style={profileEditStyles.biometricsEdit}>
          <Txt variant="body" tone="primary" weight="700">
            {t('profile.summary.edit')}
          </Txt>
        </Press>
      </View>

      <View style={profileEditStyles.biometricsWeight}>
        <View style={profileEditStyles.biometricsWeightCopy}>
          <Txt variant="body" tone="secondary">
            {t('profile.summary.profileWeight')}
          </Txt>
          <Txt variant="heading">{weight}</Txt>
        </View>
        <Txt variant="caption" tone="secondary">
          {t('profile.summary.oneTimeProfileValue')}
        </Txt>
      </View>

      <View
        style={[
          profileEditStyles.biometricsFactsRow,
          profileEditStyles.biometricsFactsRowBordered,
        ]}>
        <View style={[profileEditStyles.biometricsFact, profileEditStyles.biometricsFactBordered]}>
          <Txt variant="caption" tone="secondary">
            {t('profile.summary.height')}
          </Txt>
          <Txt variant="body" weight="700">
            {height}
          </Txt>
        </View>
        <View style={profileEditStyles.biometricsFact}>
          <Txt variant="caption" tone="secondary">
            {t('profile.summary.birthDate')}
          </Txt>
          <Txt variant="body" weight="700">
            {birthDate}
          </Txt>
        </View>
      </View>

      <View style={profileEditStyles.biometricsFactsRow}>
        <View style={[profileEditStyles.biometricsFact, profileEditStyles.biometricsFactBordered]}>
          <Txt variant="caption" tone="secondary">
            {t('profile.summary.calculationBasis')}
          </Txt>
          <Txt variant="body" weight="700">
            {sex}
          </Txt>
        </View>
        <View style={profileEditStyles.biometricsFact}>
          <Txt variant="caption" tone="secondary">
            {t('profile.summary.activity')}
          </Txt>
          <Txt variant="body" weight="700">
            {activity}
          </Txt>
        </View>
      </View>
      <Txt variant="caption" tone="secondary" style={profileEditStyles.privateNote}>
        {t('profile.summary.privateNote')}
      </Txt>
    </Card>
  );
}
