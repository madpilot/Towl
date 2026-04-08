import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import Sheet from '@/components/Sheet';
import { logout } from '@/auth/authManager';
import { useAuthStore } from '@/store/authStore';
import BottomNav from '@/components/BottomNav';
import { useHouseholdStore } from '@/store/householdStore';
import TommyOwl from '@/components/TommyOwl';
import {
  SectionLabel,
  Card,
  Sep,
  Row,
  Field,
  PrimaryBtn,
  SecondaryBtn,
} from '@/components/settings/SettingsUI';
import { Colors, Spacing, Radii, FontSize } from '@/theme';
import { SECURE_STORE_KEYS } from '@/utils/constants';
import type { Household } from '@/api/households';
import type { SettingsScreenProps } from '@/navigation/types';

// ─── Avatar ──────────────────────────────────────────────────────────────────

function Avatar({ name, size = 52, uri }: { name: string; size?: number; uri?: string | null }) {
  const initials = name
    .split(' ')
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const containerStyle = [avatarStyles.circle, { width: size, height: size, borderRadius: size / 2 }];
  if (uri) {
    return (
      <View style={containerStyle}>
        <Image source={{ uri }} style={[avatarStyles.image, { borderRadius: size / 2 }]} />
      </View>
    );
  }
  return (
    <View style={containerStyle}>
      <Text style={[avatarStyles.text, { fontSize: size * 0.33 }]}>{initials}</Text>
    </View>
  );
}

