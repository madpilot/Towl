import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import RootNavigator from '@/navigation/RootNavigator';

export default function App() {
  const [fontsLoaded] = useFonts({
    Items: require('./assets/fonts/Items.ttf'),
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator testID="font-loading-indicator" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <RootNavigator />
    </SafeAreaProvider>
  );
}
