import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';

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
        <SafeAreaView
          edges={['bottom']}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}
          pointerEvents="box-none">
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginHorizontal: 16,
              marginBottom: 16,
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 12,
              gap: 16,
              backgroundColor: colors.text,
            }}>
            <Txt variant="body" tone="inverse" weight="500" style={{ flex: 1 }}>
              {snackbar.message}
            </Txt>
            <Pressable
              onPress={() => {
                const { onUndo } = snackbar;
                dismiss();
                onUndo();
              }}
              accessibilityRole="button"
              accessibilityLabel="Rückgängig"
              hitSlop={10}>
              <Txt variant="body" tone="accent" weight="700">
                Rückgängig
              </Txt>
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
