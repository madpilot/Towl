import React, { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { useAuthStore } from "@/store/authStore";
import { useHouseholdStore } from "@/store/householdStore";
import { initializeAuth } from "@/auth/authManager";
import { getDb } from "@/db/schema";
import {
  startNetworkMonitoring,
  stopNetworkMonitoring,
} from "@/sync/connectivityMonitor";
import { drain } from "@/sync/syncManager";

import WelcomeScreen from "@/screens/auth/WelcomeScreen";
import ServerSetupScreen from "@/screens/auth/ServerSetupScreen";
import LoginScreen from "@/screens/auth/LoginScreen";
import HouseholdPickerScreen from "@/screens/households/HouseholdPickerScreen";
import ListDetailScreen from "@/screens/lists/ListDetailScreen";
import SettingsScreen from "@/screens/settings/SettingsScreen";
import HouseholdDetailScreen from "@/screens/settings/HouseholdDetailScreen";

import type { AuthStackParamList, MainStackParamList } from "./types";

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainStack = createNativeStackNavigator<MainStackParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator
      screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
    >
      <AuthStack.Screen name="Welcome" component={WelcomeScreen} />
      <AuthStack.Screen name="ServerSetup" component={ServerSetupScreen} />
      <AuthStack.Screen name="Login" component={LoginScreen} />
    </AuthStack.Navigator>
  );
}

function MainNavigator() {
  const selectedHousehold = useHouseholdStore((s) => s.selectedHousehold);

  useEffect(() => {
    startNetworkMonitoring(() => {
      void drain();
    });
    void drain();
    return () => stopNetworkMonitoring();
  }, []);

  return (
    <MainStack.Navigator screenOptions={{ headerShown: false }}>
      {selectedHousehold === null ? (
        // Onboarding: only the picker is available; selecting auto-transitions
        <MainStack.Screen
          name="HouseholdPicker"
          component={HouseholdPickerScreen}
        />
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
          />
          <MainStack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ animation: 'none' }}
          />
          <MainStack.Screen
            name="HouseholdDetail"
            component={HouseholdDetailScreen}
          />
        </>
      )}
    </MainStack.Navigator>
  );
}

export default function RootNavigator() {
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    getDb().then(initializeAuth).catch(console.error);
  }, []);

  if (status === "unknown") {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" testID="splash-indicator" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {status === "authenticated" ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
