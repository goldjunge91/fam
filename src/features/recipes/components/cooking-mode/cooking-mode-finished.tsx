import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { ThemedText } from '@/components/theme/themed-text';
import type { RecipeDetail } from '../../hooks/use-recipes';
import { RecipeRatingSheet } from '../recipe-rating-sheet';
import { CookingModeFinishAction } from './cooking-mode-finish-action';
import { CookingModeShell } from './cooking-mode-shell';

type CookingModeFinishedProps = {
  recipe: RecipeDetail['recipe'];
  onBack: () => void;
};

export function CookingModeFinished({ recipe, onBack }: CookingModeFinishedProps) {
  const [ratingOpen, setRatingOpen] = useState(false);

  return (
    <CookingModeShell title="Fertig" backLabel="Zurück zum letzten Schritt" onBack={onBack}>
      <ScrollView
        contentContainerClassName="flex-grow items-center px-four pt-[38px] pb-six"
        showsVerticalScrollIndicator={false}>
        <View className="w-[82px] h-[82px] rounded-fam-large bg-background-selected" />
        <ThemedText type="headingSmall" className="pt-[18px]">
          Guten Appetit!
        </ThemedText>
        <ThemedText
          type="detail"
          themeColor="textSecondary"
          className="pt-[6px] text-[10px] leading-[13px] font-medium text-center">
          Alles Weitere ist freiwillig und kann übersprungen werden.
        </ThemedText>

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

        <Pressable
          onPress={() => router.back()}
          role="button"
          className="mt-auto px-[10px] py-three">
          <ThemedText
            type="detail"
            themeColor="textSecondary"
            className="text-[10px] leading-[13px] font-medium">
            Ohne Angaben schließen
          </ThemedText>
        </Pressable>
      </ScrollView>

      <RecipeRatingSheet
        recipeId={recipe.id}
        visible={ratingOpen}
        onClose={() => setRatingOpen(false)}
      />
    </CookingModeShell>
  );
}
