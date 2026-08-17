import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { getRecipeRating, saveRecipeRating } from '../recipe-ratings';

type Props = {
  recipeId: string;
  visible: boolean;
  onClose: () => void;
};

export function RecipeRatingSheet({ recipeId, visible, onClose }: Props) {
  const theme = useTheme();
  const [score, setScore] = useState(0);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    getRecipeRating(recipeId).then((rating) => {
      if (!active || !rating) return;
      setScore(rating.score);
      setNote(rating.note);
    });
    return () => {
      active = false;
    };
  }, [recipeId, visible]);

  async function submit() {
    if (score === 0) return;
    setSaving(true);
    try {
      await saveRecipeRating(recipeId, score, note);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="slide"
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
        className="flex-1">
        <Pressable className="flex-1 justify-end bg-[#261f27]/30" onPress={onClose}>
          <Pressable className="recipe-rating-sheet" onPress={(event) => event.stopPropagation()}>
            <View className="modal-handle" />
            <View className="min-h-[58px] pt-[13px] flex-row items-center justify-between gap-three">
              <ThemedText type="headingSmall" className="flex-1">
                Rezept bewerten
              </ThemedText>
              <Pressable
                onPress={onClose}
                role="button"
                aria-label="Schließen"
                className="w-8 h-8 rounded-control items-center justify-center bg-background-selected">
                <ThemedText themeColor="accent" className="text-[18px] leading-[20px] font-medium">
                  ×
                </ThemedText>
              </Pressable>
            </View>
            <ThemedText type="detail" themeColor="textSecondary" className="font-medium">
              Wie hat dir das Rezept gefallen?
            </ThemedText>

            <View className="flex-row flex-wrap gap-[7px] pt-[14px]">
              {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => {
                const isSelected = score === value;
                return (
                  <Pressable
                    key={value}
                    onPress={() => setScore(value)}
                    role="button"
                    aria-label={`${value} von 10 Sternen`}
                    accessibilityState={{ selected: isSelected }}
                    className={`recipe-score-btn ${
                      isSelected ? 'bg-accent' : 'bg-background-selected'
                    }`}>
                    <ThemedText
                      className={`text-[14px] leading-[17px] ${
                        isSelected ? 'text-white' : 'text-accent'
                      }`}>
                      ★
                    </ThemedText>
                    <ThemedText
                      type="detail"
                      className={`text-[9px] leading-[11px] font-bold ${
                        isSelected ? 'text-white' : 'text-text-secondary'
                      }`}>
                      {value}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
            <ThemedText type="detail" themeColor="accent" className="pt-[10px] font-bold">
              {score > 0 ? `${score} / 10` : 'Noch keine Bewertung gewählt'}
            </ThemedText>

            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Optional: Was war besonders gut?"
              placeholderTextColor={theme.textSecondary}
              multiline
              maxLength={500}
              textAlignVertical="top"
              className="recipe-rating-input"
            />

            <Pressable
              onPress={submit}
              disabled={score === 0 || saving}
              role="button"
              className={`h-12 mt-[14px] rounded-card items-center justify-center bg-accent active:opacity-75 ${
                score === 0 || saving ? 'opacity-45' : ''
              }`}>
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <ThemedText type="captionCompact" className="text-white font-bold">
                  Bewertung speichern
                </ThemedText>
              )}
            </Pressable>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
