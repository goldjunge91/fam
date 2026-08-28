import BrochuresOverviewScreen from '@/features/brochures/screens/brochures-overview-screen';

// Kein Stack.Screen-Header: BrochuresOverviewScreen baut seinen eigenen Header per
// <Screen chrome={...}> mit Menü-Button zum Nav-Menü, analog zu fridge/shopping-list/recipes.
export default function BrochuresRoute() {
  return <BrochuresOverviewScreen />;
}
