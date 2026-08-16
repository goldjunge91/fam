import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ShowUndoSnackbarInput = {
  message: string;
  onUndo: () => void;
  /** Auto-Dismiss-Dauer in ms. Default 4000 — lang genug zum Lesen+Tippen, kurz genug um nicht zu nerven. */
  durationMs?: number;
};

type SnackbarContextValue = {
  showUndoSnackbar: (input: ShowUndoSnackbarInput) => void;
};

const SnackbarContext = createContext<SnackbarContextValue | null>(null);

const DEFAULT_DURATION_MS = 4000;

type SnackbarState = { message: string; onUndo: () => void } | null;

/**
 * Gemeinsame Undo-Snackbar (#86/#69) — einmal gebaut, zweimal verdrahtet
 * (Tagebuch-Eintrag loeschen, Kuehlschrank-Artikel loeschen). Bewusst als
 * Provider statt einer lokalen State-Loesung pro Screen: beide Faelle
 * brauchen exakt dasselbe Verhalten (Auto-Dismiss, Abbruch bei Undo-Tap,
 * kein Ueberlappen zweier Snackbars).
 */
export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const [snackbar, setSnackbar] = useState<SnackbarState>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setSnackbar(null);
  }, []);

  const showUndoSnackbar = useCallback(
    ({ message, onUndo, durationMs = DEFAULT_DURATION_MS }: ShowUndoSnackbarInput) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setSnackbar({ message, onUndo });
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setSnackbar(null);
      }, durationMs);
    },
    [],
  );

  return (
    <SnackbarContext.Provider value={{ showUndoSnackbar }}>
      {children}
      {snackbar ? (
        <SafeAreaView edges={['bottom']} style={styles.wrapper} pointerEvents="box-none">
          <View style={[styles.bar, { backgroundColor: theme.text }]}>
            <ThemedText type="small" style={[styles.message, { color: theme.background }]}>
              {snackbar.message}
            </ThemedText>
            <Pressable
              onPress={() => {
                const { onUndo } = snackbar;
                dismiss();
                onUndo();
              }}
              accessibilityRole="button"
              accessibilityLabel="Rückgängig"
              hitSlop={10}>
              <ThemedText type="smallBold" style={{ color: theme.accent }}>
                Rückgängig
              </ThemedText>
            </Pressable>
          </View>
        </SafeAreaView>
      ) : null}
    </SnackbarContext.Provider>
  );
}

export function useSnackbar(): SnackbarContextValue {
  const context = useContext(SnackbarContext);
  if (!context) {
    throw new Error('useSnackbar muss innerhalb von SnackbarProvider verwendet werden');
  }
  return context;
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.control,
    gap: Spacing.three,
  },
  message: {
    flex: 1,
  },
});
