import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as itemsDb from '@/db/items';
import * as listsDb from '@/db/lists';
import * as syncManager from '@/sync/syncManager';
import { useAuthStore } from '@/store/authStore';
import { recordItemUsed } from '@/db/history';
import { matchItem } from '@/data/foodMatcher';
import { useHouseholdStore } from '@/store/householdStore';
import { useSyncStore } from '@/store/syncStore';
import CategorySection from '@/components/CategorySection';
import AddItemBar from '@/components/AddItemBar';
import SwipeableItem from '@/components/SwipeableItem';
import BottomNav from '@/components/BottomNav';
import { Colors, Spacing, Radii, FontSize } from '@/theme';
import { SECURE_STORE_KEYS } from '@/utils/constants';
import type { LocalItem } from '@/db/items';
import type { LocalList } from '@/db/lists';
import type { SwipeableItemHandlers } from '@/components/SwipeableItem';
import type { ListDetailScreenProps } from '@/navigation/types';

// ─── Category ordering ───────────────────────────────────────────
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
    if (!CATEGORY_ORDER.includes(cat)) {
      ordered.push({ category: cat, items: catItems });
    }
  }
  return ordered;
}

// ─── Screen ──────────────────────────────────────────────────────

export default function ListDetailScreen(_props: ListDetailScreenProps) {
  const [activeLocalId, setActiveLocalId] = useState<string | null>(null);
  const [activeServerId, setActiveServerId] = useState<number | null>(null);
  const [activeName, setActiveName] = useState('');

  const [items, setItems] = useState<LocalItem[]>([]);
  const [allLists, setAllLists] = useState<LocalList[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [listPickerVisible, setListPickerVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const selectedHousehold = useHouseholdStore((s) => s.selectedHousehold);
  const householdId = selectedHousehold?.id ?? 0;
  const shoppingListsApi = useAuthStore((s) => s.shoppingListsApi);

  const syncVersion = useSyncStore((s) => s.syncVersion);
  const lastSyncVersionRef = useRef(syncVersion);

  // ── Data loading ───────────────────────────────────────────────

  const loadItems = useCallback(async (localId: string) => {
    const rows = await itemsDb.getItemsForList(localId);
    setItems(rows);
  }, []);

  const loadLists = useCallback(async () => {
    const rows = await listsDb.getAllLists(householdId);
    setAllLists(rows);
    return rows;
  }, [householdId]);

  const syncItems = useCallback(async (localId: string, serverId: number | null) => {
    if (serverId === null) return;
    try {
      const serverLists = await shoppingListsApi?.getShoppingLists(householdId) ?? [];
      const apiList = serverLists.find((l) => l.id === serverId);
      if (!apiList) return;
      for (const apiItem of apiList.items) {
        const match = matchItem(apiItem.icon ?? apiItem.name);
        await itemsDb.upsertItemFromServer(
          apiItem.id,
          localId,
          apiItem.name,
          apiItem.description,
          match.iconKey,
          match.category,
          apiItem.category?.id ?? null,
          apiItem.category?.name ?? null,
          apiItem.category?.ordering ?? null
        );
      }
      // Server is source of truth: remove local items that no longer exist on
      // the server (deleted via web or another device while we were offline).
      await itemsDb.removeItemsDeletedOnServer(
        localId,
        apiList.items.map((i) => i.id)
      );
      await loadItems(localId);
    } catch {
      // Offline — local data is fine
    }
  }, [householdId, loadItems, shoppingListsApi]);

  // Bootstrap: restore last list from SecureStore, fall back to first DB list.
  // Runs only once on mount — initializedRef makes the intent explicit and guards
  // against re-runs if React strict mode double-invokes effects in development.
  // Empty deps intentional: loadLists/loadItems/syncItems are stable useCallbacks
  // and householdId-driven changes go through the list-switch flow, not re-bootstrap.
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    let active = true;
    async function bootstrap() {
      const lists = await loadLists();
      if (!active || lists.length === 0) {
        if (active) setLoading(false);
        return;
      }

      const lastId = await SecureStore.getItemAsync(SECURE_STORE_KEYS.LAST_LIST_LOCAL_ID);
      const initial = (lastId ? lists.find((l) => l.localId === lastId) : null) ?? lists[0];

      if (!active) return;
      setActiveLocalId(initial.localId);
      setActiveServerId(initial.serverId);
      setActiveName(initial.name);

      await loadItems(initial.localId);
      if (active) setLoading(false);
      void syncItems(initial.localId, initial.serverId);
    }
    void bootstrap();
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload items from DB whenever a sync pass completes so isDirty clears.
  // Only fires when syncVersion actually increments — guards against re-running
  // when activeLocalId or loadItems reference changes without a new sync pass.
  useEffect(() => {
    if (syncVersion === lastSyncVersionRef.current) return;
    lastSyncVersionRef.current = syncVersion;
    if (activeLocalId) void loadItems(activeLocalId);
  }, [syncVersion, activeLocalId, loadItems]);

  const handleRefresh = useCallback(async () => {
    if (!activeLocalId) return;
    setRefreshing(true);
    await syncItems(activeLocalId, activeServerId).catch(() => {});
    setRefreshing(false);
  }, [activeLocalId, activeServerId, syncItems]);

  // ── List switching ─────────────────────────────────────────────

  async function persistLastList(localId: string) {
    await SecureStore.setItemAsync(SECURE_STORE_KEYS.LAST_LIST_LOCAL_ID, localId);
  }

  function switchToList(list: LocalList) {
    setActiveLocalId(list.localId);
    setActiveServerId(list.serverId);
    setActiveName(list.name);
    setListPickerVisible(false);
    setItems([]);
    setLoading(true);
    void persistLastList(list.localId);
    Promise.all([loadItems(list.localId), syncItems(list.localId, list.serverId)])
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  // ── Item actions ───────────────────────────────────────────────

  const handleToggleDone = useCallback(async (localId: string) => {
    const item = items.find((i) => i.localId === localId);
    if (!item) return;
    const next = !item.isChecked;
    await itemsDb.toggleItemChecked(localId, next);
    setItems((prev) =>
      prev.map((i) => (i.localId === localId ? { ...i, isChecked: next } : i))
    );
  }, [items]);

  const handleToggleImportant = useCallback(async (localId: string) => {
    const item = items.find((i) => i.localId === localId);
    if (!item) return;
    const next = !item.isImportant;
    await itemsDb.toggleItemImportant(localId, next);
    setItems((prev) =>
      prev.map((i) => (i.localId === localId ? { ...i, isImportant: next } : i))
    );
  }, [items]);

  const handleDelete = useCallback(async (localId: string) => {
    // Soft-delete first, then read fresh from DB — state.serverId may be stale
    // if markItemSynced ran asynchronously since the item was added to state.
    await itemsDb.softDeleteItem(localId);
    const freshItem = await itemsDb.getItem(localId);
    if (freshItem?.serverId !== null && freshItem?.serverId !== undefined
        && activeServerId !== null && activeLocalId !== null) {
      await syncManager.enqueue(
        {
          opType: 'REMOVE_ITEM',
          listServerId: activeServerId,
          itemServerId: freshItem.serverId,
          itemLocalId: localId,
        },
        activeLocalId
      );
    } else {
      await itemsDb.hardDeleteItem(localId);
    }
    setItems((prev) => prev.filter((i) => i.localId !== localId));
  }, [activeLocalId, activeServerId]);

  const handleSave = useCallback(async (localId: string, name: string, iconKey: string | null) => {
    await itemsDb.updateItemNameAndIcon(localId, name, iconKey);
    // Read fresh from DB — React state serverId may be stale if markItemSynced
    // ran asynchronously since the item was added to state.
    const freshItem = await itemsDb.getItem(localId);
    if (freshItem?.serverId !== null && freshItem?.serverId !== undefined
        && activeServerId !== null && activeLocalId !== null) {
      const category = freshItem.serverCategoryId !== null
        ? {
            id: freshItem.serverCategoryId,
            name: freshItem.serverCategoryName ?? '',
            ordering: freshItem.serverCategoryOrdering ?? 0,
          }
        : null;
      await syncManager.enqueue(
        {
          opType: 'UPDATE_ITEM',
          listServerId: activeServerId,
          itemServerId: freshItem.serverId,
          itemLocalId: localId,
          name,
          description: freshItem.description,
          iconKey,
          category,
        },
        activeLocalId
      );
    }
    setItems((prev) =>
      prev.map((i) => (i.localId === localId ? { ...i, name, iconKey } : i))
    );
  }, [activeLocalId, activeServerId]);

  const handleAddItem = useCallback(async (
    name: string,
    description: string,
    iconKey: string | null,
    category: string,
  ) => {
    if (!activeLocalId) return;
    const match = iconKey ? { iconKey, category } : matchItem(name);
    const newItem = await itemsDb.addItemLocally(
      activeLocalId, name, description, match.iconKey, match.category
    );
    await recordItemUsed(name, match.iconKey, match.category);
    if (activeServerId !== null) {
      await syncManager.enqueue(
        {
          opType: 'ADD_ITEM',
          listServerId: activeServerId,
          listLocalId: activeLocalId,
          itemLocalId: newItem.localId,
          name,
          description,
        },
        activeLocalId
      );
    }
    setItems((prev) => [...prev, newItem]);
  }, [activeLocalId, activeServerId]);

  // ── Derived data ───────────────────────────────────────────────

  const activeItems = useMemo(() => items.filter((i) => !i.isChecked), [items]);
  const doneItems = useMemo(() => items.filter((i) => i.isChecked), [items]);
  const categoryGroups = useMemo(() => groupByCategory(activeItems), [activeItems]);

  const sharedHandlers = {
    onToggleDone: handleToggleDone,
    onToggleImportant: handleToggleImportant,
    onDelete: handleDelete,
    onSave: handleSave,
    editingId,
    setEditingId,
  };

  // ── Render ─────────────────────────────────────────────────────

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
      </View>

      {/* Add item bar */}
      <AddItemBar onAdd={handleAddItem} />

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
              {...sharedHandlers}
            />
          ))}

          {doneItems.length > 0 && (
            <View style={styles.trolleySection}>
              <View style={styles.trolleyHeader}>
                <View style={styles.trolleyDot} />
                <Text style={styles.trolleyLabel}>IN THE TROLLEY</Text>
                <View style={styles.trolleyRule} />
              </View>
              {doneItems.map((item) => (
                <View key={item.localId}>
                  <SwipeableItemInline item={item} handlers={sharedHandlers} />
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Bottom navigation bar */}
      <BottomNav active="lists" />

      {/* List picker modal */}
      <ListPickerModal
        visible={listPickerVisible}
        lists={allLists}
        activeLocalId={activeLocalId ?? ''}
        onSelect={switchToList}
        onClose={() => setListPickerVisible(false)}
      />
    </SafeAreaView>
  );
}

// ─── SwipeableItemInline ──────────────────────────────────────────

type SwipeableItemInlineProps = {
  item: LocalItem;
  handlers: SwipeableItemHandlers;
}

function SwipeableItemInline({ item, handlers }: SwipeableItemInlineProps) {
  return <SwipeableItem item={item} {...handlers} />;
}

// ─── List picker modal ────────────────────────────────────────────

type ListPickerModalProps = {
  visible: boolean;
  lists: LocalList[];
  activeLocalId: string;
  onSelect: (list: LocalList) => void;
  onClose: () => void;
}

function ListPickerModal({
  visible,
  lists,
  activeLocalId,
  onSelect,
  onClose,
}: ListPickerModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={pickerStyles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={pickerStyles.menu}>
          {lists.map((list) => (
            <TouchableOpacity
              key={list.localId}
              style={[
                pickerStyles.row,
                list.localId === activeLocalId && pickerStyles.rowActive,
              ]}
              onPress={() => onSelect(list)}
              activeOpacity={0.7}
            >
              <Text style={[
                pickerStyles.rowText,
                list.localId === activeLocalId && pickerStyles.rowTextActive,
              ]}>
                {list.name}
              </Text>
              {list.isDirty && <View style={pickerStyles.dirtyDot} />}
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────

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
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  listPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    alignSelf: 'flex-start',
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
  trolleySection: {
    marginTop: Spacing.sm,
  },
  trolleyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  trolleyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.mintLight,
  },
  trolleyLabel: {
    fontSize: FontSize.label,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: Colors.mintLight,
  },
  trolleyRule: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.mintPale,
  },
});

const pickerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingTop: 100,
    paddingHorizontal: Spacing.xxl,
  },
  menu: {
    backgroundColor: Colors.white,
    borderRadius: Radii.lg,
    overflow: 'hidden',
    shadowColor: Colors.mint,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.lg - 2,
    paddingHorizontal: Spacing.xl,
    backgroundColor: Colors.white,
  },
  rowActive: {
    backgroundColor: Colors.mintPale,
  },
  rowText: {
    flex: 1,
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.mint,
  },
  rowTextActive: {
    color: Colors.mint,
  },
  dirtyDot: {
    width: 7,
    height: 7,
    borderRadius: Radii.full,
    backgroundColor: Colors.yellow,
  },
});
