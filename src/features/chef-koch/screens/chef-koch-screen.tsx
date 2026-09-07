import { type ReactNode, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';

import { Screen, ScreenHeader } from '@/components/layout/screen';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Button } from '@/components/ui/buttons';
import { Row, Surface, Txt } from '@/constants/ui';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { useInventoryItems } from '@/features/inventory/use-inventory-items';
import { RecipeSuggestionGatewayError } from '@/features/recipes/data/recipe-suggestion-gateway';
import { useApplyRecipeSuggestionCookReviewMutation } from '@/features/recipes/data/use-recipe-suggestion-cook-review';
import { useRecipeSuggestions } from '@/features/recipes/data/use-recipe-suggestions';
import {
  confirmRecipeSuggestionCookReview,
  createRecipeSuggestionCookReview,
  type RecipeSuggestionCookReview,
  updateRecipeSuggestionCookReviewEntry,
} from '@/features/recipes/domain/recipe-suggestion-cook-review';
import { createRecipeSuggestionReview } from '@/features/recipes/domain/recipe-suggestion-review';

function ChefAvatar() {
  const { colors } = useTheme();
  return (
    <View
      accessibilityLabel="Chef-Koch Geist"
      style={{
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: colors.backgroundSoft,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: colors.accent,
      }}>
      <Txt variant="title" tone="accent" accessibilityLabel="Geist">
        ◡
      </Txt>
    </View>
  );
}

function ChefMessage({ children }: { children: ReactNode }) {
  return (
    <Row align="flex-start" gap={12}>
      <ChefAvatar />
      <Surface tone="soft" style={{ flex: 1, borderTopLeftRadius: 4 }}>
        <Txt>{children}</Txt>
      </Surface>
    </Row>
  );
}

