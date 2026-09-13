import { useEffect, useState } from 'react';
import { Modal, ScrollView, View } from 'react-native';

import { Button, CloseButton, Press, Surface, TextField, Txt } from '@/constants/ui';
import {
  ACTIVITY_OPTIONS,
  type ProfileBiometrics,
  type ProfileBiometricsDraft,
  profileBiometricsDraftSchema,
  SEX_OPTIONS,
  toProfileBiometricsDraft,
} from '@/features/profile/domain/biometrics';
import { biometricsSheetStyles } from '@/features/profile/sheets/biometrics-sheet-styles';

type DraftErrors = Partial<Record<keyof ProfileBiometricsDraft, string>>;

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
    if (!draft.weightKg.trim() && value.weightKg !== null) {
      setErrors({ weightKg: 'Ein bestehendes Gewicht kann hier nur überschrieben werden.' });
      return;
    }

    const parsed = profileBiometricsDraftSchema.safeParse(draft);
    if (!parsed.success) {
      const nextErrors: DraftErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === 'string' && field in draft) {
          nextErrors[field as keyof ProfileBiometricsDraft] ??= issue.message;
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
              <Txt variant="heading">Körper &amp; Aktivität</Txt>
              <Txt variant="caption" tone="secondary">
                Persönliche Werte für deine Berechnungen
              </Txt>
            </View>
            <CloseButton onPress={onClose} accessibilityLabel="Körper & Aktivität schließen" />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={biometricsSheetStyles.content}>
            <Surface tone="soft">
              <TextField
                label="Aktuelles Gewicht (kg)"
                value={draft.weightKg}
                onChangeText={(value) => updateDraft('weightKg', value)}
                placeholder="75"
                inputMode="decimal"
                keyboardType="decimal-pad"
                size="large"
                error={errors.weightKg}
              />
              <Txt variant="caption" tone="secondary">
                Eine Änderung wird als neuer privater Verlaufseintrag gespeichert.
              </Txt>
            </Surface>

            <Txt variant="label" weight="700">
              Profilangaben
            </Txt>

            <TextField
              label="Körpergröße (cm)"
              value={draft.heightCm}
              onChangeText={(value) => updateDraft('heightCm', value)}
              placeholder="178"
              inputMode="decimal"
              keyboardType="decimal-pad"
              error={errors.heightCm}
            />

            <TextField
              label="Geburtsdatum (TT.MM.JJJJ)"
              value={draft.birthDate}
              onChangeText={(value) => updateDraft('birthDate', value)}
              placeholder="15.05.1990"
              inputMode="numeric"
              keyboardType="number-pad"
              maxLength={10}
              error={errors.birthDate}
            />

            <View style={biometricsSheetStyles.group}>
              <Txt variant="label" weight="700">
                Berechnungsbasis
              </Txt>
              <View
                style={biometricsSheetStyles.inputRow}
                accessibilityRole="radiogroup"
                accessibilityLabel="Berechnungsbasis">
                {SEX_OPTIONS.map((option) => {
                  const selected = draft.sex === option.value;
                  return (
                    <Press
                      key={option.value}
                      onPress={() => updateDraft('sex', selected ? null : option.value)}
                      accessibilityRole="radio"
                      accessibilityLabel={option.label}
                      accessibilityState={{ selected }}
                      haptic="selection"
                      containerStyle={biometricsSheetStyles.optionContainer}
                      style={[
                        biometricsSheetStyles.option,
                        selected
                          ? biometricsSheetStyles.optionSelected
                          : biometricsSheetStyles.optionIdle,
                      ]}>
                      <Txt tone={selected ? 'onAccent' : 'primary'} variant="body">
                        {option.label}
                      </Txt>
                    </Press>
                  );
                })}
              </View>
            </View>

            <View
              style={biometricsSheetStyles.group}
              accessibilityRole="radiogroup"
              accessibilityLabel="Aktivitätslevel">
              <Txt variant="label" weight="700">
                Aktivitätslevel
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
                        accessibilityLabel={option.label}
                        accessibilityState={{ selected }}
                        haptic="selection"
                        containerStyle={biometricsSheetStyles.optionContainer}
                        style={[
                          biometricsSheetStyles.option,
                          selected
                            ? biometricsSheetStyles.optionSelected
                            : biometricsSheetStyles.optionIdle,
                        ]}>
                        <Txt variant="label" tone={selected ? 'onAccent' : 'primary'} weight="700">
                          {option.label}
                        </Txt>
                      </Press>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>

          <Button title="Angaben übernehmen" onPress={handleApply} />
        </Surface>
      </View>
    </Modal>
  );
}
