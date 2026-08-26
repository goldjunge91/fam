import { Pressable, StyleSheet, Text, View } from 'react-native';

/** Provider-unabhängiger Fallback für Fehler aus dem gesamten App-Baum. */
export function CrashFallback({ resetError }: { resetError: () => void }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Etwas ist schiefgelaufen</Text>
      <Text style={styles.body}>
        Die App ist auf einen unerwarteten Fehler gestossen. Der Fehler wurde erfasst.
      </Text>
      <Pressable onPress={resetError} style={styles.button}>
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
    padding: 24,
    backgroundColor: '#F8F4EF',
    gap: 12,
  },
  title: { fontSize: 17, fontWeight: '600', color: '#2D2830' },
  body: { fontSize: 14, color: '#2D2830', textAlign: 'center' },
  button: { marginTop: 12, paddingHorizontal: 20, paddingVertical: 10 },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2D2830',
    textDecorationLine: 'underline',
  },
});
