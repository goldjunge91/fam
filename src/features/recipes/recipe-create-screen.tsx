import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useSession } from '@/features/auth/session-provider';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { persistOffProductIfNeeded } from '@/features/inventory/persist-off-product';
import { ProductSearchDropdown } from '@/features/inventory/product-search-dropdown';
import { useAddProductMutation } from '@/features/inventory/use-product-mutations';
import type { OpenFoodFactsProduct } from '@/lib/open-food-facts';

import { PublishModal } from './publish-modal';
import { pickRecipeCoverImage, uploadRecipeCoverImage } from './recipe-cover';
import {
  type DietaryTag,
  type Difficulty,
  type DishType,
  useAddComponentMutation,
  useAddItemMutation,
  useAddRecipeMutation,
  useRecipeDetail,
  useUpdateRecipeMutation,
} from './use-recipes';

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Einfach' },
  { value: 'medium', label: 'Mittel' },
  { value: 'hard', label: 'Schwer' },
];

const DISH_TYPES: { value: DishType; label: string }[] = [
  { value: 'breakfast', label: 'Frühstück' },
  { value: 'lunch', label: 'Mittag' },
  { value: 'dinner', label: 'Abend' },
  { value: 'snack', label: 'Snack' },
  { value: 'dessert', label: 'Dessert' },
  { value: 'appetizer', label: 'Vorspeise' },
  { value: 'brunch', label: 'Brunch' },
];

const DIETARY_TAGS: { value: DietaryTag; label: string }[] = [
  { value: 'vegetarian', label: 'Vegetarisch' },
  { value: 'high_fat', label: 'Fettreich' },
  { value: 'low_fat', label: 'Fettarm' },
  { value: 'lactose_free', label: 'Laktosefrei' },
  { value: 'sugar_free', label: 'Zuckerfrei' },
  { value: 'gluten_free', label: 'Glutenfrei' },
];

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

interface IngredientItem {
  id: string;
  product: OpenFoodFactsProduct | null;
  productQuery: string;
  grams: string;
}

interface IngredientComponentGroup {
  id: string;
  title: string;
  items: IngredientItem[];
}

interface InstructionItem {
  id: string;
  text: string;
}

function newIngredient(): IngredientItem {
  return { id: `ing-${Date.now()}-${Math.random()}`, product: null, productQuery: '', grams: '' };
}

