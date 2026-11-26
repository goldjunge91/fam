import type { TFunction } from 'i18next';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ScrollView, View } from 'react-native';

import { Button, CloseButton, Press, Surface, TextField, Txt } from '@/constants/ui';
import {
  ACTIVITY_OPTIONS,
  getActivityLabel,
  getSexLabel,
  type ProfileBiometrics,
  type ProfileBiometricsDraft,
  profileBiometricsDraftSchema,
  SEX_OPTIONS,
  toProfileBiometricsDraft,
} from '@/features/profile/domain/biometrics';
import { biometricsSheetStyles } from '@/features/profile/sheets/biometrics-sheet-styles';

type DraftErrors = Partial<Record<keyof ProfileBiometricsDraft, string>>;

function translateBiometricsError(t: TFunction, message: string): string {
  switch (message) {
    case 'Bitte eine verlässliche Größe unter 300 cm eingeben.':
      return t('profile.validation.invalidHeight');
    case 'Bitte ein verlässliches Gewicht von 20–300 kg eingeben.':
      return t('profile.validation.invalidWeight');
    case 'Bitte als TT.MM.JJJJ eingeben.':
      return t('profile.validation.invalidBirthDate');
    case 'Das Geburtsdatum kann nicht in der Zukunft liegen.':
      return t('profile.validation.futureBirthDate');
    default:
      return message;
  }
}

export function BiometricsSheet({
  visible,
  value,
  onApply,
  onClose,
}: {
  visible: boolean;
  value: ProfileBiometrics;
  onApply: (value: ProfileBiometrics) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<ProfileBiometricsDraft>(() => toProfileBiometricsDraft(value));
  const [errors, setErrors] = useState<DraftErrors>({});

  useEffect(() => {
    if (!visible) return;
    setDraft(toProfileBiometricsDraft(value));
    setErrors({});
  }, [value, visible]);

  function updateDraft<Key extends keyof ProfileBiometricsDraft>(
    key: Key,
    nextValue: ProfileBiometricsDraft[Key],
  ) {
    setDraft((current) => ({ ...current, [key]: nextValue }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function handleApply() {
    const parsed = profileBiometricsDraftSchema.safeParse(draft);
    if (!parsed.success) {
      const nextErrors: DraftErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === 'string' && field in draft) {
          nextErrors[field as keyof ProfileBiometricsDraft] ??= translateBiometricsError(
            t,
            issue.message,
          );
        }
      }
      setErrors(nextErrors);
      return;
    }

    onApply(parsed.data);
    onClose();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}>
      <View style={biometricsSheetStyles.backdrop}>
        <Surface tone="surface" style={biometricsSheetStyles.sheet}>
          <View style={biometricsSheetStyles.handle} />
          <View style={biometricsSheetStyles.header}>
            <View style={biometricsSheetStyles.headerCopy}>
              <Txt variant="heading">{t('profile.biometrics.title')}</Txt>
              <Txt variant="caption" tone="secondary">
                {t('profile.biometrics.hint')}
              </Txt>
            </View>
            <CloseButton onPress={onClose} accessibilityLabel={t('profile.biometrics.close')} />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={biometricsSheetStyles.content}>
            <Txt variant="label" weight="700">
              {t('profile.biometrics.profileData')}
            </Txt>

            <Surface tone="soft">
              <TextField
                label={t('profile.biometrics.weight')}
                value={draft.weightKg}
                onChangeText={(value) => updateDraft('weightKg', value)}
                placeholder={t('profile.biometrics.weightPlaceholder')}
                inputMode="decimal"
                keyboardType="decimal-pad"
                size="large"
                error={errors.weightKg}
              />
              <Txt variant="caption" tone="secondary">
                {t('profile.biometrics.weightHint')}
              </Txt>
            </Surface>

            <TextField
              label={t('profile.biometrics.height')}
              value={draft.heightCm}
              onChangeText={(value) => updateDraft('heightCm', value)}
              placeholder={t('profile.biometrics.heightPlaceholder')}
              inputMode="decimal"
              keyboardType="decimal-pad"
              error={errors.heightCm}
            />

            <TextField
              label={t('profile.biometrics.birthDate')}
              value={draft.birthDate}
              onChangeText={(value) => updateDraft('birthDate', value)}
              placeholder={t('profile.biometrics.birthDatePlaceholder')}
              inputMode="numeric"
              keyboardType="number-pad"
              maxLength={10}
              error={errors.birthDate}
            />

            <View style={biometricsSheetStyles.group}>
              <Txt variant="label" weight="700">
                {t('profile.biometrics.basis')}
              </Txt>
              <View
                style={biometricsSheetStyles.inputRow}
                accessibilityRole="radiogroup"
                accessibilityLabel={t('profile.biometrics.basis')}>
                {SEX_OPTIONS.map((option) => {
                  const selected = draft.sex === option.value;
                  return (
                    <Press
                      key={option.value}
                      onPress={() => updateDraft('sex', selected ? null : option.value)}
                      accessibilityRole="radio"
                      accessibilityLabel={getSexLabel(t, option.value)}
                      accessibilityState={{ selected }}
                      selected={selected}
                      haptic="selection"
                      containerStyle={biometricsSheetStyles.optionContainer}
                      style={biometricsSheetStyles.option}>
                      <Txt tone="primary" variant="body">
                        {getSexLabel(t, option.value)}
                      </Txt>
                    </Press>
                  );
                })}
              </View>
            </View>

            <View
              style={biometricsSheetStyles.group}
              accessibilityRole="radiogroup"
              accessibilityLabel={t('profile.biometrics.activityLevel')}>
              <Txt variant="label" weight="700">
                {t('profile.biometrics.activityLevel')}
              </Txt>
              {[
                ACTIVITY_OPTIONS.slice(0, 2),
                ACTIVITY_OPTIONS.slice(2, 4),
                ACTIVITY_OPTIONS.slice(4),
              ].map((row) => (
                <View key={row[0]?.value} style={biometricsSheetStyles.inputRow}>
                  {row.map((option) => {
                    const selected = draft.activityLevel === option.value;
                    return (
                      <Press
                        key={option.value}
                        onPress={() => updateDraft('activityLevel', selected ? null : option.value)}
                        accessibilityRole="radio"
                        accessibilityLabel={getActivityLabel(t, option.value)}
                        accessibilityState={{ selected }}
                        selected={selected}
                        haptic="selection"
                        containerStyle={biometricsSheetStyles.optionContainer}
                        style={biometricsSheetStyles.option}>
                        <Txt variant="label" tone="primary" weight="700">
                          {getActivityLabel(t, option.value)}
                        </Txt>
                      </Press>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>

          <Button title={t('profile.biometrics.apply')} onPress={handleApply} />
        </Surface>
      </View>
    </Modal>
  );
}
