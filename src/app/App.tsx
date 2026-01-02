import { NewAppScreen } from '@react-native/new-app-screen';
import { useState } from 'react';
import { StatusBar, StyleSheet, useColorScheme, View } from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import SplashScreen from './components/SplashScreen';
import MainScreen from './components/MainScreen';

export default function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [showSplash, setShowSplash] = useState(true);
  const handleComplete = () => {
    setShowSplash(false);
  };

  return (
    <SafeAreaProvider>
      {showSplash ? (
        <SplashScreen onComplete={handleComplete} />
      ) : (
        <MainScreen />
      )}
    </SafeAreaProvider>
  );
}