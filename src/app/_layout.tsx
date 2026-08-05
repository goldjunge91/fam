import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { startSupabaseAutoRefresh } from '@/lib/supabase';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    // Bindet den Token-Refresh an den App-Zustand. Ohne das laufen die Timer im
    // Hintergrund nicht weiter und der erste Request nach einer laengeren Pause
    // scheitert an einem abgelaufenen Access-Token.
    return startSupabaseAutoRefresh();
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <AppTabs />
    </ThemeProvider>
  );
}
