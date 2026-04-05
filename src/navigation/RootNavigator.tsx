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

import ServerSetupScreen from "@/screens/auth/ServerSetupScreen";
import LoginScreen from "@/screens/auth/LoginScreen";
import HouseholdPickerScreen from "@/screens/households/HouseholdPickerScreen";
import ListsScreen from "@/screens/lists/ListsScreen";
import ListDetailScreen from "@/screens/lists/ListDetailScreen";
import SyncIndicator from "@/components/SyncIndicator";

import type { AuthStackParamList, MainStackParamList } from "./types";

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainStack = createNativeStackNavigator<MainStackParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="ServerSetup" component={ServerSetupScreen} />
      <AuthStack.Screen name="Login" component={LoginScreen} />
    </AuthStack.Navigator>
  );
}

function HeaderRight() {
  return <SyncIndicator />;
}

function MainNavigator() {
  const selectedHousehold = useHouseholdStore((s) => s.selectedHousehold);

  useEffect(() => {
    // Start network monitoring; drain queue immediately and on reconnect.
    startNetworkMonitoring(() => {
      void drain();
    });
    void drain();
    return () => stopNetworkMonitoring();
  }, []);

  return (
    <MainStack.Navigator screenOptions={{ headerRight: HeaderRight }}>
      {selectedHousehold === null ? (
        <MainStack.Screen
          name="HouseholdPicker"
          component={HouseholdPickerScreen}
          options={{ title: "Select Household" }}
        />
      ) : (
        <>
          <MainStack.Screen
            name="Lists"
            component={ListsScreen}
            options={{ title: "Shopping Lists" }}
          />
          <MainStack.Screen
            name="ListDetail"
            component={ListDetailScreen}
            options={({ route }) => ({ title: route.params.listName })}
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
