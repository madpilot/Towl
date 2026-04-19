import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuthStore } from '@/store/authStore';
import { useHouseholdStore } from '@/store/householdStore';
import { initializeAuth } from '@/auth/authManager';
import { getDb, resetDb } from '@/db/schema';
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
  const [dbError, setDbError] = useState(false);

  useEffect(() => {
    async function startup() {
      // Open (and if necessary migrate) the database.
      try {
        await getDb();
      } catch {
        // First attempt failed — wipe the database and try once more.
        // All data syncs from the server so a fresh DB is recoverable.
        try {
          await resetDb();
          await getDb();
        } catch {
          setDbError(true);
          return;
        }
      }

      // Restore auth state from SecureStore — no network calls.
      // initializeAuth handles Keystore errors internally; catch here is a
      // last-resort safety net for truly unexpected failures.
      await initializeAuth().catch(console.error);
    }

    void startup();
  }, []);

  if (dbError) {
    return (
      <View style={styles.splash}>
        <Text style={styles.errorTitle}>Unable to open storage</Text>
        <Text style={styles.errorBody}>
          Towl could not open its local database. Please uninstall and reinstall the app.
        </Text>
      </View>
    );
  }

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
    paddingHorizontal: 32,
    gap: 12,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
  },
  errorBody: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
});
