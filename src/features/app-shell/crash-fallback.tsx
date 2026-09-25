import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { colorsLight, font, radius, space } from '@/components/theme/index';

/** Provider-unabhängiger Fallback für Fehler aus dem gesamten App-Baum. */
export function CrashFallback({ resetError }: { resetError: () => void }) {
  const [pressed, setPressed] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Etwas ist schiefgelaufen</Text>
      <Text style={styles.body}>
        Die App ist auf einen unerwarteten Fehler gestossen. Der Fehler wurde erfasst.
      </Text>
      <Pressable
        onPress={resetError}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        accessibilityRole="button"
        accessibilityLabel="Erneut versuchen"
        style={[styles.button, pressed && styles.buttonPressed]}>
        <Text style={styles.buttonText}>Erneut versuchen</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
    backgroundColor: colorsLight.background,
    gap: space.md,
  },
  title: { fontSize: font.sizes.md, fontWeight: '600', color: colorsLight.text },
  body: { fontSize: font.sizes.sm, color: colorsLight.text, textAlign: 'center' },
  button: {
    minHeight: 44,
    minWidth: 44,
    marginTop: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  buttonPressed: { opacity: 0.7 },
  buttonText: {
    fontSize: font.sizes.sm,
    fontWeight: '600',
    color: colorsLight.accent,
    textDecorationLine: 'underline',
  },
});
