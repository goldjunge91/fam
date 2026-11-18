import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { radius, space } from '@/components/theme/index';
import { Press, Txt } from '@/constants/ui';

type CrashFallbackProps = {
  resetError: () => void;
  error?: unknown;
};

type FallbackCopy = {
  cause: string;
  action: string;
};

type MissingEnvFailure = {
  name: 'MissingEnvError';
  variableName: string;
};

function isMissingEnvFailure(error: unknown): error is MissingEnvFailure {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as { name?: unknown; variableName?: unknown };
  return candidate.name === 'MissingEnvError' && typeof candidate.variableName === 'string';
}

function getFallbackCopy(error: unknown): FallbackCopy {
  if (isMissingEnvFailure(error)) {
    if (
      __DEV__ &&
      (error.variableName === 'EXPO_PUBLIC_SUPABASE_URL' ||
        error.variableName === 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
    ) {
      return {
        cause: `Die öffentliche Konfiguration ${error.variableName} fehlt.`,
        action: 'Ergänze die Variable und starte Metro neu.',
      };
    }

    return {
      cause: 'Die App-Konfiguration ist unvollständig.',
      action: 'Bitte aktualisiere die App oder wende dich an den Support.',
    };
  }

  return {
    cause: 'Beim Starten der App ist ein unerwarteter Fehler aufgetreten.',
    action: 'Bitte versuche es erneut.',
  };
}

/** Provider-unabhängiger Fallback für Fehler aus dem gesamten App-Baum. */
export function CrashFallback({ resetError, error }: CrashFallbackProps) {
  const copy = getFallbackCopy(error);

  return (
    <View style={styles.container}>
      <Txt variant="subheading" weight="600" style={styles.title}>
        App konnte nicht gestartet werden
      </Txt>
      <Txt variant="label" weight="400" center style={styles.body}>
        {copy.cause}
      </Txt>
      <Txt variant="label" weight="400" center style={styles.body}>
        {copy.action}
      </Txt>
      <Press
        onPress={resetError}
        accessibilityRole="button"
        accessibilityLabel="Erneut versuchen"
        style={styles.button}>
        <Txt variant="label" weight="600" tone="accent" style={styles.buttonText}>
          Erneut versuchen
        </Txt>
      </Press>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
    backgroundColor: theme.background,
    gap: space.md,
  },
  title: { color: theme.text },
  body: { color: theme.text },
  button: {
    minHeight: 44,
    minWidth: 44,
    marginTop: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderCurve: 'continuous',
  },
  buttonText: {
    color: theme.accent,
    textDecorationLine: 'underline',
  },
}));
