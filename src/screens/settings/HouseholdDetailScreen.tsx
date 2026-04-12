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
} from 'react-native';
import Sheet from '@/components/Sheet';
import BottomNav from '@/components/BottomNav';
import { SectionLabel, Card, Field, PrimaryBtn, SecondaryBtn } from '@/components/settings';
import { MembersSection } from './MembersSection';
import { ListsSection } from './ListsSection';
import { CategoriesSection } from './CategoriesSection';
import { useHouseholdDetail } from '@/store/householdDetailStore';
import { Colors, Spacing, FontSize } from '@/theme';
import type { HouseholdDetailScreenProps } from '@/navigation/types';

type ModalKind = 'rename' | 'leave' | null;

export default function HouseholdDetailScreen({ navigation, route }: HouseholdDetailScreenProps) {
  const { householdId, householdName: initialName } = route.params;

  const { loading, householdName, initialize, loadAll, renameHousehold, leaveHousehold } = useHouseholdDetail();

  const [modal, setModal] = useState<ModalKind>(null);
  const [renameValue, setRenameValue] = useState('');
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    initialize(householdId, initialName);
    void loadAll();
  }, [householdId, initialName, initialize, loadAll]);

  async function handleRename() {
    if (!renameValue.trim()) return;
    setSaving(true);
    try {
      await renameHousehold(renameValue.trim());
      setModal(null);
    } catch (e: unknown) {
      Alert.alert('Not yet available', e instanceof Error ? e.message : 'Failed to rename household.');
    } finally {
      setSaving(false);
    }
  }

  async function handleLeave() {
    setSaving(true);
    try {
      await leaveHousehold();
      navigation.goBack();
    } catch (e: unknown) {
      Alert.alert('Not yet available', e instanceof Error ? e.message : 'Failed to leave household.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backChevron}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{householdName}</Text>
        <TouchableOpacity
          onPress={() => { setRenameValue(householdName); setModal('rename'); }}
          style={styles.editBtn}
        >
          <Text style={styles.editLabel}>Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} scrollEnabled={scrollEnabled}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={Colors.mint} />
          </View>
        ) : (
          <>
            <MembersSection />
            <ListsSection />
            <CategoriesSection onDragScrollLock={(locked) => setScrollEnabled(!locked)} />

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
        <Field label="Household name" value={renameValue} onChangeText={setRenameValue} placeholder="e.g. Home" />
        <PrimaryBtn label="Save" onPress={handleRename} loading={saving} />
        <SecondaryBtn label="Cancel" onPress={() => setModal(null)} />
        <View style={{ height: Spacing.xl }} />
      </Sheet>

      <Sheet visible={modal === 'leave'} title={`Leave "${householdName}"`} onClose={() => setModal(null)}>
        <View style={styles.sheetBody}>
          <Text style={styles.sheetBodyText}>
            {"You'll lose access to this household's lists and data. This can't be undone."}
          </Text>
        </View>
        <PrimaryBtn label="Leave household" onPress={handleLeave} loading={saving} danger />
        <SecondaryBtn label="Cancel" onPress={() => setModal(null)} />
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
  dangerRow: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md + 2 },
  dangerLabel: { fontSize: FontSize.body, fontWeight: '700', color: '#e05555' },
  sheetBody: { padding: Spacing.xl, paddingBottom: Spacing.sm },
  sheetBodyText: { fontSize: FontSize.body, color: Colors.textFaded, lineHeight: 22 },
});
