import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import { useTheme } from '@/components/theme/ThemeProvider';
import { Button, TextField, Txt } from '@/constants/ui';
import {
  ACTIVITY_OPTIONS,
  type ProfileBiometrics,
  type ProfileBiometricsDraft,
  profileBiometricsDraftSchema,
  SEX_OPTIONS,
  toProfileBiometricsDraft,
} from '@/features/profile/domain/biometrics';

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
  const { colors } = useTheme();
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
      <View className="profile-food-rules-sheet-backdrop">
        <View className="profile-food-rules-sheet" style={{ backgroundColor: colors.surface }}>
          <View className="modal-handle" />
          <View className="profile-food-rules-sheet-header">
            <View className="flex-1 gap-half">
              <Txt variant="heading">Körper &amp; Aktivität</Txt>
              <Txt variant="caption" tone="secondary">
                Persönliche Werte für deine Berechnungen
              </Txt>
            </View>
            <Pressable
              onPress={onClose}
              role="button"
              aria-label="Körper & Aktivität schließen"
              className="modal-close-btn">
              <Txt variant="body" tone="secondary" aria-hidden>
                ✕
              </Txt>
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerClassName="gap-three pb-two">
            <View
              className="profile-biometrics-weight-editor"
              style={{ backgroundColor: colors.backgroundSoft }}>
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
            </View>

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

            <View className="gap-two">
              <Txt variant="label" weight="700">
                Berechnungsbasis
              </Txt>
              <View className="input-row" role="radiogroup" aria-label="Berechnungsbasis">
                {SEX_OPTIONS.map((option) => {
                  const selected = draft.sex === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => updateDraft('sex', selected ? null : option.value)}
                      role="radio"
                      aria-checked={selected}
                      aria-label={option.label}
                      className="flex-1 option-button"
                      style={{
                        backgroundColor: selected ? colors.basil : colors.surface,
                        borderColor: selected ? colors.basil : colors.border,
                        borderWidth: 1,
                      }}>
                      <Txt tone={selected ? 'onAccent' : 'primary'} variant="body">
                        {option.label}
                      </Txt>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View className="gap-two" role="radiogroup" aria-label="Aktivitätslevel">
              <Txt variant="label" weight="700">
                Aktivitätslevel
              </Txt>
              {[
                ACTIVITY_OPTIONS.slice(0, 2),
                ACTIVITY_OPTIONS.slice(2, 4),
                ACTIVITY_OPTIONS.slice(4),
              ].map((row) => (
                <View key={row[0]?.value} className="input-row">
                  {row.map((option) => {
                    const selected = draft.activityLevel === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        onPress={() => updateDraft('activityLevel', selected ? null : option.value)}
                        role="radio"
                        aria-checked={selected}
                        aria-label={option.label}
                        className="flex-1 option-button"
                        style={{
                          backgroundColor: selected ? colors.basil : colors.surface,
                          borderColor: selected ? colors.basil : colors.border,
                          borderWidth: 1,
                        }}>
                        <Txt variant="label" tone={selected ? 'onAccent' : 'primary'} weight="700">
                          {option.label}
                        </Txt>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>

          <Button title="Angaben übernehmen" onPress={handleApply} />
        </View>
      </View>
    </Modal>
  );
}
