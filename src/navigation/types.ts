import type { NativeStackScreenProps } from '@react-navigation/native-stack';

// ─── Auth stack ──────────────────────────────────────────────────────────────

export type AuthStackParamList = {
  ServerSetup: undefined;
  Login: { serverUrl: string };
};

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
  Lists: undefined;
  ListDetail: {
    listLocalId: string;
    listName: string;
    listServerId: number | null;
  };
};

export type ListsScreenProps = NativeStackScreenProps<MainStackParamList, 'Lists'>;
export type ListDetailScreenProps = NativeStackScreenProps<MainStackParamList, 'ListDetail'>;
