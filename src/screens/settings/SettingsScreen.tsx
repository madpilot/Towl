import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import Sheet from '@/components/Sheet';
import { logout } from '@/auth/authManager';
import { useAuthStore } from '@/store/authStore';
import BottomNav from '@/components/BottomNav';
import TommyOwl from '@/components/TommyOwl';
import { Colors, Spacing, Radii, FontSize } from '@/theme';
import type { Household } from '@/api/households';
import type { SettingsScreenProps } from '@/navigation/types';

// ─── Avatar ──────────────────────────────────────────────────────────────────

function Avatar({ name, size = 52 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <View style={[avatarStyles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
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
  },
  text: {
    color: Colors.white,
    fontWeight: '800',
  },
});

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return (
    <View style={sectionStyles.row}>
      <Text style={sectionStyles.text}>{label.toUpperCase()}</Text>
      <View style={sectionStyles.rule} />
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xs,
  },
  text: {
    fontSize: FontSize.tiny,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: Colors.mintLight,
  },
  rule: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.mintPale,
  },
});

// ─── Card ─────────────────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return <View style={cardStyles.card}>{children}</View>;
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radii.lg,
    borderWidth: 1.5,
    borderColor: Colors.mintPale,
    marginHorizontal: Spacing.lg,
    overflow: 'hidden',
  },
});

// ─── Row ──────────────────────────────────────────────────────────────────────

type RowProps = {
  label: string;
  sub?: string;
  onPress?: () => void;
  danger?: boolean;
  showChevron?: boolean;
};

function Row({ label, sub, onPress, danger = false, showChevron = true }: RowProps) {
  return (
    <TouchableOpacity
      style={rowStyles.row}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={rowStyles.text}>
        <Text style={[rowStyles.label, danger && rowStyles.dangerLabel]}>{label}</Text>
        {sub ? <Text style={rowStyles.sub}>{sub}</Text> : null}
      </View>
      {showChevron && <Text style={rowStyles.chevron}>›</Text>}
    </TouchableOpacity>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md + 2,
  },
  text: {
    flex: 1,
  },
  label: {
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.textDark,
  },
  dangerLabel: {
    color: '#e05555',
  },
  sub: {
    fontSize: FontSize.small,
    color: Colors.textFaded,
    marginTop: 2,
  },
  chevron: {
    fontSize: 20,
    color: Colors.mintPale,
    fontWeight: '700',
  },
});

// ─── Separator ────────────────────────────────────────────────────────────────

function Sep() {
  return <View style={{ height: 1, backgroundColor: Colors.mintBg, marginLeft: Spacing.xl }} />;
}

// ─── Field ────────────────────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
}) {
  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.label}>{label}</Text>
      <TextInput
        style={fieldStyles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textFaded}
        secureTextEntry={secureTextEntry}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrap: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
  },
  label: {
    fontSize: FontSize.label,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: Colors.mintLight,
    marginBottom: Spacing.xs,
  },
  input: {
    fontSize: FontSize.body,
    fontWeight: '600',
    color: Colors.textDark,
    borderWidth: 1.5,
    borderColor: Colors.mintPale,
    borderRadius: Radii.md,
    padding: Spacing.md,
    backgroundColor: Colors.mintBg,
  },
});

// ─── Buttons ──────────────────────────────────────────────────────────────────

function PrimaryBtn({
  label,
  onPress,
  loading = false,
  danger = false,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[btnStyles.btn, danger && btnStyles.dangerBtn]}
      onPress={onPress}
      activeOpacity={0.8}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator color={Colors.white} />
      ) : (
        <Text style={btnStyles.label}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

function SecondaryBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={btnStyles.secondaryBtn} onPress={onPress} activeOpacity={0.8}>
      <Text style={btnStyles.secondaryLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const btnStyles = StyleSheet.create({
  btn: {
    margin: Spacing.xl,
    marginBottom: 0,
    padding: Spacing.md + 1,
    borderRadius: Radii.md,
    backgroundColor: Colors.mint,
    alignItems: 'center',
  },
  dangerBtn: {
    backgroundColor: '#e05555',
  },
  label: {
    fontSize: FontSize.body,
    fontWeight: '800',
    color: Colors.white,
  },
  secondaryBtn: {
    margin: Spacing.xl,
    marginBottom: 0,
    padding: Spacing.md + 1,
    borderRadius: Radii.md,
    borderWidth: 1.5,
    borderColor: Colors.mintPale,
    alignItems: 'center',
  },
  secondaryLabel: {
    fontSize: FontSize.body,
    fontWeight: '800',
    color: Colors.mint,
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

  const loadHouseholds = useCallback(async () => {
    if (!householdsApi) return;
    try {
      setLoadingHouseholds(true);
      const data = await householdsApi.getHouseholds();
      setHouseholds(data);
    } catch {
      Alert.alert('Error', 'Could not load households.');
    } finally {
      setLoadingHouseholds(false);
    }
  }, [householdsApi]);

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
          <Avatar name={displayName} size={52} />
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

        <Text style={styles.footer}>Towl · KitchenOwl sync</Text>
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
  footer: {
    fontSize: FontSize.tiny,
    color: Colors.mintPale,
    textAlign: 'center',
    marginTop: Spacing.xl,
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
