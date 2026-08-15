import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { FontSize, ThemedText } from '@/components/themed-text';
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
        style={styles.keyboardView}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable
            style={[styles.sheet, { backgroundColor: theme.backgroundElement }]}
            onPress={(event) => event.stopPropagation()}>
            <View style={[styles.handle, { backgroundColor: theme.border }]} />
            <View style={styles.header}>
              <ThemedText style={styles.title}>Rezept bewerten</ThemedText>
              <Pressable
                onPress={onClose}
                role="button"
                aria-label="Schließen"
                style={[styles.close, { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText themeColor="accent" style={styles.closeText}>
                  ×
                </ThemedText>
              </Pressable>
            </View>
            <ThemedText themeColor="textSecondary" style={styles.description}>
              Wie hat dir das Rezept gefallen?
            </ThemedText>

            <View style={styles.scoreGrid}>
              {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
                <Pressable
                  key={value}
                  onPress={() => setScore(value)}
                  role="button"
                  aria-label={`${value} von 10 Sternen`}
                  accessibilityState={{ selected: score === value }}
                  style={[
                    styles.scoreButton,
                    {
                      backgroundColor: score === value ? theme.accent : theme.backgroundSelected,
                    },
                  ]}>
                  <ThemedText
                    style={[styles.star, { color: score === value ? '#FFFFFF' : theme.accent }]}>
                    ★
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.scoreNumber,
                      { color: score === value ? '#FFFFFF' : theme.textSecondary },
                    ]}>
                    {value}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
            <ThemedText themeColor="accent" style={styles.scoreLabel}>
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
              style={[
                styles.input,
                {
                  color: theme.text,
                  backgroundColor: theme.backgroundSelected,
                  borderColor: theme.border,
                },
              ]}
            />

            <Pressable
              onPress={submit}
              disabled={score === 0 || saving}
              role="button"
              style={({ pressed }) => [
                styles.submit,
                { backgroundColor: theme.accent },
                (score === 0 || saving) && styles.disabled,
                pressed && styles.pressed,
              ]}>
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <ThemedText style={styles.submitText}>Bewertung speichern</ThemedText>
              )}
            </Pressable>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardView: { flex: 1 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(38,31,39,0.30)' },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderCurve: 'continuous',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 19,
  },
  handle: { width: 38, height: 4, borderRadius: 3, alignSelf: 'center' },
  header: {
    minHeight: 58,
    paddingTop: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: { flex: 1, ...FontSize[18], lineHeight: 22, fontWeight: 700, letterSpacing: -0.4 },
  close: {
    width: 32,
    height: 32,
    borderRadius: 11,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { ...FontSize[18], lineHeight: 20, fontWeight: 500 },
  description: { ...FontSize[10], lineHeight: 14, fontWeight: 500 },
  scoreGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingTop: 14 },
  scoreButton: {
    width: '18%',
    minWidth: 52,
    flexGrow: 1,
    height: 50,
    borderRadius: 14,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  star: { ...FontSize[14], lineHeight: 17 },
  scoreNumber: { ...FontSize[9], lineHeight: 11, fontWeight: 700 },
  scoreLabel: { paddingTop: 10, ...FontSize[10], lineHeight: 13, fontWeight: 700 },
  input: {
    minHeight: 92,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    borderCurve: 'continuous',
    ...FontSize[11],
    lineHeight: 16,
  },
  submit: {
    height: 48,
    marginTop: 14,
    borderRadius: 16,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: { color: '#FFFFFF', ...FontSize[11], lineHeight: 14, fontWeight: 700 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.99 }] },
});
