import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Settings } from 'react-native-fbsdk-next';
import { getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
import SplashScreen from './components/SplashScreen';
import LoginScreen from './components/ui/LoginScreen';
import MainScreen from './components/MainScreen';
import { SettingsProvider } from './modules/settings/SettingsContext';

// Initialize Facebook SDK
Settings.initializeSDK();

// Log Facebook Key Hash (check Metro console for this)
if (__DEV__ && Platform.OS === 'android') {
  Settings.setAppID('1213268594063132');
  console.log('=== FACEBOOK SDK INITIALIZED ===');
  console.log('Check logcat for key hash if login fails');
}

export default function App() {
  // Splash screen state — controlled by animation timer
  const [showSplash, setShowSplash] = useState(true);

  // Firebase auth state — single source of truth
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<any>(null);

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getAuth(), (firebaseUser) => {
      setUser(firebaseUser);
      if (initializing) setInitializing(false);
    });
    return unsubscribe;
  }, [initializing]);

  // Show splash screen first (animation)
  if (showSplash) {
    return (
      <SettingsProvider>
        <SafeAreaProvider>
          <SplashScreen onComplete={() => setShowSplash(false)} />
        </SafeAreaProvider>
      </SettingsProvider>
    );
  }

  // Wait for Firebase to determine auth state
  if (initializing) return null;

  // Firebase decides: logged in → MainScreen, not logged in → LoginScreen
  return (
    <SettingsProvider>
      <SafeAreaProvider>
        {user ? <MainScreen /> : <LoginScreen />}
      </SafeAreaProvider>
    </SettingsProvider>
  );
}