import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuthStore } from '@/store/authStore';
import { useHouseholdStore } from '@/store/householdStore';
import { initializeAuth } from '@/auth/authManager';
import { getDb } from '@/db/schema';
import { startNetworkMonitoring, stopNetworkMonitoring } from '@/sync/connectivityMonitor';
import { drain } from '@/sync/syncManager';
import { socketManager } from '@/socket/socketManager';

import WelcomeScreen from '@/screens/auth/WelcomeScreen';
import ServerSetupScreen from '@/screens/auth/ServerSetupScreen';
import LoginScreen from '@/screens/auth/LoginScreen';
import HouseholdPickerScreen from '@/screens/households/HouseholdPickerScreen';
import ListDetailScreen from '@/screens/lists/ListDetailScreen';
import SettingsScreen from '@/screens/settings/SettingsScreen';
import HouseholdDetailScreen from '@/screens/settings/HouseholdDetailScreen';
import HouseholdItemsScreen from '@/screens/settings/HouseholdItemsScreen';
import HouseholdCategoriesScreen from '@/screens/settings/HouseholdCategoriesScreen';
import BottomNav from '@/components/BottomNav';
import { navigationRef } from './navigationRef';

import type { AuthStackParamList, MainStackParamList } from './types';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainStack = createNativeStackNavigator<MainStackParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <AuthStack.Screen name="Welcome" component={WelcomeScreen} />
      <AuthStack.Screen name="ServerSetup" component={ServerSetupScreen} />
      <AuthStack.Screen name="Login" component={LoginScreen} />
    </AuthStack.Navigator>
  );
}

function MainNavigator() {
  const selectedHousehold = useHouseholdStore((s) => s.selectedHousehold);

  useEffect(() => {
    void socketManager.connect();
    startNetworkMonitoring(() => { void drain(); });
    void drain();
    return () => {
      socketManager.disconnect();
      stopNetworkMonitoring();
    };
  }, []);

  return (
    <MainStack.Navigator screenOptions={{ headerShown: false }}>
      {selectedHousehold === null ? (
        // Onboarding: only the picker is available; selecting auto-transitions
        <MainStack.Screen name="HouseholdPicker" component={HouseholdPickerScreen} />
      ) : (
        // Authenticated: list is the root; picker is reachable from the nav bar
        <>
          <MainStack.Screen
            name="ListDetail"
            component={ListDetailScreen}
            options={{ animation: 'none' }}
          />
          <MainStack.Screen
            name="HouseholdPicker"
            component={HouseholdPickerScreen}
            options={{ animation: 'slide_from_bottom' }}
          />
          <MainStack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ animation: 'none' }}
          />
          <MainStack.Screen name="HouseholdDetail" component={HouseholdDetailScreen} />
          <MainStack.Screen name="HouseholdItems" component={HouseholdItemsScreen} />
          <MainStack.Screen name="HouseholdCategories" component={HouseholdCategoriesScreen} />
        </>
      )}
    </MainStack.Navigator>
  );
}

export default function RootNavigator() {
  const status = useAuthStore((s) => s.status);
  const selectedHousehold = useHouseholdStore((s) => s.selectedHousehold);
  const [routeName, setRouteName] = useState<string | undefined>();

  useEffect(() => {
    getDb().then(initializeAuth).catch(console.error);
  }, []);

  const showNav =
    status === 'authenticated' &&
    selectedHousehold !== null &&
    routeName !== undefined &&
    routeName !== 'HouseholdPicker';
  const activeTab: 'lists' | 'settings' = routeName === 'ListDetail' ? 'lists' : 'settings';

  if (status === 'unknown') {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" testID="splash-indicator" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <NavigationContainer
        ref={navigationRef}
        onReady={() => setRouteName(navigationRef.getCurrentRoute()?.name)}
        onStateChange={() => setRouteName(navigationRef.getCurrentRoute()?.name)}
      >
        {status === 'authenticated' ? <MainNavigator /> : <AuthNavigator />}
      </NavigationContainer>
      {showNav && <BottomNav active={activeTab} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
