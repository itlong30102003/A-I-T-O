import { useState } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Settings } from 'react-native-fbsdk-next';
import SplashScreen from './components/SplashScreen';
import LoginScreen from './components/ui/LoginScreen';
import MainScreen from './components/MainScreen';

// Initialize Facebook SDK
Settings.initializeSDK();

// Log Facebook Key Hash (check Metro console for this)
if (__DEV__ && Platform.OS === 'android') {
  Settings.setAppID('1213268594063132');
  console.log('=== FACEBOOK SDK INITIALIZED ===');
  console.log('Check logcat for key hash if login fails');
}

export default function App() {
  // App states: 'splash' | 'login' | 'main'
  const [screen, setScreen] = useState('splash');

  const handleSplashComplete = () => {
    setScreen('login');
  };

  const handleLoginSuccess = () => {
    setScreen('main');
  };

  const handleLogout = () => {
    setScreen('login');
  };

  return (
    <SafeAreaProvider>
      {screen === 'splash' && <SplashScreen onComplete={handleSplashComplete} />}
      {screen === 'login' && <LoginScreen onLoginSuccess={handleLoginSuccess} />}
      {screen === 'main' && <MainScreen onLogout={handleLogout} />}
    </SafeAreaProvider>
  );
}