export function RecipeCreateScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session } = useSession();
  const userId = session?.user.id;
  const { activeHouseholdId } = useActiveHousehold();

  const { data } = useRecipeDetail(id);
  const addRecipe = useAddRecipeMutation();
  const updateRecipe = useUpdateRecipeMutation();
  const addComponent = useAddComponentMutation();
  const addItem = useAddItemMutation();
  const addProduct = useAddProductMutation();

  const isEditing = !!data;
  const householdId = data?.recipe.household_id ?? activeHouseholdId ?? undefined;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [cookTimeMinutes, setCookTimeMinutes] = useState('');
  const [defaultServings, setDefaultServings] = useState(4);
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [dishTypes, setDishTypes] = useState<DishType[]>([]);
  const [dietaryTags, setDietaryTags] = useState<DietaryTag[]>([]);
  const [hashtagsInput, setHashtagsInput] = useState('');
  const [localCoverUri, setLocalCoverUri] = useState<string | null>(null);
  const [existingCoverPath, setExistingCoverPath] = useState<string | null>(null);
  const [isPublishModalVisible, setIsPublishModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const [components, setComponents] = useState<IngredientComponentGroup[]>([
    { id: 'comp-1', title: 'Zutaten', items: [newIngredient(), newIngredient()] },
  ]);

  const [instructions, setInstructions] = useState<InstructionItem[]>([{ id: 'inst-1', text: '' }]);

  useEffect(() => {
    if (!data) return;
    setTitle(data.recipe.title);
    setDescription(data.recipe.instructions ?? '');
    setCookTimeMinutes(data.recipe.cook_time_minutes ? String(data.recipe.cook_time_minutes) : '');
    setDefaultServings(data.recipe.default_servings);
    setDifficulty(data.recipe.difficulty);
    setDishTypes(data.recipe.dish_types);
    setDietaryTags(data.recipe.dietary_tags);
    setHashtagsInput(data.recipe.hashtags.join(' '));
    setExistingCoverPath(data.recipe.cover_image_path);
    setInstructions(
      data.recipe.steps.length > 0
        ? data.recipe.steps.map((text, i) => ({ id: `inst-${i}`, text }))
        : [{ id: 'inst-1', text: '' }],
    );
    // Zutaten-Komponenten werden beim Bearbeiten bewusst nicht aus den
    // vorhandenen recipe_components rekonstruiert — nur die Rezeptfelder oben
    // sind editierbar, Zutaten bleiben ein reiner Neuanlage-Schritt.
  }, [data]);

  async function handlePickCover() {
    const uri = await pickRecipeCoverImage();
    if (uri) setLocalCoverUri(uri);
  }

  function handleAddIngredient(componentId: string) {
    setComponents((prev) =>
      prev.map((comp) =>
        comp.id === componentId ? { ...comp, items: [...comp.items, newIngredient()] } : comp,
      ),
    );
  }

  function handleRemoveIngredient(componentId: string, ingredientId: string) {
    setComponents((prev) =>
      prev.map((comp) =>
        comp.id === componentId
          ? { ...comp, items: comp.items.filter((item) => item.id !== ingredientId) }
          : comp,
      ),
    );
  }

  function handleSelectProduct(
    componentId: string,
    ingredientId: string,
    product: OpenFoodFactsProduct,
  ) {
    setComponents((prev) =>
      prev.map((comp) => {
        if (comp.id !== componentId) return comp;
        return {
          ...comp,
          items: comp.items.map((item) =>
            item.id === ingredientId ? { ...item, product, productQuery: product.name } : item,
          ),
        };
      }),
    );
  }

  function handleUpdateIngredientQuery(componentId: string, ingredientId: string, query: string) {
    setComponents((prev) =>
      prev.map((comp) => {
        if (comp.id !== componentId) return comp;
        return {
          ...comp,
          items: comp.items.map((item) =>
            item.id === ingredientId ? { ...item, productQuery: query, product: null } : item,
          ),
        };
      }),
    );
  }

  function handleUpdateGrams(componentId: string, ingredientId: string, grams: string) {
    setComponents((prev) =>
      prev.map((comp) => {
        if (comp.id !== componentId) return comp;
        return {
          ...comp,
          items: comp.items.map((item) => (item.id === ingredientId ? { ...item, grams } : item)),
        };
      }),
    );
  }

  function handleAddComponentGroup() {
    setComponents((prev) => [
      ...prev,
      {
        id: `comp-${Date.now()}`,
        title: `Zutaten-Gruppe ${prev.length + 1}`,
        items: [newIngredient(), newIngredient()],
      },
    ]);
  }

  function handleAddInstruction() {
    setInstructions((prev) => [...prev, { id: `inst-${Date.now()}`, text: '' }]);
  }

  function handleRemoveInstruction(instructionId: string) {
    setInstructions((prev) => prev.filter((inst) => inst.id !== instructionId));
  }

  function handleUpdateInstruction(instructionId: string, val: string) {
    setInstructions((prev) =>
      prev.map((inst) => (inst.id === instructionId ? { ...inst, text: val } : inst)),
    );
  }

  async function handleSave(): Promise<string | null> {
    if (!title.trim() || !householdId || !userId) return null;
    setSaving(true);
    try {
      const hashtags = hashtagsInput
        .split(/[\s,#]+/)
        .map((h) => h.trim().toLowerCase())
        .filter(Boolean);
      const cookTime = Number.parseInt(cookTimeMinutes, 10);
      const steps = instructions.map((i) => i.text.trim()).filter(Boolean);

      const metadata = {
        instructions: description.trim() || null,
        steps,
        cook_time_minutes: Number.isFinite(cookTime) && cookTime > 0 ? cookTime : null,
        difficulty,
        dish_types: dishTypes,
        dietary_tags: dietaryTags,
        hashtags,
        default_servings: defaultServings,
      };

      const recipeId = isEditing
        ? data.recipe.id
        : (
            await addRecipe.mutateAsync({
              household_id: householdId,
              title: title.trim(),
              created_by: userId,
              ...metadata,
            })
          ).id;

      let coverPath = existingCoverPath;
      if (localCoverUri) {
        coverPath = await uploadRecipeCoverImage(localCoverUri, householdId, recipeId);
      }

      if (isEditing || coverPath) {
        await updateRecipe.mutateAsync({
          id: recipeId,
          household_id: householdId,
          title: title.trim(),
          cover_image_path: coverPath,
          ...metadata,
        });
      }

      if (!isEditing) {
        for (const comp of components) {
          const readyItems = comp.items.filter(
            (item) => item.product && Number.parseFloat(item.grams) > 0,
          );
          if (readyItems.length === 0) continue;

          const totalGrams = readyItems.reduce(
            (sum, item) => sum + Number.parseFloat(item.grams),
            0,
          );
          const component = await addComponent.mutateAsync({
            recipe_id: recipeId,
            household_id: householdId,
            name: comp.title,
            serving_grams: totalGrams > 0 ? totalGrams : null,
          });

          for (const item of readyItems) {
            if (!item.product) continue;
            const productId = await persistOffProductIfNeeded(item.product, userId, addProduct);
            if (!productId) continue;
            await addItem.mutateAsync({
              component_id: component.id,
              recipe_id: recipeId,
              household_id: householdId,
              product_id: productId,
              grams: Number.parseFloat(item.grams),
            });
          }
        }
      }

      return recipeId;
    } catch (err) {
      Alert.alert('Fehler', err instanceof Error ? err.message : 'Konnte nicht speichern.');
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    const recipeId = await handleSave();
    setIsPublishModalVisible(false);
    if (recipeId) {
      router.replace({ pathname: '/recipe/detail', params: { id: recipeId } });
    }
  }

  const coverPreviewUri = localCoverUri;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back">
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path
              d="M15 18l-6-6 6-6"
              stroke="#FF5262"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>{isEditing ? 'Rezept bearbeiten' : 'Neues Rezept'}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.topActionsRow}>
          <Pressable
            style={styles.actionPillButton}
            onPress={() => setIsPublishModalVisible(true)}
            disabled={!title.trim() || saving}
            accessibilityRole="button"
            accessibilityLabel="Publish recipe">
            <Text style={styles.actionPillText}>{saving ? 'Speichert…' : 'Veröffentlichen'}</Text>
          </Pressable>
        </View>

        {/* Titelbild */}
        <TouchableOpacity style={styles.videoCard} activeOpacity={0.85} onPress={handlePickCover}>
          {coverPreviewUri ? (
            <Image
              source={{ uri: coverPreviewUri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
          ) : (
            <View style={styles.videoPlaceholderContent}>
              <View style={styles.playIconCircle}>
                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                  <Path d="M8 5v14l11-7z" fill="#FFFFFF" />
                </Svg>
              </View>
              <Text style={styles.videoPlaceholderText}>Titelbild hinzufügen</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Titel</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Rezepttitel"
            placeholderTextColor="#C4B0B2"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Beschreibung</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            value={description}
            onChangeText={setDescription}
            placeholder="Kurze Beschreibung des Rezepts"
            placeholderTextColor="#C4B0B2"
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.inputRow}>
          <View style={[styles.inputGroup, styles.flexInput]}>
            <Text style={styles.label}>Kochzeit (Minuten)</Text>
            <TextInput
              style={styles.input}
              value={cookTimeMinutes}
              onChangeText={setCookTimeMinutes}
              placeholder="30"
              placeholderTextColor="#C4B0B2"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Portionen</Text>
            <View style={styles.stepperPill}>
              <Pressable onPress={() => setDefaultServings((n) => Math.max(1, n - 1))}>
                <Text style={styles.stepperSign}>−</Text>
              </Pressable>
              <Text style={styles.stepperValue}>{defaultServings}</Text>
              <Pressable onPress={() => setDefaultServings((n) => n + 1)}>
                <Text style={styles.stepperSign}>+</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Schwierigkeit */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Schwierigkeit</Text>
          <View style={styles.chipRow}>
            {DIFFICULTIES.map((d) => {
              const selected = difficulty === d.value;
              return (
                <Pressable
                  key={d.value}
                  style={[styles.chip, selected && styles.chipActive]}
                  onPress={() => setDifficulty(selected ? null : d.value)}>
                  <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                    {d.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Rezepttyp */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Art des Gerichts</Text>
          <View style={styles.chipRow}>
            {DISH_TYPES.map((d) => {
              const selected = dishTypes.includes(d.value);
              return (
                <Pressable
                  key={d.value}
                  style={[styles.chip, selected && styles.chipActive]}
                  onPress={() => setDishTypes((prev) => toggle(prev, d.value))}>
                  <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                    {d.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Ernaehrung */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Ernährung</Text>
          <View style={styles.chipRow}>
            {DIETARY_TAGS.map((d) => {
              const selected = dietaryTags.includes(d.value);
              return (
                <Pressable
                  key={d.value}
                  style={[styles.chip, selected && styles.chipActive]}
                  onPress={() => setDietaryTags((prev) => toggle(prev, d.value))}>
                  <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                    {d.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Hashtags */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Hashtags</Text>
          <TextInput
            style={styles.input}
            value={hashtagsInput}
            onChangeText={setHashtagsInput}
            placeholder="#vegan #schnell"
            placeholderTextColor="#C4B0B2"
          />
        </View>

        {/* Zutaten-Gruppen */}
        {components.map((comp) => (
          <View key={comp.id} style={styles.componentSection}>
            <Text style={styles.label}>{comp.title}</Text>

            {comp.items.map((item) => (
              <View key={item.id} style={styles.ingredientBlock}>
                <ProductSearchDropdown
                  label="Zutat"
                  placeholder="Zutat suchen…"
                  value={item.productQuery}
                  onChangeText={(val) => handleUpdateIngredientQuery(comp.id, item.id, val)}
                  onSelectProduct={(product) => handleSelectProduct(comp.id, item.id, product)}
                />
                <View style={styles.ingredientGramsRow}>
                  <TextInput
                    style={[styles.input, styles.amountInput]}
                    value={item.grams}
                    onChangeText={(val) => handleUpdateGrams(comp.id, item.id, val)}
                    placeholder="Gramm"
                    placeholderTextColor="#C4B0B2"
                    keyboardType="numeric"
                  />
                  <TouchableOpacity
                    style={styles.trashCircleButton}
                    onPress={() => handleRemoveIngredient(comp.id, item.id)}
                    accessibilityRole="button"
                    accessibilityLabel="Delete ingredient">
                    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"
                        stroke="#FF5262"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            <TouchableOpacity
              style={styles.addIngredientSmallBtn}
              onPress={() => handleAddIngredient(comp.id)}>
              <Text style={styles.addIngredientSmallText}>+ Zutat hinzufügen</Text>
            </TouchableOpacity>
          </View>
        ))}

        <Pressable
          style={styles.addComponentButton}
          onPress={handleAddComponentGroup}
          accessibilityRole="button"
          accessibilityLabel="Add Componente">
          <Text style={styles.addComponentText}>+ Zutaten-Gruppe hinzufügen</Text>
        </Pressable>

        {/* Zubereitung */}
        <View style={styles.instructionsSection}>
          <Text style={styles.label}>Zubereitung</Text>

          {instructions.map((inst, index) => (
            <View key={inst.id} style={styles.instructionRow}>
              <TextInput
                style={[styles.input, styles.instructionInput]}
                value={inst.text}
                onChangeText={(val) => handleUpdateInstruction(inst.id, val)}
                placeholder={`Schritt ${index + 1}`}
                placeholderTextColor="#C4B0B2"
                multiline
              />

              <TouchableOpacity
                style={styles.trashCircleButton}
                onPress={() => handleRemoveInstruction(inst.id)}
                accessibilityRole="button"
                accessibilityLabel="Delete instruction">
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"
                    stroke="#FF5262"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity style={styles.addInstructionSmallBtn} onPress={handleAddInstruction}>
            <Text style={styles.addInstructionSmallText}>+ Schritt hinzufügen</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <PublishModal
        visible={isPublishModalVisible}
        onCancel={() => setIsPublishModalVisible(false)}
        onPublish={handlePublish}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFDF9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  backButton: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FF5262',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  topActionsRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 20,
  },
  actionPillButton: {
    flex: 1,
    height: 44,
    backgroundColor: '#FF5262',
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPillText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  videoCard: {
    width: '100%',
    height: 200,
    backgroundColor: '#FFE2E2',
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlaceholderContent: {
    alignItems: 'center',
  },
  playIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FF5262',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  videoPlaceholderText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#332222',
    marginTop: 14,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 14,
  },
  flexInput: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2A181A',
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#FFE2E2',
    borderRadius: 22,
    height: 52,
    paddingHorizontal: 20,
    fontSize: 15,
    color: '#332222',
  },
  multilineInput: {
    height: 84,
    paddingTop: 14,
    paddingBottom: 14,
    textAlignVertical: 'top',
  },
  stepperPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFE2E2',
    borderRadius: 22,
    height: 52,
    paddingHorizontal: 20,
    minWidth: 100,
  },
  stepperSign: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FF5262',
  },
  stepperValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#332222',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#FFE2E2',
  },
  chipActive: {
    backgroundColor: '#FF5262',
  },
  chipText: {
    color: '#FF5262',
    fontSize: 14,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  componentSection: {
    marginBottom: 20,
  },
  ingredientBlock: {
    marginBottom: 14,
    gap: 8,
  },
  ingredientGramsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  amountInput: {
    flex: 1,
  },
  trashCircleButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIngredientSmallBtn: {
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  addIngredientSmallText: {
    color: '#FF5262',
    fontSize: 14,
    fontWeight: '600',
  },
  addComponentButton: {
    width: '100%',
    height: 52,
    backgroundColor: '#FF5262',
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 28,
  },
  addComponentText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  instructionsSection: {
    marginBottom: 20,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  instructionInput: {
    flex: 1,
    minHeight: 52,
    height: 'auto',
  },
  addInstructionSmallBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  addInstructionSmallText: {
    color: '#FF5262',
    fontSize: 15,
    fontWeight: '600',
  },
});
