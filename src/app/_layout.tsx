import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme, LogBox } from 'react-native';

LogBox.ignoreLogs([
  "WebChannelConnection RPC 'Listen' stream",
]);
import { 
  useFonts,
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
} from '@expo-google-fonts/outfit';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';

SplashScreen.preventAutoHideAsync();

import { AuthProvider } from '@/contexts/AuthContext';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  
  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
  });

  if (!fontsLoaded) {
    return null; // Let the native splash screen stay until fonts are loaded
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <AnimatedSplashOverlay />
        <AppTabs />
      </AuthProvider>
    </ThemeProvider>
  );
}