const avatarStyles = StyleSheet.create({
  circle: {
    backgroundColor: Colors.mintLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.mintPale,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  text: {
    color: Colors.white,
    fontWeight: '800',
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

type ModalKind =
  | 'editName'
  | 'editEmail'
  | 'changePassword'
  | 'sessions'
  | 'newHousehold'
  | 'logout'
  | null;

export default function SettingsScreen({ navigation }: SettingsScreenProps) {
  const user = useAuthStore((s) => s.user);
  const authApi = useAuthStore((s) => s.authApi);
  const householdsApi = useAuthStore((s) => s.householdsApi);
  const setStoreHouseholds = useHouseholdStore((s) => s.setHouseholds);

  const [households, setHouseholds] = useState<Household[]>([]);
  const [loadingHouseholds, setLoadingHouseholds] = useState(true);
  const [modal, setModal] = useState<ModalKind>(null);

  // Edit name
  const [editName, setEditName] = useState('');
  const [savingName, setSavingName] = useState(false);

  // Edit email
  const [editEmail, setEditEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

  // Change password
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  // New household
  const [newHHName, setNewHHName] = useState('');
  const [creatingHH, setCreatingHH] = useState(false);

  // Avatar
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  useEffect(() => {
    SecureStore.getItemAsync(SECURE_STORE_KEYS.AVATAR_URI)
      .then((uri) => { if (uri) setAvatarUri(uri); })
      .catch(() => {});
  }, []);

  function handleAvatarPress() {
    Alert.alert('Profile photo', undefined, [
      {
        text: 'Take photo',
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) {
            Alert.alert('Permission required', 'Camera access is needed to take a photo.');
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
          });
          if (!result.canceled && result.assets[0]) {
            const uri = result.assets[0].uri;
            setAvatarUri(uri);
            await SecureStore.setItemAsync(SECURE_STORE_KEYS.AVATAR_URI, uri);
          }
        },
      },
      {
        text: 'Choose from library',
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) {
            Alert.alert('Permission required', 'Photo library access is needed to choose a photo.');
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
          });
          if (!result.canceled && result.assets[0]) {
            const uri = result.assets[0].uri;
            setAvatarUri(uri);
            await SecureStore.setItemAsync(SECURE_STORE_KEYS.AVATAR_URI, uri);
          }
        },
      },
      ...(avatarUri
        ? [{
            text: 'Delete photo',
            style: 'destructive' as const,
            onPress: async () => {
              setAvatarUri(null);
              await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.AVATAR_URI);
            },
          }]
        : []),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }

  const loadHouseholds = useCallback(async () => {
    if (!householdsApi) return;
    try {
      setLoadingHouseholds(true);
      const data = await householdsApi.getHouseholds();
      setHouseholds(data);
      setStoreHouseholds(data);
    } catch {
      Alert.alert('Error', 'Could not load households.');
    } finally {
      setLoadingHouseholds(false);
    }
  }, [householdsApi, setStoreHouseholds]);

  useEffect(() => { void loadHouseholds(); }, [loadHouseholds]);

  async function handleSaveName() {
    if (!editName.trim() || !authApi) return;
    setSavingName(true);
    try {
      await authApi.updateProfile(editName.trim());
      setModal(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to update name.';
      Alert.alert('Error', msg);
    } finally {
      setSavingName(false);
    }
  }

  async function handleSaveEmail() {
    if (!authApi) return;
    setSavingEmail(true);
    try {
      await authApi.updateEmail(editEmail.trim());
      setModal(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to update email.';
      Alert.alert('Not yet available', msg);
    } finally {
      setSavingEmail(false);
    }
  }

  async function handleChangePassword() {
    if (!pwNew || !authApi) return;
    if (pwNew !== pwConfirm) {
      Alert.alert('Error', 'New passwords do not match.');
      return;
    }
    setSavingPw(true);
    try {
      await authApi.changePassword(pwCurrent, pwNew);
      setModal(null);
      setPwCurrent(''); setPwNew(''); setPwConfirm('');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to change password.';
      Alert.alert('Not yet available', msg);
    } finally {
      setSavingPw(false);
    }
  }

  async function handleCreateHousehold() {
    if (!newHHName.trim() || !householdsApi) return;
    setCreatingHH(true);
    try {
      await householdsApi.createHousehold(newHHName.trim());
      setNewHHName('');
      setModal(null);
      void loadHouseholds();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to create household.';
      Alert.alert('Error', msg);
    } finally {
      setCreatingHH(false);
    }
  }

  async function handleLogout() {
    setModal(null);
    await logout();
  }

  const displayName = user?.name ?? user?.username ?? 'You';
  const displayUsername = user?.username ?? '';

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <TommyOwl size={40} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Profile hero */}
        <View style={styles.hero}>
          <TouchableOpacity onPress={handleAvatarPress} activeOpacity={0.8}>
            <Avatar name={displayName} size={52} uri={avatarUri} />
          </TouchableOpacity>
          <View>
            <Text style={styles.heroName}>{displayName}</Text>
            {displayUsername ? (
              <Text style={styles.heroSub}>@{displayUsername}</Text>
            ) : null}
          </View>
        </View>

        {/* Profile section */}
        <SectionLabel label="Profile" />
        <Card>
          <Row
            label="Name"
            sub={displayName}
            onPress={() => { setEditName(displayName); setModal('editName'); }}
          />
          <Sep />
          <Row
            label="Email"
            sub={user?.email}
            onPress={() => { setEditEmail(user?.email ?? ''); setModal('editEmail'); }}
          />
          <Sep />
          <Row
            label="Change password"
            onPress={() => { setPwCurrent(''); setPwNew(''); setPwConfirm(''); setModal('changePassword'); }}
          />
          <Sep />
          <Row
            label="Active sessions"
            onPress={() => setModal('sessions')}
          />
        </Card>

        {/* Households section */}
        <SectionLabel label="Households" />
        <Card>
          {loadingHouseholds ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={Colors.mint} />
            </View>
          ) : (
            households.map((hh, i) => (
              <View key={hh.id}>
                <Row
                  label={hh.name}
                  onPress={() => navigation.navigate('HouseholdDetail', {
                    householdId: hh.id,
                    householdName: hh.name,
                  })}
                />
                {i < households.length - 1 && <Sep />}
              </View>
            ))
          )}
          <Sep />
          <TouchableOpacity
            style={styles.addRow}
            onPress={() => { setNewHHName(''); setModal('newHousehold'); }}
            activeOpacity={0.7}
          >
            <Text style={styles.addLabel}>+ New household</Text>
          </TouchableOpacity>
        </Card>

        {/* Log out */}
        <View style={{ height: Spacing.lg }} />
        <Card>
          <Row
            label="Log out"
            onPress={() => setModal('logout')}
            danger
            showChevron={false}
          />
        </Card>

      </ScrollView>

      <BottomNav active="settings" />

      {/* Edit name modal */}
      <Sheet visible={modal === 'editName'} title="Your name" onClose={() => setModal(null)}>
        <Field label="Full name" value={editName} onChangeText={setEditName} placeholder="Your name" />
        <PrimaryBtn label="Save changes" onPress={handleSaveName} loading={savingName} />
        <SecondaryBtn label="Cancel" onPress={() => setModal(null)} />
        <View style={{ height: Spacing.xl }} />
      </Sheet>

      {/* Edit email modal */}
      <Sheet visible={modal === 'editEmail'} title="Email address" onClose={() => setModal(null)}>
        <Field label="Email" value={editEmail} onChangeText={setEditEmail} placeholder="you@example.com" />
        <PrimaryBtn label="Save changes" onPress={handleSaveEmail} loading={savingEmail} />
        <SecondaryBtn label="Cancel" onPress={() => setModal(null)} />
        <View style={{ height: Spacing.xl }} />
      </Sheet>

      {/* Change password modal */}
      <Sheet visible={modal === 'changePassword'} title="Change password" onClose={() => setModal(null)}>
        <Field label="Current password" value={pwCurrent} onChangeText={setPwCurrent} secureTextEntry />
        <Field label="New password" value={pwNew} onChangeText={setPwNew} secureTextEntry />
        <Field label="Confirm new password" value={pwConfirm} onChangeText={setPwConfirm} secureTextEntry />
        <PrimaryBtn label="Update password" onPress={handleChangePassword} loading={savingPw} />
        <SecondaryBtn label="Cancel" onPress={() => setModal(null)} />
        <View style={{ height: Spacing.xl }} />
      </Sheet>

      {/* Sessions stub modal */}
      <Sheet visible={modal === 'sessions'} title="Active sessions" onClose={() => setModal(null)}>
        <View style={styles.stubWrap}>
          <Text style={styles.stubText}>
            {"Active session management requires a KitchenOwl API endpoint that hasn't been confirmed yet."}
          </Text>
        </View>
        <SecondaryBtn label="Done" onPress={() => setModal(null)} />
        <View style={{ height: Spacing.xl }} />
      </Sheet>

      {/* New household modal */}
      <Sheet visible={modal === 'newHousehold'} title="New household" onClose={() => setModal(null)}>
        <Field
          label="Household name"
          value={newHHName}
          onChangeText={setNewHHName}
          placeholder="e.g. Beach House"
        />
        <PrimaryBtn label="Create household" onPress={handleCreateHousehold} loading={creatingHH} />
        <SecondaryBtn label="Cancel" onPress={() => setModal(null)} />
        <View style={{ height: Spacing.xl }} />
      </Sheet>

      {/* Logout confirmation modal */}
      <Sheet visible={modal === 'logout'} title="Log out" onClose={() => setModal(null)}>
        <View style={styles.stubWrap}>
          <Text style={styles.stubText}>
            {"You'll be returned to the server login screen. Your data stays safe on your KitchenOwl server."}
          </Text>
        </View>
        <PrimaryBtn label="Log out" onPress={handleLogout} danger />
        <SecondaryBtn label="Cancel" onPress={() => setModal(null)} />
        <View style={{ height: Spacing.xl }} />
      </Sheet>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.mintBg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: FontSize.title,
    fontWeight: '900',
    color: Colors.textDark,
    letterSpacing: -0.5,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    marginHorizontal: Spacing.lg,
    padding: Spacing.lg,
    backgroundColor: Colors.white,
    borderRadius: Radii.lg,
    borderWidth: 1.5,
    borderColor: Colors.mintPale,
  },
  heroName: {
    fontSize: FontSize.heading,
    fontWeight: '800',
    color: Colors.textDark,
  },
  heroSub: {
    fontSize: FontSize.small,
    color: Colors.textFaded,
    marginTop: 2,
  },
  loadingRow: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  stubWrap: {
    padding: Spacing.xl,
    paddingBottom: Spacing.sm,
  },
  stubText: {
    fontSize: FontSize.body,
    color: Colors.textFaded,
    lineHeight: 22,
  },
  addRow: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md + 2,
  },
  addLabel: {
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.mint,
  },
});
