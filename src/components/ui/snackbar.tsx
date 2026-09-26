import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import { useTheme } from '@/components/theme/ThemeProvider';
import { Press, Txt } from '@/constants/ui';

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

const styles = StyleSheet.create((theme) => ({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  surface: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: theme.space.lg,
    marginBottom: theme.space.lg,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.sm,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    gap: theme.space.lg,
    backgroundColor: theme.text,
  },
  message: {
    flex: 1,
  },
  undo: {
    minHeight: 44,
    justifyContent: 'center',
  },
}));

type SnackbarState = { message: string; onUndo: () => void } | null;

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
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
        <SafeAreaView edges={['bottom']} style={styles.overlay} pointerEvents="box-none">
          <View style={[styles.surface, { backgroundColor: colors.text }]}>
            <Txt variant="body" tone="onAccent" weight="500" style={styles.message}>
              {snackbar.message}
            </Txt>
            <Press
              onPress={() => {
                const { onUndo } = snackbar;
                dismiss();
                onUndo();
              }}
              accessibilityRole="button"
              accessibilityLabel="Rückgängig"
              hitSlop={10}
              style={styles.undo}>
              <Txt variant="body" tone="onAccent" weight="700">
                Rückgängig
              </Txt>
            </Press>
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
