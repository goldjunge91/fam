import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';

import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';
import { useSession } from '@/features/auth/session-provider';
import { getRecipeRating, saveRecipeRating } from '../domain/recipe-ratings';
import { RecipeBottomSheet } from './recipe-bottom-sheet';

type Props = {
  recipeId: string;
  visible: boolean;
  onClose: () => void;
};

export function RecipeRatingSheet({ recipeId, visible, onClose }: Props) {
  const { colors } = useTheme();
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
      <Txt variant="body" tone="secondary" weight="500">
        Wie hat dir das Rezept gefallen?
      </Txt>

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
              className="recipe-score-btn"
              style={{ backgroundColor: isSelected ? colors.accent : colors.backgroundSoft }}>
              <Txt variant="label" tone={isSelected ? 'onAccent' : 'secondary'}>
                ★
              </Txt>
              <Txt variant="caption" tone={isSelected ? 'onAccent' : 'secondary'} weight="700">
                {value}
              </Txt>
            </Pressable>
          );
        })}
      </View>
      <Txt variant="caption" tone="primary" weight="700" className="pt-[10px]">
        {score > 0 ? `${score} / 10` : 'Noch keine Bewertung gewählt'}
      </Txt>

      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Optional: Was war besonders gut?"
        placeholderTextColor={colors.textMuted}
        multiline
        maxLength={500}
        textAlignVertical="top"
        className="recipe-rating-input"
        style={{ color: colors.text }}
      />

      <Pressable
        onPress={submit}
        disabled={score === 0 || saving}
        role="button"
        className="h-12 mt-[14px] rounded-card items-center justify-center active:opacity-75"
        style={{ backgroundColor: colors.accent, opacity: score === 0 || saving ? 0.45 : 1 }}>
        {saving ? (
          <ActivityIndicator color={colors.onAccent} />
        ) : (
          <Txt variant="caption" tone="onAccent" weight="700">
            Bewertung speichern
          </Txt>
        )}
      </Pressable>
    </RecipeBottomSheet>
  );
}
