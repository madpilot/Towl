import React, { useCallback, useEffect, useState } from 'react';
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
import { useAuthStore } from '@/store/authStore';
import Sheet from '@/components/Sheet';
import BottomNav from '@/components/BottomNav';
import { SectionLabel, Card, Field, PrimaryBtn, SecondaryBtn } from '@/components/settings/SettingsUI';
import { MembersSection } from './MembersSection';
import { ListsSection } from './ListsSection';
import { CategoriesSection } from './CategoriesSection';
import { Colors, Spacing, FontSize } from '@/theme';
import type { ApiShoppingList } from '@/api/shoppinglists';
import type { HouseholdCategory, HouseholdMember } from '@/api/households';
import type { HouseholdDetailScreenProps } from '@/navigation/types';

type ModalKind =
  | 'renameHousehold'
  | 'newList' | 'editList'
  | 'newCategory' | 'editCategory'
  | 'inviteMember'
  | 'removeMember'
  | 'leave'
  | null;

export default function HouseholdDetailScreen({ navigation, route }: HouseholdDetailScreenProps) {
  const { householdId, householdName: initialName } = route.params;

  const householdsApi = useAuthStore((s) => s.householdsApi);
  const shoppingListsApi = useAuthStore((s) => s.shoppingListsApi);

  const [householdName, setHouseholdName] = useState(initialName);
  const [lists, setLists] = useState<ApiShoppingList[]>([]);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [categories, setCategories] = useState<HouseholdCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalKind>(null);
  const [saving, setSaving] = useState(false);

  // Rename household
  const [renameValue, setRenameValue] = useState('');

  // List editing
  const [listName, setListName] = useState('');
  const [editingListId, setEditingListId] = useState<number | null>(null);

  // Category editing
  const [catName, setCatName] = useState('');
  const [editingCatId, setEditingCatId] = useState<number | null>(null);

  // Member actions
  const [inviteUsername, setInviteUsername] = useState('');
  const [removingMember, setRemovingMember] = useState<HouseholdMember | null>(null);

  const loadData = useCallback(async () => {
    if (!householdsApi || !shoppingListsApi) return;
    setLoading(true);
    try {
      const [listsData, categoriesData] = await Promise.allSettled([
        shoppingListsApi.getShoppingLists(householdId),
        householdsApi.getCategories(householdId),
      ]);
      if (listsData.status === 'fulfilled') setLists(listsData.value);
      if (categoriesData.status === 'fulfilled') setCategories(categoriesData.value);
      try {
        const membersData = await householdsApi.getMembers(householdId);
        setMembers(membersData);
      } catch {
        // Stub: not yet implemented
      }
    } catch {
      Alert.alert('Error', 'Could not load household data.');
    } finally {
      setLoading(false);
    }
  }, [householdsApi, shoppingListsApi, householdId]);

  useEffect(() => { void loadData(); }, [loadData]);

  // ── List actions ──────────────────────────────────────────────────────────

  async function handleCreateList() {
    if (!listName.trim() || !shoppingListsApi) return;
    setSaving(true);
    try {
      const created = await shoppingListsApi.createShoppingList(listName.trim(), householdId);
      setLists((prev) => [...prev, created]);
      setListName(''); setModal(null);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create list.');
    } finally { setSaving(false); }
  }

  async function handleRenameList() {
    if (!listName.trim() || editingListId === null || !shoppingListsApi) return;
    setSaving(true);
    try {
      await shoppingListsApi.renameShoppingList(editingListId, listName.trim());
      setLists((prev) => prev.map((l) => l.id === editingListId ? { ...l, name: listName.trim() } : l));
      setModal(null);
    } catch (e: unknown) {
      Alert.alert('Not yet available', e instanceof Error ? e.message : 'Failed to rename list.');
    } finally { setSaving(false); }
  }

  async function handleDeleteList() {
    if (editingListId === null || !shoppingListsApi) return;
    setSaving(true);
    try {
      await shoppingListsApi.deleteShoppingList(editingListId);
      setLists((prev) => prev.filter((l) => l.id !== editingListId));
      setModal(null);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to delete list.');
    } finally { setSaving(false); }
  }

  // ── Category actions ──────────────────────────────────────────────────────

  async function handleCreateCategory() {
    if (!catName.trim() || !householdsApi) return;
    setSaving(true);
    try {
      const created = await householdsApi.createCategory(householdId, catName.trim());
      setCategories((prev) => [...prev, created]);
      setCatName(''); setModal(null);
    } catch (e: unknown) {
      Alert.alert('Not yet available', e instanceof Error ? e.message : 'Failed to create category.');
    } finally { setSaving(false); }
  }

  async function handleUpdateCategory() {
    if (!catName.trim() || editingCatId === null || !householdsApi) return;
    setSaving(true);
    try {
      await householdsApi.updateCategory(householdId, editingCatId, catName.trim());
      setCategories((prev) => prev.map((c) => c.id === editingCatId ? { ...c, name: catName.trim() } : c));
      setModal(null);
    } catch (e: unknown) {
      Alert.alert('Not yet available', e instanceof Error ? e.message : 'Failed to update category.');
    } finally { setSaving(false); }
  }

  async function handleDeleteCategory() {
    if (editingCatId === null || !householdsApi) return;
    setSaving(true);
    try {
      await householdsApi.deleteCategory(householdId, editingCatId);
      setCategories((prev) => prev.filter((c) => c.id !== editingCatId));
      setModal(null);
    } catch (e: unknown) {
      Alert.alert('Not yet available', e instanceof Error ? e.message : 'Failed to delete category.');
    } finally { setSaving(false); }
  }

  // ── Household / member actions ────────────────────────────────────────────

  async function handleRenameHousehold() {
    if (!renameValue.trim() || !householdsApi) return;
    setSaving(true);
    try {
      await householdsApi.renameHousehold(householdId, renameValue.trim());
      setHouseholdName(renameValue.trim());
      setModal(null);
    } catch (e: unknown) {
      Alert.alert('Not yet available', e instanceof Error ? e.message : 'Failed to rename household.');
    } finally { setSaving(false); }
  }

  async function handleInviteMember() {
    if (!inviteUsername.trim() || !householdsApi) return;
    setSaving(true);
    try {
      await householdsApi.inviteMember(householdId, inviteUsername.trim());
      setInviteUsername(''); setModal(null);
      void loadData();
    } catch (e: unknown) {
      Alert.alert('Not yet available', e instanceof Error ? e.message : 'Failed to invite member.');
    } finally { setSaving(false); }
  }

  async function handleRemoveMember() {
    if (!removingMember || !householdsApi) return;
    setSaving(true);
    try {
      await householdsApi.removeMember(householdId, removingMember.id);
      setMembers((prev) => prev.filter((m) => m.id !== removingMember.id));
      setModal(null);
    } catch (e: unknown) {
      Alert.alert('Not yet available', e instanceof Error ? e.message : 'Failed to remove member.');
    } finally { setSaving(false); }
  }

  async function handleLeave() {
    if (!householdsApi) return;
    setSaving(true);
    try {
      await householdsApi.leaveHousehold(householdId);
      navigation.goBack();
    } catch (e: unknown) {
      Alert.alert('Not yet available', e instanceof Error ? e.message : 'Failed to leave household.');
    } finally { setSaving(false); }
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backChevron}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{householdName}</Text>
        <TouchableOpacity
          onPress={() => { setRenameValue(householdName); setModal('renameHousehold'); }}
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
            <MembersSection
              members={members}
              onInvite={() => { setInviteUsername(''); setModal('inviteMember'); }}
              onRemove={(m) => { setRemovingMember(m); setModal('removeMember'); }}
            />

            <ListsSection
              lists={lists}
              onEdit={(list) => { setEditingListId(list.id); setListName(list.name); setModal('editList'); }}
              onNew={() => { setListName(''); setModal('newList'); }}
            />

            <CategoriesSection
              categories={categories}
              onEdit={(cat) => { setEditingCatId(cat.id); setCatName(cat.name); setModal('editCategory'); }}
              onNew={() => { setCatName(''); setModal('newCategory'); }}
            />

            <SectionLabel label="Danger Zone" />
            <Card>
              <TouchableOpacity style={styles.dangerRow} onPress={() => setModal('leave')} activeOpacity={0.7}>
                <Text style={styles.dangerLabel}>Leave household</Text>
              </TouchableOpacity>
            </Card>
          </>
        )}
      </ScrollView>

      <BottomNav active="settings" />

      <Sheet visible={modal === 'renameHousehold'} title="Rename household" onClose={() => setModal(null)}>
        <Field label="Household name" value={renameValue} onChangeText={setRenameValue} placeholder="e.g. Home" />
        <PrimaryBtn label="Save" onPress={handleRenameHousehold} loading={saving} />
        <SecondaryBtn label="Cancel" onPress={() => setModal(null)} />
        <View style={{ height: Spacing.xl }} />
      </Sheet>

      <Sheet visible={modal === 'newList'} title="New list" onClose={() => setModal(null)}>
        <Field label="List name" value={listName} onChangeText={setListName} placeholder="e.g. Weekend Shop" />
        <PrimaryBtn label="Create list" onPress={handleCreateList} loading={saving} />
        <SecondaryBtn label="Cancel" onPress={() => setModal(null)} />
        <View style={{ height: Spacing.xl }} />
      </Sheet>

      <Sheet visible={modal === 'editList'} title="Edit list" onClose={() => setModal(null)}>
        <Field label="List name" value={listName} onChangeText={setListName} placeholder="e.g. Weekend Shop" />
        <PrimaryBtn label="Save changes" onPress={handleRenameList} loading={saving} />
        <PrimaryBtn label="Delete list" onPress={handleDeleteList} loading={saving} danger />
        <SecondaryBtn label="Cancel" onPress={() => setModal(null)} />
        <View style={{ height: Spacing.xl }} />
      </Sheet>

      <Sheet visible={modal === 'newCategory'} title="New category" onClose={() => setModal(null)}>
        <Field label="Category name" value={catName} onChangeText={setCatName} placeholder="e.g. Frozen" />
        <PrimaryBtn label="Add category" onPress={handleCreateCategory} loading={saving} />
        <SecondaryBtn label="Cancel" onPress={() => setModal(null)} />
        <View style={{ height: Spacing.xl }} />
      </Sheet>

      <Sheet visible={modal === 'editCategory'} title="Edit category" onClose={() => setModal(null)}>
        <Field label="Category name" value={catName} onChangeText={setCatName} placeholder="Category name" />
        <PrimaryBtn label="Save changes" onPress={handleUpdateCategory} loading={saving} />
        <PrimaryBtn label="Delete category" onPress={handleDeleteCategory} loading={saving} danger />
        <SecondaryBtn label="Cancel" onPress={() => setModal(null)} />
        <View style={{ height: Spacing.xl }} />
      </Sheet>

      <Sheet visible={modal === 'inviteMember'} title="Invite member" onClose={() => setModal(null)}>
        <Field label="KitchenOwl username" value={inviteUsername} onChangeText={setInviteUsername} placeholder="username" />
        <PrimaryBtn label="Send invite" onPress={handleInviteMember} loading={saving} />
        <SecondaryBtn label="Cancel" onPress={() => setModal(null)} />
        <View style={{ height: Spacing.xl }} />
      </Sheet>

      <Sheet visible={modal === 'removeMember'} title={`Remove ${removingMember?.name ?? 'member'}`} onClose={() => setModal(null)}>
        <View style={styles.sheetBody}>
          <Text style={styles.sheetBodyText}>
            {removingMember?.name} will lose access to this household.
          </Text>
        </View>
        <PrimaryBtn label="Remove member" onPress={handleRemoveMember} loading={saving} danger />
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
