import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { useHouseholdStore } from '@/store/householdStore';
import { useSyncStore } from '@/store/syncStore';
import { useListDetailStore, useListNav, useItemActions } from '@/store/listDetailStore';
import CategorySection from '@/components/CategorySection';
import AddItemBar from '@/components/AddItemBar';
import BottomNav from '@/components/BottomNav';
import HouseIcon from '@/components/icons/HouseIcon';
import ListPickerModal from '@/screens/lists/ListPickerModal';
import TrolleySection from '@/screens/lists/TrolleySection';
import { Colors, Spacing, FontSize } from '@/theme';
import type { LocalItem } from '@/db/items';
import type { ListDetailScreenProps } from '@/navigation/types';

// ─── Category ordering ────────────────────────────────────────────────────────

const CATEGORY_ORDER = [
  'Produce', 'Dairy & Eggs', 'Meat & Seafood', 'Bakery', 'Pantry',
  'Beverages', 'Snacks', 'Condiments', 'Frozen', 'Prepared',
  'Household', 'Personal Care', 'Baby', 'Pet', 'Clothing',
  'Office', 'Hardware', 'Electronics', 'Sports', 'Kitchenware', 'Craft', 'Other',
];

function groupByCategory(items: LocalItem[]): { category: string; items: LocalItem[] }[] {
  const map = new Map<string, LocalItem[]>();
  for (const item of items) {
    const cat = item.category || 'Other';
    const existing = map.get(cat);
    if (existing) existing.push(item);
    else map.set(cat, [item]);
  }
  const ordered = CATEGORY_ORDER
    .filter((c) => map.has(c))
    .map((c) => ({ category: c, items: map.get(c) ?? [] }));
  for (const [cat, catItems] of map.entries()) {
    if (!CATEGORY_ORDER.includes(cat)) ordered.push({ category: cat, items: catItems });
  }
  return ordered;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ListDetailScreen({ navigation }: ListDetailScreenProps) {
  const selectedHousehold = useHouseholdStore((s) => s.selectedHousehold);
  const householdId = selectedHousehold?.id ?? 0;

  const { bootstrap, reloadAfterSync, loading, items } = useListDetailStore(
    useShallow((s) => ({
      bootstrap: s.bootstrap,
      reloadAfterSync: s.reloadAfterSync,
      loading: s.loading,
      items: s.items,
    }))
  );

  const { activeName, refreshing, refresh, setListPickerVisible } = useListNav();
  const { editingId, setEditingId, toggleDone, toggleImportant, deleteItem, saveItem, addItem } = useItemActions();

  // ── Bootstrap: single effect keyed on householdId ────────────────────────────
  // First mount → restore last-used list from SecureStore.
  // Subsequent calls (household switch) → use the first available list.
  const isFirstMountRef = useRef(true);
  useEffect(() => {
    if (!householdId) return;
    const restoreLastList = isFirstMountRef.current;
    isFirstMountRef.current = false;
    void bootstrap(householdId, restoreLastList);
  }, [householdId, bootstrap]);

  // Reload items from DB whenever a sync pass completes so isDirty clears.
  const syncVersion = useSyncStore((s) => s.syncVersion);
  const lastSyncVersionRef = useRef(syncVersion);
  useEffect(() => {
    if (syncVersion === lastSyncVersionRef.current) return;
    lastSyncVersionRef.current = syncVersion;
    void reloadAfterSync();
  }, [syncVersion, reloadAfterSync]);

  const handleRefresh = useCallback(() => {
    void refresh(householdId);
  }, [householdId, refresh]);

  // ── Derived data ──────────────────────────────────────────────────────────────

  const activeItems = useMemo(() => items.filter((i) => !i.isChecked), [items]);
  const categoryGroups = useMemo(() => groupByCategory(activeItems), [activeItems]);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.root}>
      {/* Tap-away overlay to dismiss edit mode */}
      {editingId !== null && (
        <TouchableOpacity
          style={styles.editOverlay}
          activeOpacity={1}
          onPress={() => setEditingId(null)}
        />
      )}

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.listPicker}
          onPress={() => setListPickerVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.listName} numberOfLines={1}>{activeName}</Text>
          <Text style={styles.chevron}>▾</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.navigate('HouseholdPicker')}
          activeOpacity={0.7}
          hitSlop={8}
        >
          <HouseIcon color={Colors.mint} size={28} />
        </TouchableOpacity>
      </View>

      {/* Add item bar */}
      <AddItemBar onAdd={addItem} />

      {/* Items list */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.mint} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.mint}
            />
          }
        >
          {categoryGroups.map(({ category, items: catItems }) => (
            <CategorySection
              key={category}
              category={category}
              items={catItems}
              onToggleDone={toggleDone}
              onToggleImportant={toggleImportant}
              onDelete={deleteItem}
              onSave={saveItem}
              editingId={editingId}
              setEditingId={setEditingId}
            />
          ))}

          <TrolleySection />
        </ScrollView>
      )}

      {/* Bottom navigation bar */}
      <BottomNav active="lists" />

      {/* List picker modal */}
      <ListPickerModal />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.mintBg,
  },
  editOverlay: {
    position: 'absolute',
    inset: 0,
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  listPicker: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  listName: {
    fontSize: FontSize.title,
    fontWeight: '900',
    color: Colors.mint,
    letterSpacing: -0.5,
    flexShrink: 1,
  },
  chevron: {
    fontSize: FontSize.heading,
    color: Colors.mint,
    marginTop: 2,
  },
  scroll: {
    flex: 1,
    zIndex: 11,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: 120,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
