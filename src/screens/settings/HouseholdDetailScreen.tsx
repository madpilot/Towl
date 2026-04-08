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
import { useAuthStore } from '@/store/authStore';
import Sheet from '@/components/Sheet';
import BottomNav from '@/components/BottomNav';
import { Colors, Spacing, Radii, FontSize } from '@/theme';
import type { ApiShoppingList } from '@/api/shoppinglists';
import type { HouseholdCategory, HouseholdMember } from '@/api/households';
import type { HouseholdDetailScreenProps } from '@/navigation/types';

// ─── Shared UI helpers (same patterns as SettingsScreen) ─────────────────────

function SectionLabel({ label }: { label: string }) {
  return (
    <View style={sectionStyles.row}>
      <Text style={sectionStyles.text}>{label.toUpperCase()}</Text>
      <View style={sectionStyles.rule} />
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.xs },
  text: { fontSize: FontSize.tiny, fontWeight: '800', letterSpacing: 1.2, color: Colors.mintLight },
  rule: { flex: 1, height: 1, backgroundColor: Colors.mintPale },
});

function Card({ children }: { children: React.ReactNode }) {
  return <View style={cardStyles.card}>{children}</View>;
}

const cardStyles = StyleSheet.create({
  card: { backgroundColor: Colors.white, borderRadius: Radii.lg, borderWidth: 1.5, borderColor: Colors.mintPale, marginHorizontal: Spacing.lg, overflow: 'hidden' },
});

function Sep() {
  return <View style={{ height: 1, backgroundColor: Colors.mintBg, marginLeft: Spacing.xl }} />;
}

function Field({
  label, value, onChangeText, placeholder, secureTextEntry = false,
}: { label: string; value: string; onChangeText: (v: string) => void; placeholder?: string; secureTextEntry?: boolean }) {
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
  wrap: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm },
  label: { fontSize: FontSize.label, fontWeight: '700', letterSpacing: 0.5, color: Colors.mintLight, marginBottom: Spacing.xs },
  input: { fontSize: FontSize.body, fontWeight: '600', color: Colors.textDark, borderWidth: 1.5, borderColor: Colors.mintPale, borderRadius: Radii.md, padding: Spacing.md, backgroundColor: Colors.mintBg },
});