export function ChefKochScreen() {
  const { colors } = useTheme();
  const { activeHouseholdId } = useActiveHousehold();
  const { data: inventory = [] } = useInventoryItems(activeHouseholdId ?? undefined);
  const suggestion = useRecipeSuggestions();
  const cookMutation = useApplyRecipeSuggestionCookReviewMutation();
  const [userText, setUserText] = useState('Was soll ich heute kochen?');
  const [shoppingDecision, setShoppingDecision] = useState<'yes' | 'no' | null>(null);
  const [cookReview, setCookReview] = useState<RecipeSuggestionCookReview | null>(null);

  function askChef(nextShoppingDecision = shoppingDecision) {
    if (!activeHouseholdId || userText.trim().length === 0) return;
    setCookReview(null);
    suggestion.mutate({
      householdId: activeHouseholdId,
      userText: userText.trim(),
      servings: 2,
      maxMinutes: null,
      dietaryPattern: null,
      shoppingDecision: nextShoppingDecision,
    });
  }

  const review = suggestion.data?.result
    ? createRecipeSuggestionReview(suggestion.data.result)
    : null;
  const suggestionError = suggestion.error;
  const gatewayErrorMessages: Record<string, string> = {
    llm_temporarily_disabled:
      'Die KI-Vorschläge sind vorübergehend pausiert. Katalogrezepte bleiben verfügbar.',
    no_safe_recipe:
      'Ich finde gerade keinen sicheren Vorschlag für euren Bestand. Prüfe bitte die hinterlegten Lebensmittel.',
    rate_limited: 'Zu viele KI-Anfragen. Bitte kurz warten.',
    ai_credit_limit_exceeded: 'Dein KI-Kontingent ist aufgebraucht.',
    ai_entitlement_required: 'Für diese KI-Funktion ist kein aktives KI-Kontingent verfügbar.',
  };
  const userFacingErrorMessage =
    suggestionError instanceof RecipeSuggestionGatewayError
      ? (gatewayErrorMessages[suggestionError.remoteCode ?? ''] ??
        'Ich konnte gerade keinen Vorschlag laden.')
      : 'Ich konnte gerade keinen Vorschlag laden.';
  const developerErrorDetails =
    __DEV__ && suggestionError instanceof RecipeSuggestionGatewayError
      ? ` (${suggestionError.code}${suggestionError.status === null ? '' : `, HTTP ${suggestionError.status}`}${suggestionError.remoteCode === null ? '' : `, ${suggestionError.remoteCode}`})`
      : '';

  function openCookReview(mealIndex: number) {
    if (!review) return;
    const nextReview = createRecipeSuggestionCookReview(review, mealIndex);
    if (nextReview) setCookReview(nextReview);
  }

  function confirmCooked() {
    if (!activeHouseholdId || !cookReview) return;
    const confirmedReview = confirmRecipeSuggestionCookReview(cookReview);
    setCookReview(confirmedReview);
    cookMutation.mutate(
      {
        householdId: activeHouseholdId,
        review: confirmedReview,
        inventory: inventory.map((item) => ({
          id: item.id,
          householdId: item.household_id,
          quantity: item.quantity,
          unit: item.unit,
        })),
      },
      {
        onError: () => setCookReview(cookReview),
      },
    );
  }

  return (
    <Screen scroll={false} padded={false} applyBottomPadding={false} contentStyle={{ flex: 1 }}>
      <ScreenHeader title="Chef-Koch" subtitle="Dein Küchengeist für heute" back />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}>
        <ScrollView
          contentContainerStyle={{ gap: 16, paddingHorizontal: 16, paddingBottom: 20 }}
          keyboardShouldPersistTaps="handled">
          <ChefMessage>
            Ich schaue in euren Haushaltsbestand und suche passende Mahlzeiten. Was möchtest du
            heute kochen?
          </ChefMessage>

          {suggestion.isPending ? (
            <ChefMessage>Ich prüfe gerade euren Bestand …</ChefMessage>
          ) : null}

          {suggestion.isError ? (
            <Surface tone="soft">
              <Txt tone="danger">
                {userFacingErrorMessage}
                {developerErrorDetails}
              </Txt>
              <Button
                label="Erneut versuchen"
                variant="secondary"
                onPress={askChef}
                style={{ marginTop: 12 }}
              />
            </Surface>
          ) : null}

          {suggestion.data?.shoppingQuestion ? (
            <Surface tone="soft">
              <Txt>{suggestion.data.shoppingQuestion}</Txt>
              <Row gap={8} style={{ marginTop: 12 }}>
                <Button
                  label="Ja, heute"
                  size="compact"
                  onPress={() => {
                    setShoppingDecision('yes');
                    askChef('yes');
                  }}
                />
                <Button
                  label="Nein"
                  size="compact"
                  variant="secondary"
                  onPress={() => {
                    setShoppingDecision('no');
                    askChef('no');
                  }}
                />
              </Row>
            </Surface>
          ) : null}

          {review?.meals.map((meal, mealIndex) => (
            <Surface
              key={`${meal.source}-${meal.title}`}
              tone="surface"
              style={{ borderWidth: 1, borderColor: colors.border }}>
              <Txt variant="caption" tone="accent" weight="700">
                {meal.sourceLabel}
              </Txt>
              <Txt variant="title" style={{ marginTop: 4 }}>
                {meal.title}
              </Txt>
              <Txt variant="caption" tone="secondary" style={{ marginTop: 4 }}>
                {meal.servings} Portionen
              </Txt>
              <View style={{ marginTop: 12 }}>
                {meal.usedItems.map((item) => {
                  const inventoryItem = inventory.find(
                    (entry) => entry.id === item.inventory_item_id,
                  );
                  return (
                    <Row
                      key={item.inventory_item_id}
                      justify="space-between"
                      style={{ paddingVertical: 5 }}>
                      <Txt>{inventoryItem?.name ?? 'Lebensmittel'}</Txt>
                      <Txt tone="secondary">
                        {item.quantity} {item.unit}
                      </Txt>
                    </Row>
                  );
                })}
              </View>
              {meal.additionalIngredients.length > 0 ? (
                <Txt tone="warning" variant="caption" style={{ marginTop: 8 }}>
                  Noch zu besorgen: {meal.additionalIngredients.join(', ')}
                </Txt>
              ) : null}
              <Row gap={8} style={{ marginTop: 14 }}>
                <Button
                  label="Rezept speichern"
                  variant="secondary"
                  size="compact"
                  onPress={() => undefined}
                />
                <Button label="Kochen" size="compact" onPress={() => openCookReview(mealIndex)} />
              </Row>
            </Surface>
          ))}

          {cookReview ? (
            <ChefMessage>
              „{cookReview.meal.title}“ ist ausgewählt. Prüfe bitte die tatsächlich verwendeten
              Mengen. Der Bestand bleibt bis zur Bestätigung unverändert.
            </ChefMessage>
          ) : null}

          {cookReview ? (
            <Surface tone="soft">
              <Txt variant="title">Bestands-Review</Txt>
              <Txt tone="secondary" style={{ marginTop: 4 }}>
                Ändere Mengen oder wähle Lebensmittel ab. Noch wurde nichts verbucht.
              </Txt>
              {cookReview.entries.map((entry) => {
                const inventoryItem = inventory.find((item) => item.id === entry.inventoryItemId);
                return (
                  <Row key={entry.inventoryItemId} gap={8} style={{ marginTop: 12 }}>
                    <Pressable
                      onPress={() =>
                        setCookReview(
                          updateRecipeSuggestionCookReviewEntry(cookReview, entry.inventoryItemId, {
                            included: !entry.included,
                          }),
                        )
                      }
                      accessibilityRole="checkbox"
                      accessibilityLabel={`${inventoryItem?.name ?? 'Lebensmittel'} verwenden`}
                      accessibilityState={{ checked: entry.included }}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        borderWidth: 2,
                        borderColor: colors.accent,
                        backgroundColor: entry.included ? colors.accent : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      {entry.included ? <Txt tone="onAccent">✓</Txt> : null}
                    </Pressable>
                    <Txt style={{ flex: 1 }}>{inventoryItem?.name ?? 'Lebensmittel'}</Txt>
                    <TextInput
                      value={Number.isFinite(entry.quantity) ? String(entry.quantity) : ''}
                      onChangeText={(value) =>
                        setCookReview(
                          updateRecipeSuggestionCookReviewEntry(cookReview, entry.inventoryItemId, {
                            quantity: Number.parseFloat(value),
                          }),
                        )
                      }
                      keyboardType="decimal-pad"
                      accessibilityLabel={`Menge ${inventoryItem?.name ?? 'Lebensmittel'}`}
                      style={{
                        width: 70,
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 8,
                        padding: 7,
                        color: colors.text,
                        textAlign: 'right',
                      }}
                    />
                    <Txt tone="secondary">{entry.unit}</Txt>
                  </Row>
                );
              })}
              <Txt tone="warning" variant="caption" style={{ marginTop: 14 }}>
                Nur diese Bestätigung führt den Verbrauchsplan aus.
              </Txt>
              {cookMutation.isError ? (
                <Txt tone="danger" variant="caption" style={{ marginTop: 8 }}>
                  Der Bestand hat sich geändert. Bitte Review prüfen und erneut bestätigen.
                </Txt>
              ) : null}
              {cookMutation.isSuccess ? (
                <Txt tone="success" variant="caption" style={{ marginTop: 8 }}>
                  Verbrauch bestätigt. Der Bestand wurde aktualisiert.
                </Txt>
              ) : null}
              <Button
                label="Gekocht bestätigen"
                loading={cookMutation.isPending}
                disabled={cookReview.status !== 'pending_confirmation'}
                onPress={confirmCooked}
                style={{ marginTop: 14 }}
              />
            </Surface>
          ) : null}
        </ScrollView>

        <View
          style={{
            flexDirection: 'row',
            gap: 8,
            alignItems: 'flex-end',
            padding: 16,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}>
          <TextInput
            value={userText}
            onChangeText={setUserText}
            placeholder="Sag mir, worauf du Lust hast …"
            placeholderTextColor={colors.textSecondary}
            accessibilityLabel="Nachricht an Chef-Koch"
            style={{
              flex: 1,
              minHeight: 46,
              maxHeight: 100,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 10,
              color: colors.text,
            }}
            multiline
          />
          <Pressable
            onPress={() => askChef()}
            disabled={suggestion.isPending || !activeHouseholdId}
            accessibilityRole="button"
            accessibilityLabel="Nachricht senden"
            accessibilityState={{ disabled: suggestion.isPending || !activeHouseholdId }}
            style={{
              width: 46,
              height: 46,
              borderRadius: 23,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.accent,
              opacity: suggestion.isPending || !activeHouseholdId ? 0.5 : 1,
            }}>
            <Txt tone="onAccent" variant="title">
              ↑
            </Txt>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
