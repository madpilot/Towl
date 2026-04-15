import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  StyleSheet,
  TextInput,
} from 'react-native';
import Sheet from '@/components/Sheet';
import BottomNav from '@/components/BottomNav';
import { SectionLabel, Card, PrimaryBtn } from '@/components/settings';
import { MembersSection } from './MembersSection';
import { ListsSection } from './ListsSection';
import { useHouseholdDetail } from '@/store/householdDetailStore';
import { Colors, Spacing, Radii, FontSize } from '@/theme';
import type { HouseholdDetailScreenProps } from '@/navigation/types';

type ModalKind = 'rename' | 'leave' | null;

export default function HouseholdDetailScreen({ navigation, route }: HouseholdDetailScreenProps) {
  const { householdId, householdName: initialName } = route.params;

  const { loading, householdName, initialize, loadAll, renameHousehold, leaveHousehold } =
    useHouseholdDetail();

  const [modal, setModal] = useState<ModalKind>(null);
  const [renameValue, setRenameValue] = useState('');
  const [action, setAction] = useState<ModalKind>(null);
  const saving = action !== null;

  useEffect(() => {
    initialize(householdId, initialName);
    void loadAll();
  }, [householdId, initialName, initialize, loadAll]);

  async function handleRename() {
    if (!renameValue.trim()) {
      return;
    }
    setAction('rename');
    try {
      await renameHousehold(renameValue.trim());
      setModal(null);
    } catch (e: unknown) {
      Alert.alert(
        'Not yet available',
        e instanceof Error ? e.message : 'Failed to rename household.'
      );
    } finally {
      setAction(null);
    }
  }

  async function handleLeave() {
    setAction('leave');
    try {
      await leaveHousehold();
      navigation.goBack();
    } catch (e: unknown) {
      Alert.alert(
        'Not yet available',
        e instanceof Error ? e.message : 'Failed to leave household.'
      );
    } finally {
      setAction(null);
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backChevron}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {householdName}
        </Text>
        <TouchableOpacity
          onPress={() => {
            setRenameValue(householdName);
            setModal('rename');
          }}
          style={styles.editBtn}
        >
          <Text style={styles.editLabel}>Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={Colors.mint} />
          </View>
        ) : (
          <>
            <MembersSection />
            <ListsSection />

            <SectionLabel label="Categories" />
            <Card>
              <TouchableOpacity
                style={styles.navRow}
                onPress={() =>
                  navigation.navigate('HouseholdCategories', { householdId, householdName })
                }
                activeOpacity={0.7}
              >
                <Text style={styles.navLabel}>Manage categories</Text>
                <Text style={styles.navChevron}>›</Text>
              </TouchableOpacity>
            </Card>

            <SectionLabel label="Items" />
            <Card>
              <TouchableOpacity
                style={styles.navRow}
                onPress={() =>
                  navigation.navigate('HouseholdItems', { householdId, householdName })
                }
                activeOpacity={0.7}
              >
                <Text style={styles.navLabel}>Manage items</Text>
                <Text style={styles.navChevron}>›</Text>
              </TouchableOpacity>
            </Card>

            <SectionLabel label="Danger Zone" />
            <Card>
              <TouchableOpacity
                style={styles.dangerRow}
                onPress={() => setModal('leave')}
                activeOpacity={0.7}
              >
                <Text style={styles.dangerLabel}>Leave household</Text>
              </TouchableOpacity>
            </Card>
          </>
        )}
      </ScrollView>

      <BottomNav active="settings" />

      <Sheet visible={modal === 'rename'} title="Rename household" onClose={() => setModal(null)}>
        <View style={styles.nameRow}>
          <TextInput
            style={styles.nameInput}
            value={renameValue}
            onChangeText={setRenameValue}
            placeholder="e.g. Home"
            placeholderTextColor={Colors.textFaded}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
          />
        </View>
        <PrimaryBtn
          label="Save"
          onPress={handleRename}
          loading={action === 'rename'}
          disabled={saving}
        />
        <View style={{ height: Spacing.xl }} />
      </Sheet>

      <Sheet
        visible={modal === 'leave'}
        title={`Leave "${householdName}"`}
        onClose={() => setModal(null)}
      >
        <View style={styles.sheetBody}>
          <Text style={styles.sheetBodyText}>
            {"You'll lose access to this household's lists and data. This can't be undone."}
          </Text>
        </View>
        <PrimaryBtn
          label="Leave household"
          onPress={handleLeave}
          loading={action === 'leave'}
          disabled={saving}
          danger
        />
        <View style={{ height: Spacing.xl }} />
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.mintBg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  backBtn: { paddingRight: Spacing.sm },
  backChevron: { fontSize: 28, color: Colors.mint, fontWeight: '300', lineHeight: 32 },
  title: {
    flex: 1,
    fontSize: FontSize.heading + 2,
    fontWeight: '900',
    color: Colors.textDark,
    letterSpacing: -0.3,
  },
  editBtn: { paddingLeft: Spacing.sm },
  editLabel: { fontSize: FontSize.body, fontWeight: '700', color: Colors.mintLight },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 100 },
  center: { padding: Spacing.xxl, alignItems: 'center' },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md + 2,
  },
  navLabel: { flex: 1, fontSize: FontSize.body, fontWeight: '700', color: Colors.textDark },
  navChevron: { fontSize: 20, color: Colors.mintPale, fontWeight: '700' },
  dangerRow: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md + 2 },
  dangerLabel: { fontSize: FontSize.body, fontWeight: '700', color: '#e05555' },
  sheetBody: { padding: Spacing.xl, paddingBottom: Spacing.sm },
  sheetBodyText: { fontSize: FontSize.body, color: Colors.textFaded, lineHeight: 22 },

  // Sheet — name input
  nameRow: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  nameInput: {
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
