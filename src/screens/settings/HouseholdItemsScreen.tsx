import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  StyleSheet,
  ListRenderItemInfo,
} from 'react-native';
import Sheet from '@/components/Sheet';
import IconPicker from '@/components/IconPicker';
import KitchenOwlIcon from '@/components/KitchenOwlIcon';
import BottomNav from '@/components/BottomNav';
import { SectionLabel, Card, Sep, Field, PrimaryBtn, SecondaryBtn } from '@/components/settings';
import { useAuthStore } from '@/store/authStore';
import { Colors, Spacing, Radii, FontSize } from '@/theme';
import type { HouseholdItemsScreenProps } from '@/navigation/types';
import type { HouseholdItem, HouseholdCategory } from '@/api/households';

type SheetMode = 'new' | 'edit' | 'pick-category' | null;

export default function HouseholdItemsScreen({ navigation, route }: HouseholdItemsScreenProps) {
  const { householdId, householdName } = route.params;
  const { householdsApi } = useAuthStore();

  // ── Data state ──────────────────────────────────────────────────────────────

  const [items, setItems] = useState<HouseholdItem[]>([]);
  const [categories, setCategories] = useState<HouseholdCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Sheet / editor state ────────────────────────────────────────────────────

  const [sheet, setSheet] = useState<SheetMode>(null);
  const [editingItem, setEditingItem] = useState<HouseholdItem | null>(null);
  const [name, setName] = useState('');
  const [iconKey, setIconKey] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<HouseholdCategory | null>(null);
  const [iconPickerVisible, setIconPickerVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Load data ───────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!householdsApi) return;
    try {
      const [fetchedItems, fetchedCategories] = await Promise.all([
        householdsApi.getHouseholdItems(householdId),
        householdsApi.getCategories(householdId),
      ]);
      setItems(fetchedItems.slice().sort((a, b) => a.name.localeCompare(b.name)));
      setCategories(fetchedCategories.slice().sort((a, b) => a.ordering - b.ordering));
    } catch {
      Alert.alert('Error', 'Could not load items. Check your connection.');
    }
  }, [householdsApi, householdId]);

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, [load]);

  // ── Sheet helpers ───────────────────────────────────────────────────────────

  function openNew() {
    setEditingItem(null);
    setName('');
    setIconKey(null);
    setSelectedCategory(null);
    setSheet('new');
  }

  function openEdit(item: HouseholdItem) {
    setEditingItem(item);
    setName(item.name);
    setIconKey(item.icon ?? null);
    setSelectedCategory(item.category ?? null);
    setSheet('edit');
  }

  function closeSheet() {
    setSheet(null);
    setIconPickerVisible(false);
  }

  // ── CRUD ────────────────────────────────────────────────────────────────────

  async function handleCreate() {
    if (!name.trim() || !householdsApi) return;
    setSaving(true);
    try {
      const created = await householdsApi.createHouseholdItem(
        householdId,
        name.trim(),
        iconKey,
        selectedCategory ? { id: selectedCategory.id, name: selectedCategory.name, ordering: selectedCategory.ordering } : null
      );
      setItems((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
      );
      closeSheet();
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create item.');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate() {
    if (!name.trim() || !editingItem || !householdsApi) return;
    setSaving(true);
    try {
      await householdsApi.updateHouseholdItem(
        editingItem.id,
        name.trim(),
        iconKey,
        selectedCategory ? { id: selectedCategory.id, name: selectedCategory.name, ordering: selectedCategory.ordering } : null
      );
      setItems((prev) =>
        prev
          .map((i) =>
            i.id === editingItem.id
              ? { ...i, name: name.trim(), icon: iconKey, category: selectedCategory ?? undefined }
              : i
          )
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      closeSheet();
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to update item.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editingItem || !householdsApi) return;
    setSaving(true);
    try {
      await householdsApi.deleteHouseholdItem(editingItem.id);
      setItems((prev) => prev.filter((i) => i.id !== editingItem.id));
      closeSheet();
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to delete item.');
    } finally {
      setSaving(false);
    }
  }

  // ── Render item ─────────────────────────────────────────────────────────────

  function renderItem({ item }: ListRenderItemInfo<HouseholdItem>) {
    return (
      <TouchableOpacity
        style={styles.itemRow}
        onPress={() => openEdit(item)}
        activeOpacity={0.7}
      >
        <View style={styles.iconWrap}>
          {item.icon ? (
            <KitchenOwlIcon iconKey={item.icon} size={22} style={{ color: Colors.mint }} />
          ) : (
            <View style={styles.iconPlaceholder} />
          )}
        </View>
        <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
        {item.category ? (
          <Text style={styles.itemCategory} numberOfLines={1}>{item.category.name}</Text>
        ) : null}
        <Text style={styles.itemChevron}>›</Text>
      </TouchableOpacity>
    );
  }

  function renderSeparator() {
    return <Sep />;
  }

  // ── Category picker inside sheet ────────────────────────────────────────────

  const categoryLabel = selectedCategory ? selectedCategory.name : 'None';

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backChevron}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{householdName} — Items</Text>
        <TouchableOpacity onPress={openNew} style={styles.addBtn}>
          <Text style={styles.addLabel}>+ New</Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.mint} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          ItemSeparatorComponent={renderSeparator}
          contentContainerStyle={items.length === 0 ? styles.emptyContainer : styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyRow}>
              <Text style={styles.emptyText}>{'No items yet. Tap "+ New" to add one.'}</Text>
            </View>
          }
          ListHeaderComponent={
            items.length > 0 ? (
              <SectionLabel label={`${items.length} item${items.length === 1 ? '' : 's'}`} />
            ) : null
          }
        />
      )}

      <BottomNav active="settings" />

      {/* Create / Edit sheet */}
      <Sheet
        visible={sheet === 'new' || sheet === 'edit'}
        title={sheet === 'new' ? 'New item' : 'Edit item'}
        onClose={closeSheet}
      >
        <View style={styles.sheetBody}>
          <Field
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Oat milk"
          />

          {/* Icon row */}
          <Text style={styles.fieldLabel}>Icon</Text>
          <TouchableOpacity
            style={styles.iconRow}
            onPress={() => setIconPickerVisible(true)}
            activeOpacity={0.7}
          >
            <View style={styles.iconPreview}>
              {iconKey ? (
                <KitchenOwlIcon iconKey={iconKey} size={24} style={{ color: Colors.mint }} />
              ) : (
                <Text style={styles.iconNone}>None</Text>
              )}
            </View>
            <Text style={styles.iconChangeLabel}>Change icon ›</Text>
          </TouchableOpacity>

          {/* Category row */}
          <Text style={styles.fieldLabel}>Category</Text>
          <TouchableOpacity
            style={styles.categoryRow}
            onPress={() => setSheet('pick-category')}
            activeOpacity={0.7}
          >
            <Text style={[styles.categoryValue, !selectedCategory && styles.categoryNone]}>
              {categoryLabel}
            </Text>
            <Text style={styles.iconChangeLabel}>Change ›</Text>
          </TouchableOpacity>
        </View>

        {sheet === 'new' ? (
          <PrimaryBtn label="Add item" onPress={handleCreate} loading={saving} />
        ) : (
          <>
            <PrimaryBtn label="Save changes" onPress={handleUpdate} loading={saving} />
            <PrimaryBtn label="Delete item" onPress={handleDelete} loading={saving} danger />
          </>
        )}
        <SecondaryBtn label="Cancel" onPress={closeSheet} />
        <View style={{ height: Spacing.xl }} />
      </Sheet>

      {/* Category picker sheet */}
      <Sheet
        visible={sheet === 'pick-category'}
        title="Choose category"
        onClose={() => setSheet(sheet === 'pick-category' ? (editingItem ? 'edit' : 'new') : sheet)}
      >
        <Card>
          <TouchableOpacity
            style={styles.catPickRow}
            onPress={() => {
              setSelectedCategory(null);
              setSheet(editingItem ? 'edit' : 'new');
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.catPickName, !selectedCategory && styles.catPickSelected]}>
              None
            </Text>
            {!selectedCategory && <Text style={styles.catTick}>✓</Text>}
          </TouchableOpacity>
          {categories.map((cat, idx) => (
            <View key={cat.id}>
              {idx === 0 && <Sep />}
              <TouchableOpacity
                style={styles.catPickRow}
                onPress={() => {
                  setSelectedCategory(cat);
                  setSheet(editingItem ? 'edit' : 'new');
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.catPickName, selectedCategory?.id === cat.id && styles.catPickSelected]}>
                  {cat.name}
                </Text>
                {selectedCategory?.id === cat.id && <Text style={styles.catTick}>✓</Text>}
              </TouchableOpacity>
              {idx < categories.length - 1 && <Sep />}
            </View>
          ))}
        </Card>
        <View style={{ height: Spacing.xl }} />
      </Sheet>

      {/* Icon picker modal */}
      <IconPicker
        visible={iconPickerVisible}
        selected={iconKey}
        onSelect={(key) => setIconKey(key)}
        onClose={() => setIconPickerVisible(false)}
      />
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
  addBtn: { paddingLeft: Spacing.sm },
  addLabel: { fontSize: FontSize.body, fontWeight: '700', color: Colors.mint },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingBottom: 100 },
  emptyContainer: { flex: 1, paddingBottom: 100 },
  emptyRow: { padding: Spacing.xl, alignItems: 'center' },
  emptyText: { fontSize: FontSize.body, color: Colors.textFaded, textAlign: 'center' },

  // Item rows
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md + 2,
    backgroundColor: Colors.white,
  },
  iconWrap: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  iconPlaceholder: {
    width: 22,
    height: 22,
    borderRadius: Radii.sm,
    backgroundColor: Colors.mintPale,
  },
  itemName: {
    flex: 1,
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.textDark,
  },
  itemCategory: {
    fontSize: FontSize.small,
    color: Colors.textFaded,
    marginRight: Spacing.sm,
    maxWidth: 120,
  },
  itemChevron: { fontSize: 20, color: Colors.mintPale, fontWeight: '700' },

  // Sheet body
  sheetBody: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  fieldLabel: {
    fontSize: FontSize.small,
    fontWeight: '700',
    color: Colors.textFaded,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.mintPale,
    marginBottom: Spacing.sm,
  },
  iconPreview: {
    width: 36,
    height: 36,
    borderRadius: Radii.sm,
    backgroundColor: Colors.mintBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  iconNone: { fontSize: FontSize.small, color: Colors.textFaded },
  iconChangeLabel: { fontSize: FontSize.body, color: Colors.mint, fontWeight: '700' },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.mintPale,
    marginBottom: Spacing.sm,
  },
  categoryValue: {
    flex: 1,
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.textDark,
  },
  categoryNone: { color: Colors.textFaded },

  // Category picker rows
  catPickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md + 2,
  },
  catPickName: {
    flex: 1,
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.textDark,
  },
  catPickSelected: { color: Colors.mint },
  catTick: { fontSize: FontSize.body, color: Colors.mint, fontWeight: '700' },
});
