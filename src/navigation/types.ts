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
};

export type HouseholdPickerScreenProps = NativeStackScreenProps<MainStackParamList, 'HouseholdPicker'>;
export type ListDetailScreenProps = NativeStackScreenProps<MainStackParamList, 'ListDetail'>;
