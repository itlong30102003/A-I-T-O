import { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import SplashScreen from './components/SplashScreen';
import LoginScreen from './components/ui/LoginScreen';
import MainScreen from './components/MainScreen';

export default function App() {
  // App states: 'splash' | 'login' | 'main'
  const [screen, setScreen] = useState('splash');

  const handleSplashComplete = () => {
    setScreen('login');
  };

  const handleLoginSuccess = () => {
    setScreen('main');
  };

  return (
    <SafeAreaProvider>
      {screen === 'splash' && <SplashScreen onComplete={handleSplashComplete} />}
      {screen === 'login' && <LoginScreen onLoginSuccess={handleLoginSuccess} />}
      {screen === 'main' && <MainScreen />}
    </SafeAreaProvider>
  );
}