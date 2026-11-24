import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { rs } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Press, TextField, Txt } from '@/constants/ui';
import { useSession } from '@/features/auth/session-provider';
import { getRecipeRating, saveRecipeRating } from '../domain/recipe-ratings';
import { RecipeBottomSheet } from './recipe-bottom-sheet';

type Props = {
  recipeId: string;
  visible: boolean;
  onClose: () => void;
};

const styles = StyleSheet.create((theme) => ({
  scoreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.md,
    paddingTop: theme.space.lg,
  },
  scoreButton: {
    width: '18%',
    minWidth: rs(52),
    height: rs(50),
    borderRadius: theme.radius.famLarge,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space.xs,
  },
  scoreHint: {
    paddingTop: theme.space.md,
  },
  noteContainer: {
    marginTop: theme.space.lg,
  },
  noteInput: {
    minHeight: rs(92),
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
  },
  submitContainer: {
    alignSelf: 'stretch',
    marginTop: theme.space.lg,
  },
  submit: {
    height: theme.controlSizes.touchTarget,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

export function RecipeRatingSheet({ recipeId, visible, onClose }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
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
    <RecipeBottomSheet
      visible={visible}
      onClose={onClose}
      title={t('recipes.rating.title')}
      avoidKeyboard>
      <Txt variant="body" tone="secondary" weight="500">
        {t('recipes.rating.question')}
      </Txt>

      <View style={styles.scoreRow}>
        {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => {
          const isSelected = score === value;
          return (
            <Press
              key={value}
              onPress={() => setScore(value)}
              accessibilityRole="button"
              accessibilityLabel={t('recipes.rating.stars', { score: value })}
              accessibilityState={{ selected: isSelected }}
              style={[
                styles.scoreButton,
                { backgroundColor: isSelected ? colors.accent : colors.backgroundSoft },
              ]}>
              <Txt variant="label" tone={isSelected ? 'onAccent' : 'secondary'}>
                ★
              </Txt>
              <Txt variant="caption" tone={isSelected ? 'onAccent' : 'secondary'} weight="700">
                {value}
              </Txt>
            </Press>
          );
        })}
      </View>
      <Txt variant="caption" tone="primary" weight="700" style={styles.scoreHint}>
        {score > 0 ? t('recipes.rating.stars', { score }) : t('recipes.rating.notSelected')}
      </Txt>

      <View style={styles.noteContainer}>
        <TextField
          accessibilityLabel={t('recipes.rating.noteLabel')}
          value={note}
          onChangeText={setNote}
          placeholder={t('recipes.rating.notePlaceholder')}
          multiline
          maxLength={500}
          textAlignVertical="top"
          style={styles.noteInput}
        />
      </View>

      <Press
        onPress={submit}
        disabled={score === 0 || saving}
        accessibilityRole="button"
        containerStyle={styles.submitContainer}
        style={[
          styles.submit,
          { backgroundColor: colors.accent, opacity: score === 0 || saving ? 0.45 : 1 },
        ]}>
        {saving ? (
          <ActivityIndicator color={colors.onAccent} />
        ) : (
          <Txt variant="caption" tone="onAccent" weight="700">
            {t('recipes.rating.save')}
          </Txt>
        )}
      </Press>
    </RecipeBottomSheet>
  );
}