function PrimaryBtn({ label, onPress, loading = false, danger = false }: { label: string; onPress: () => void; loading?: boolean; danger?: boolean }) {
  return (
    <TouchableOpacity style={[btnStyles.btn, danger && btnStyles.dangerBtn]} onPress={onPress} activeOpacity={0.8} disabled={loading}>
      {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={btnStyles.label}>{label}</Text>}
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
  btn: { margin: Spacing.xl, marginBottom: 0, padding: Spacing.md + 1, borderRadius: Radii.md, backgroundColor: Colors.mint, alignItems: 'center' },
  dangerBtn: { backgroundColor: '#e05555' },
  label: { fontSize: FontSize.body, fontWeight: '800', color: Colors.white },
  secondaryBtn: { margin: Spacing.xl, marginBottom: 0, padding: Spacing.md + 1, borderRadius: Radii.md, borderWidth: 1.5, borderColor: Colors.mintPale, alignItems: 'center' },
  secondaryLabel: { fontSize: FontSize.body, fontWeight: '800', color: Colors.mint },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

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

  // Rename household
  const [renameValue, setRenameValue] = useState('');
  const [saving, setSaving] = useState(false);

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

      // Members endpoint is stubbed — load silently
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
      setListName('');
      setModal(null);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create list.');
    } finally {
      setSaving(false);
    }
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
    } finally {
      setSaving(false);
    }
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
    } finally {
      setSaving(false);
    }
  }

  // ── Category actions ──────────────────────────────────────────────────────

  async function handleCreateCategory() {
    if (!catName.trim() || !householdsApi) return;
    setSaving(true);
    try {
      const created = await householdsApi.createCategory(householdId, catName.trim());
      setCategories((prev) => [...prev, created]);
      setCatName('');
      setModal(null);
    } catch (e: unknown) {
      Alert.alert('Not yet available', e instanceof Error ? e.message : 'Failed to create category.');
    } finally {
      setSaving(false);
    }
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
    } finally {
      setSaving(false);
    }
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
    } finally {
      setSaving(false);
    }
  }

  // ── Household actions ─────────────────────────────────────────────────────

  async function handleRenameHousehold() {
    if (!renameValue.trim() || !householdsApi) return;
    setSaving(true);
    try {
      await householdsApi.renameHousehold(householdId, renameValue.trim());
      setHouseholdName(renameValue.trim());
      setModal(null);
    } catch (e: unknown) {
      Alert.alert('Not yet available', e instanceof Error ? e.message : 'Failed to rename household.');
    } finally {
      setSaving(false);
    }
  }

  async function handleInviteMember() {
    if (!inviteUsername.trim() || !householdsApi) return;
    setSaving(true);
    try {
      await householdsApi.inviteMember(householdId, inviteUsername.trim());
      setInviteUsername('');
      setModal(null);
      void loadData();
    } catch (e: unknown) {
      Alert.alert('Not yet available', e instanceof Error ? e.message : 'Failed to invite member.');
    } finally {
      setSaving(false);
    }
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
    } finally {
      setSaving(false);
    }
  }

  async function handleLeave() {
    if (!householdsApi) return;
    setSaving(true);
    try {
      await householdsApi.leaveHousehold(householdId);
      navigation.goBack();
    } catch (e: unknown) {
      Alert.alert('Not yet available', e instanceof Error ? e.message : 'Failed to leave household.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
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
            {/* Members */}
            <SectionLabel label="Members" />
            <Card>
              {members.length === 0 ? (
                <View style={styles.emptyRow}>
                  <Text style={styles.emptyText}>Members not yet available</Text>
                </View>
              ) : (
                members.map((m, i) => (
                  <View key={m.id}>
                    <View style={styles.memberRow}>
                      <View style={styles.memberAvatar}>
                        <Text style={styles.memberInitial}>{m.name[0]?.toUpperCase() ?? '?'}</Text>
                      </View>
                      <Text style={styles.memberName}>{m.name}</Text>
                      <TouchableOpacity
                        onPress={() => { setRemovingMember(m); setModal('removeMember'); }}
                        hitSlop={8}
                      >
                        <Text style={styles.removeBtn}>✕</Text>
                      </TouchableOpacity>
                    </View>
                    {i < members.length - 1 && <Sep />}
                  </View>
                ))
              )}
              <Sep />
              <TouchableOpacity
                style={styles.addRow}
                onPress={() => { setInviteUsername(''); setModal('inviteMember'); }}
                activeOpacity={0.7}
              >
                <Text style={styles.addLabel}>+ Invite member</Text>
              </TouchableOpacity>
            </Card>

            {/* Shopping lists */}
            <SectionLabel label="Shopping Lists" />
            <Card>
              {lists.length === 0 ? (
                <View style={styles.emptyRow}>
                  <Text style={styles.emptyText}>No lists yet.</Text>
                </View>
              ) : (
                lists.map((list, i) => (
                  <View key={list.id}>
                    <TouchableOpacity
                      style={styles.listRow}
                      onPress={() => { setEditingListId(list.id); setListName(list.name); setModal('editList'); }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.listText}>
                        <Text style={styles.listName}>{list.name}</Text>
                        <Text style={styles.listSub}>{list.items.length} item{list.items.length !== 1 ? 's' : ''}</Text>
                      </View>
                      <Text style={styles.chevron}>›</Text>
                    </TouchableOpacity>
                    {i < lists.length - 1 && <Sep />}
                  </View>
                ))
              )}
              <Sep />
              <TouchableOpacity
                style={styles.addRow}
                onPress={() => { setListName(''); setModal('newList'); }}
                activeOpacity={0.7}
              >
                <Text style={styles.addLabel}>+ New list</Text>
              </TouchableOpacity>
            </Card>

            {/* Categories */}
            <SectionLabel label="Categories" />
            <Card>
              {categories.length === 0 ? (
                <View style={styles.emptyRow}>
                  <Text style={styles.emptyText}>No categories yet.</Text>
                </View>
              ) : (
                categories.map((cat, i) => (
                  <View key={cat.id}>
                    <TouchableOpacity
                      style={styles.catRow}
                      onPress={() => { setEditingCatId(cat.id); setCatName(cat.name); setModal('editCategory'); }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.catName}>{cat.name}</Text>
                      <Text style={styles.chevron}>›</Text>
                    </TouchableOpacity>
                    {i < categories.length - 1 && <Sep />}
                  </View>
                ))
              )}
              <Sep />
              <TouchableOpacity
                style={styles.addRow}
                onPress={() => { setCatName(''); setModal('newCategory'); }}
                activeOpacity={0.7}
              >
                <Text style={styles.addLabel}>+ Add category</Text>
              </TouchableOpacity>
            </Card>

            {/* Danger zone */}
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

      {/* Rename household */}
      <Sheet visible={modal === 'renameHousehold'} title="Rename household" onClose={() => setModal(null)}>
        <Field label="Household name" value={renameValue} onChangeText={setRenameValue} placeholder="e.g. Home" />
        <PrimaryBtn label="Save" onPress={handleRenameHousehold} loading={saving} />
        <SecondaryBtn label="Cancel" onPress={() => setModal(null)} />
        <View style={{ height: Spacing.xl }} />
      </Sheet>

      {/* New list */}
      <Sheet visible={modal === 'newList'} title="New list" onClose={() => setModal(null)}>
        <Field label="List name" value={listName} onChangeText={setListName} placeholder="e.g. Weekend Shop" />
        <PrimaryBtn label="Create list" onPress={handleCreateList} loading={saving} />
        <SecondaryBtn label="Cancel" onPress={() => setModal(null)} />
        <View style={{ height: Spacing.xl }} />
      </Sheet>

      {/* Edit list */}
      <Sheet visible={modal === 'editList'} title="Edit list" onClose={() => setModal(null)}>
        <Field label="List name" value={listName} onChangeText={setListName} placeholder="e.g. Weekend Shop" />
        <PrimaryBtn label="Save changes" onPress={handleRenameList} loading={saving} />
        <PrimaryBtn label="Delete list" onPress={handleDeleteList} loading={saving} danger />
        <SecondaryBtn label="Cancel" onPress={() => setModal(null)} />
        <View style={{ height: Spacing.xl }} />
      </Sheet>

      {/* New category */}
      <Sheet visible={modal === 'newCategory'} title="New category" onClose={() => setModal(null)}>
        <Field label="Category name" value={catName} onChangeText={setCatName} placeholder="e.g. Frozen" />
        <PrimaryBtn label="Add category" onPress={handleCreateCategory} loading={saving} />
        <SecondaryBtn label="Cancel" onPress={() => setModal(null)} />
        <View style={{ height: Spacing.xl }} />
      </Sheet>

      {/* Edit category */}
      <Sheet visible={modal === 'editCategory'} title="Edit category" onClose={() => setModal(null)}>
        <Field label="Category name" value={catName} onChangeText={setCatName} placeholder="Category name" />
        <PrimaryBtn label="Save changes" onPress={handleUpdateCategory} loading={saving} />
        <PrimaryBtn label="Delete category" onPress={handleDeleteCategory} loading={saving} danger />
        <SecondaryBtn label="Cancel" onPress={() => setModal(null)} />
        <View style={{ height: Spacing.xl }} />
      </Sheet>

      {/* Invite member */}
      <Sheet visible={modal === 'inviteMember'} title="Invite member" onClose={() => setModal(null)}>
        <Field label="KitchenOwl username" value={inviteUsername} onChangeText={setInviteUsername} placeholder="username" />
        <PrimaryBtn label="Send invite" onPress={handleInviteMember} loading={saving} />
        <SecondaryBtn label="Cancel" onPress={() => setModal(null)} />
        <View style={{ height: Spacing.xl }} />
      </Sheet>

      {/* Remove member */}
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

      {/* Leave household */}
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.mintBg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  backBtn: { paddingRight: Spacing.sm },
  backChevron: { fontSize: 28, color: Colors.mint, fontWeight: '300', lineHeight: 32 },
  title: { flex: 1, fontSize: FontSize.heading + 2, fontWeight: '900', color: Colors.textDark, letterSpacing: -0.3 },
  editBtn: { paddingLeft: Spacing.sm },
  editLabel: { fontSize: FontSize.body, fontWeight: '700', color: Colors.mintLight },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 100 },
  center: { padding: Spacing.xxl, alignItems: 'center' },
  emptyRow: { padding: Spacing.xl },
  emptyText: { fontSize: FontSize.body, color: Colors.textFaded },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
  memberAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.mintLight, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.md },
  memberInitial: { color: Colors.white, fontWeight: '800', fontSize: FontSize.body },
  memberName: { flex: 1, fontSize: FontSize.body, fontWeight: '700', color: Colors.textDark },
  removeBtn: { fontSize: 14, color: Colors.textFaded, fontWeight: '700', padding: 4 },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md + 2 },
  listText: { flex: 1 },
  listName: { fontSize: FontSize.body, fontWeight: '700', color: Colors.textDark },
  listSub: { fontSize: FontSize.small, color: Colors.textFaded, marginTop: 2 },
  catRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md + 2 },
  catName: { flex: 1, fontSize: FontSize.body, fontWeight: '700', color: Colors.textDark },
  chevron: { fontSize: 20, color: Colors.mintPale, fontWeight: '700' },
  addRow: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md + 2 },
  addLabel: { fontSize: FontSize.body, fontWeight: '700', color: Colors.mint },
  dangerRow: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md + 2 },
  dangerLabel: { fontSize: FontSize.body, fontWeight: '700', color: '#e05555' },
  sheetBody: { padding: Spacing.xl, paddingBottom: Spacing.sm },
  sheetBodyText: { fontSize: FontSize.body, color: Colors.textFaded, lineHeight: 22 },
});
