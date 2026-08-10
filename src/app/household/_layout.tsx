import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/features/auth/session-provider';

/**
 * Die Haushalts-Routen liegen in einer eigenen Gruppe, nicht unter `(app)` —
 * der Guard dort greift fuer sie also nicht.
 *
 * Ohne diese Pruefung war `/household/create` ohne Session erreichbar. Das
 * Formular liess sich ausfuellen, und erst der Absenden-Knopf scheiterte mit
 * `permission denied for function create_household`: Der RPC ist nur an
 * `authenticated` vergeben, der Aufruf lief als `anon`. Ein Fehler, der erst
 * nach der Eingabe kommt und dem Nutzer nichts sagt.
 */
export default function HouseholdLayout() {
  const { session, isLoading } = useSession();

  // `isLoading` abwarten: "noch unbekannt" ist nicht dasselbe wie "nicht
  // angemeldet" — sonst wirft ein Kaltstart auf einem Deep Link den Nutzer
  // hinaus, bevor die gespeicherte Session gelesen ist.
  if (isLoading) return null;

  if (!session) return <Redirect href="/onboarding" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
