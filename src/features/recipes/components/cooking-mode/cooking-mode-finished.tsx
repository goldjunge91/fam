import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';
import type { RecipeDetail } from '../../hooks/use-recipes';
import { RecipeRatingSheet } from '../recipe-rating-sheet';
import { CookingModeFinishAction } from './cooking-mode-finish-action';
import { CookingModeShell } from './cooking-mode-shell';

type CookingModeFinishedProps = {
  recipe: RecipeDetail['recipe'];
  onBack: () => void;
  isCatalog?: boolean;
};

export function CookingModeFinished({
  recipe,
  onBack,
  isCatalog = false,
}: CookingModeFinishedProps) {
  const [ratingOpen, setRatingOpen] = useState(false);
  const { colors } = useTheme();

  return (
    <CookingModeShell title="Fertig" backLabel="Zurück zum letzten Schritt" onBack={onBack}>
      <ScrollView
        contentContainerClassName="flex-grow items-center px-four pt-[38px] pb-six"
        showsVerticalScrollIndicator={false}>
        <View
          className="w-[82px] h-[82px] rounded-fam-large"
          style={{ backgroundColor: colors.surfaceSoft }}
        />
        <Txt variant="heading" className="pt-[18px]">
          Guten Appetit!
        </Txt>
        <Txt
          variant="caption"
          tone="secondary"
          center
          className="pt-[6px]"
          style={{ fontSize: 10, lineHeight: 13 }}>
          Alles Weitere ist freiwillig und kann übersprungen werden.
        </Txt>

        {!isCatalog ? (
          <View className="w-full gap-two pt-six">
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

        <Pressable
          onPress={() => router.back()}
          role="button"
          className="mt-auto px-[10px] py-three">
          <Txt variant="caption" tone="secondary" style={{ fontSize: 10, lineHeight: 13 }}>
            Ohne Angaben schließen
          </Txt>
        </Pressable>
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
