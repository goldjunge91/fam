import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import { TextField } from '@/components/forms/text-field';
import { ThemedText } from '@/components/theme/themed-text';
import { ThemedView } from '@/components/theme/themed-view';
import { Button } from '@/components/ui/buttons';
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
        <ThemedView className="profile-food-rules-sheet">
          <View className="modal-handle" />
          <View className="profile-food-rules-sheet-header">
            <View className="flex-1 gap-half">
              <ThemedText type="headingSmall">Körper &amp; Aktivität</ThemedText>
              <ThemedText type="smallMuted">Persönliche Werte für deine Berechnungen</ThemedText>
            </View>
            <Pressable
              onPress={onClose}
              role="button"
              aria-label="Körper & Aktivität schließen"
              className="modal-close-btn">
              <ThemedText aria-hidden>✕</ThemedText>
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerClassName="gap-three pb-two">
            <ThemedView type="backgroundElement" className="profile-biometrics-weight-editor">
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
              <ThemedText type="captionCompact" themeColor="textSecondary">
                Eine Änderung wird als neuer privater Verlaufseintrag gespeichert.
              </ThemedText>
            </ThemedView>

            <ThemedText type="smallBold">Profilangaben</ThemedText>

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
              <ThemedText type="smallBold">Berechnungsbasis</ThemedText>
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
                      className={`flex-1 option-button ${
                        selected ? 'selectable-selected' : 'selectable-idle'
                      }`}>
                      <ThemedText
                        themeColor={selected ? 'onAccent' : 'text'}
                        className={selected ? '!text-on-accent' : ''}>
                        {option.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View className="gap-two" role="radiogroup" aria-label="Aktivitätslevel">
              <ThemedText type="smallBold">Aktivitätslevel</ThemedText>
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
                        className={`flex-1 option-button ${
                          selected ? 'selectable-selected' : 'selectable-idle'
                        }`}>
                        <ThemedText
                          type="smallBold"
                          themeColor={selected ? 'onAccent' : 'text'}
                          className={selected ? '!text-on-accent' : ''}>
                          {option.label}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>

          <Button label="Angaben übernehmen" onPress={handleApply} />
        </ThemedView>
      </View>
    </Modal>
  );
}
