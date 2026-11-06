import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { radius, space } from '@/components/theme/index';
import { Press, Txt } from '@/constants/ui';

/** Provider-unabhängiger Fallback für Fehler aus dem gesamten App-Baum. */
export function CrashFallback({ resetError }: { resetError: () => void }) {
  return (
    <View style={styles.container}>
      <Txt variant="subheading" weight="600" style={styles.title}>
        Etwas ist schiefgelaufen
      </Txt>
      <Txt variant="label" weight="400" center style={styles.body}>
        Die App ist auf einen unerwarteten Fehler gestossen. Der Fehler wurde erfasst.
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
