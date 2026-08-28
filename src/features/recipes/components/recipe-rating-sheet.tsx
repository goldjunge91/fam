import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/theme/themed-text';
import { useSession } from '@/features/auth/session-provider';
import { useTheme } from '@/hooks/use-theme';
import { getRecipeRating, saveRecipeRating } from '../domain/recipe-ratings';
import { RecipeBottomSheet } from './recipe-bottom-sheet';

type Props = {
  recipeId: string;
  visible: boolean;
  onClose: () => void;
};

export function RecipeRatingSheet({ recipeId, visible, onClose }: Props) {
  const theme = useTheme();
  const { session } = useSession();
  const userId = session?.user.id;
  const [score, setScore] = useState(0);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setScore(0);
    setNote('');
    if (!visible || !userId) return;
    let active = true;
    void getRecipeRating(userId, recipeId)
      .then((rating) => {
        if (!active || !rating) return;
        setScore(rating.score);
        setNote(rating.note);
      })
      .catch(() => {
        // Logout und DB-Cleanup dürfen einen bereits gestarteten UI-Read
        // abbrechen. Der leere Zustand oben bleibt dabei autoritativ.
      });
    return () => {
      active = false;
    };
  }, [recipeId, userId, visible]);

  async function submit() {
    if (score === 0 || !userId) return;
    setSaving(true);
    try {
      await saveRecipeRating(userId, recipeId, score, note);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <RecipeBottomSheet visible={visible} onClose={onClose} title="Rezept bewerten" avoidKeyboard>
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
              className={`recipe-score-btn ${isSelected ? 'bg-accent' : 'bg-background-selected'}`}>
              <ThemedText
                className={`text-[14px] leading-[17px] ${isSelected ? 'text-white' : 'text-accent'}`}>
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
    </RecipeBottomSheet>
  );
}
