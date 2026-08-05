import { Stack } from 'expo-router';

/** Anmeldebereich. Header aus, die Screens bringen ihre eigenen Titel mit. */
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
