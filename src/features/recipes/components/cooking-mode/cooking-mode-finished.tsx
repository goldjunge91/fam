import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { useTheme } from '@/components/theme/ThemeProvider';
import { Press, Txt } from '@/constants/ui';
import type { RecipeDetail } from '../../hooks/use-recipes';
import { RecipeRatingSheet } from '../recipe-rating-sheet';
import { CookingModeFinishAction } from './cooking-mode-finish-action';
import { CookingModeShell } from './cooking-mode-shell';

type CookingModeFinishedProps = {
  recipe: RecipeDetail['recipe'];
  onBack: () => void;
  isCatalog?: boolean;
};

const styles = StyleSheet.create((theme) => ({
  content: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: theme.space.xxl,
    paddingTop: theme.space.xxxl,
    paddingBottom: theme.space.xxxl,
  },
  artwork: {
    width: 82,
    height: 82,
    borderRadius: theme.radius.famLarge,
  },
  title: {
    paddingTop: theme.space.xl,
  },
  hint: {
    paddingTop: theme.space.md,
  },
  actions: {
    width: '100%',
    gap: theme.space.sm,
    paddingTop: theme.space.xxxl,
  },
  close: {
    marginTop: 'auto',
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.lg,
  },
}));

export function CookingModeFinished({
  recipe,
  onBack,
  isCatalog = false,
}: CookingModeFinishedProps) {
  const [ratingOpen, setRatingOpen] = useState(false);
  const { colors } = useTheme();

  return (
    <CookingModeShell title="Fertig" backLabel="Zurück zum letzten Schritt" onBack={onBack}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.artwork, { backgroundColor: colors.backgroundSoft }]} />
        <Txt variant="heading" style={styles.title}>
          Guten Appetit!
        </Txt>
        <Txt variant="caption" tone="secondary" center style={styles.hint}>
          Alles Weitere ist freiwillig und kann übersprungen werden.
        </Txt>

        {!isCatalog ? (
          <View style={styles.actions}>
            <CookingModeFinishAction
              title="Zubereitete Gruppen wiegen"
              subtitle="Werte im eigenen Rezept verbessern"
              onPress={() =>
                router.push({
                  pathname: '/recipe/log',
                  params: { id: recipe.id, mode: 'weigh' },
                })
              }
            />
            <CookingModeFinishAction
              title="Ins Tagebuch eintragen"
              subtitle="Portionsmengen getrennt anpassen"
              onPress={() => router.push({ pathname: '/recipe/log', params: { id: recipe.id } })}
            />
            <CookingModeFinishAction
              title="Rezept bewerten"
              subtitle="1–10 Sterne und optionaler Text"
              onPress={() => setRatingOpen(true)}
            />
          </View>
        ) : null}

        <Press onPress={() => router.back()} role="button" style={styles.close}>
          <Txt variant="caption" tone="secondary">
            Ohne Angaben schließen
          </Txt>
        </Press>
      </ScrollView>

      {!isCatalog ? (
        <RecipeRatingSheet
          recipeId={recipe.id}
          visible={ratingOpen}
          onClose={() => setRatingOpen(false)}
        />
      ) : null}
    </CookingModeShell>
  );
}
