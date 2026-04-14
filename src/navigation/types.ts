import type { NativeStackScreenProps } from '@react-navigation/native-stack';

// ─── Auth stack ──────────────────────────────────────────────────────────────

export type AuthStackParamList = {
  Welcome: undefined;
  ServerSetup: undefined;
  Login: { serverUrl: string };
};

export type WelcomeScreenProps = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

export type ServerSetupScreenProps = NativeStackScreenProps<
  AuthStackParamList,
  'ServerSetup'
>;

export type LoginScreenProps = NativeStackScreenProps<
  AuthStackParamList,
  'Login'
>;

// ─── Main (app) stack ────────────────────────────────────────────────────────

export type MainStackParamList = {
  HouseholdPicker: undefined;
  ListDetail: undefined;
  Settings: undefined;
  HouseholdDetail: { householdId: number; householdName: string };
  HouseholdItems: { householdId: number; householdName: string };
};

export type HouseholdPickerScreenProps = NativeStackScreenProps<MainStackParamList, 'HouseholdPicker'>;
export type ListDetailScreenProps = NativeStackScreenProps<MainStackParamList, 'ListDetail'>;
export type SettingsScreenProps = NativeStackScreenProps<MainStackParamList, 'Settings'>;
export type HouseholdDetailScreenProps = NativeStackScreenProps<MainStackParamList, 'HouseholdDetail'>;
export type HouseholdItemsScreenProps = NativeStackScreenProps<MainStackParamList, 'HouseholdItems'>;
