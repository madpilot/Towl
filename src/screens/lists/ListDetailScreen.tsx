import React, { useCallback, useMemo, useState } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import * as itemsDb from '@/db/items';
import * as listsDb from '@/db/lists';
import * as syncQueue from '@/db/syncQueue';
import * as shoppingListsApi from '@/api/shoppinglists';
import { recordItemUsed } from '@/db/history';
import { matchItem } from '@/data/foodMatcher';
import { useHouseholdStore } from '@/store/householdStore';
import CategorySection from '@/components/CategorySection';
import AddItemBar from '@/components/AddItemBar';
import TommyOwl from '@/components/TommyOwl';
import ListsIcon from '@/components/icons/ListsIcon';
import SettingsIcon from '@/components/icons/SettingsIcon';
import { Colors, Spacing, Radii, FontSize } from '@/theme';
import type { LocalItem } from '@/db/items';
import type { LocalList } from '@/db/lists';
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
  // Append any unknown categories not in the order list
  for (const [cat, items] of map.entries()) {
    if (!CATEGORY_ORDER.includes(cat)) {
      ordered.push({ category: cat, items });
    }
  }
  return ordered;
}

// ─── Screen ──────────────────────────────────────────────────────

export default function ListDetailScreen({ route, navigation }: ListDetailScreenProps) {
  const { listLocalId, listServerId, listName } = route.params;

  // Active list identity — can be switched via the picker
  const [activeLocalId, setActiveLocalId] = useState(listLocalId);
  const [activeServerId, setActiveServerId] = useState<number | null>(listServerId);
  const [activeName, setActiveName] = useState(listName);

  const [items, setItems] = useState<LocalItem[]>([]);
  const [allLists, setAllLists] = useState<LocalList[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [listPickerVisible, setListPickerVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const selectedHousehold = useHouseholdStore((s) => s.selectedHousehold);
  const householdId = selectedHousehold?.id ?? 0;

  // ── Data loading ───────────────────────────────────────────────

  const loadItems = useCallback(async (localId: string) => {
    const rows = await itemsDb.getItemsForList(localId);
    setItems(rows);
  }, []);

  const loadLists = useCallback(async () => {
    const rows = await listsDb.getAllLists(householdId);
    setAllLists(rows);
  }, [householdId]);

  const syncItems = useCallback(async (localId: string, serverId: number | null) => {
    if (serverId === null) return;
    try {
      const apiItems = await shoppingListsApi.getShoppingListItems(serverId);
      for (const apiItem of apiItems) {
        const match = matchItem(apiItem.icon ?? apiItem.name);
        await itemsDb.upsertItemFromServer(
          apiItem.id,
          localId,
          apiItem.name,
          apiItem.description,
          match.iconKey,
          match.category
        );
      }
      await loadItems(localId);
    } catch {
      // Offline — local data is fine
    }
  }, [loadItems]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      Promise.all([loadItems(activeLocalId), loadLists()])
        .then(() => { if (active) setLoading(false); })
        .catch(() => { if (active) setLoading(false); });
      syncItems(activeLocalId, activeServerId).catch(() => {});
      return () => { active = false; };
    }, [activeLocalId, activeServerId, loadItems, loadLists, syncItems])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await syncItems(activeLocalId, activeServerId).catch(() => {});
    setRefreshing(false);
  }, [activeLocalId, activeServerId, syncItems]);

  // ── List switching ─────────────────────────────────────────────

  function switchToList(list: LocalList) {
    setActiveLocalId(list.localId);
    setActiveServerId(list.serverId);
    setActiveName(list.name);
    setListPickerVisible(false);
    setItems([]);
    setLoading(true);
    Promise.all([loadItems(list.localId), syncItems(list.localId, list.serverId)])
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  // ── Item actions ───────────────────────────────────────────────

  const handleToggleDone = useCallback(async (localId: string) => {
    const item = items.find((i) => i.localId === localId);
    if (!item) return;
    await itemsDb.toggleItemChecked(localId, !item.isChecked);
    setItems((prev) =>
      prev.map((i) => (i.localId === localId ? { ...i, isChecked: !i.isChecked } : i))
    );
  }, [items]);

  const handleToggleImportant = useCallback(async (localId: string) => {
    const item = items.find((i) => i.localId === localId);
    if (!item) return;
    await itemsDb.toggleItemImportant(localId, !item.isImportant);
    setItems((prev) =>
      prev.map((i) => (i.localId === localId ? { ...i, isImportant: !i.isImportant } : i))
    );
  }, [items]);

  const handleDelete = useCallback(async (localId: string) => {
    const item = items.find((i) => i.localId === localId);
    if (!item) return;
    await itemsDb.softDeleteItem(localId);
    if (item.serverId !== null && activeServerId !== null) {
      await syncQueue.enqueue(
        {
          opType: 'REMOVE_ITEM',
          listServerId: activeServerId,
          itemServerId: item.serverId,
          itemLocalId: localId,
        },
        activeLocalId
      );
    } else {
      await itemsDb.hardDeleteItem(localId);
    }
    setItems((prev) => prev.filter((i) => i.localId !== localId));
  }, [items, activeLocalId, activeServerId]);

  const handleSave = useCallback(async (localId: string, name: string, iconKey: string | null) => {
    await itemsDb.updateItemNameAndIcon(localId, name, iconKey);
    setItems((prev) =>
      prev.map((i) => (i.localId === localId ? { ...i, name, iconKey } : i))
    );
  }, []);

  const handleAddItem = useCallback(async (
    name: string,
    description: string,
    iconKey: string | null,
    category: string,
  ) => {
    const match = iconKey ? { iconKey, category } : matchItem(name);
    const newItem = await itemsDb.addItemLocally(
      activeLocalId, name, description, match.iconKey, match.category
    );
    await recordItemUsed(name, match.iconKey, match.category);
    if (activeServerId !== null) {
      await syncQueue.enqueue(
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
          {/* Active items, grouped by category */}
          {categoryGroups.map(({ category, items: catItems }) => (
            <CategorySection
              key={category}
              category={category}
              items={catItems}
              {...sharedHandlers}
            />
          ))}

          {/* Done / in-the-trolley section */}
          {doneItems.length > 0 && (
            <View style={styles.trolleySection}>
              <View style={styles.trolleyHeader}>
                <View style={styles.trolleyDot} />
                <Text style={styles.trolleyLabel}>IN THE TROLLEY</Text>
                <View style={styles.trolleyRule} />
              </View>
              {doneItems.map((item) => (
                <View key={item.localId} style={styles.doneItemWrap}>
                  <SwipeableItemInline item={item} handlers={sharedHandlers} />
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Bottom navigation bar */}
      <BottomNav onListsPress={() => navigation.navigate('Lists')} />

      {/* List picker modal */}
      <ListPickerModal
        visible={listPickerVisible}
        lists={allLists}
        activeLocalId={activeLocalId}
        onSelect={switchToList}
        onClose={() => setListPickerVisible(false)}
        onNewList={() => {
          setListPickerVisible(false);
          navigation.navigate('Lists');
        }}
      />
    </SafeAreaView>
  );
}

// ─── SwipeableItemInline (re-exports SwipeableItem without extra margin) ─────

import SwipeableItem from '@/components/SwipeableItem';
import type { SwipeableItemHandlers } from '@/components/SwipeableItem';

type SwipeableItemInlineProps = {
  item: LocalItem;
  handlers: SwipeableItemHandlers;
}

function SwipeableItemInline({ item, handlers }: SwipeableItemInlineProps) {
  return <SwipeableItem item={item} {...handlers} />;
}

// ─── Bottom navigation bar ────────────────────────────────────────

type BottomNavProps = {
  onListsPress: () => void;
}

function BottomNav({ onListsPress }: BottomNavProps) {
  return (
    <View style={navStyles.bar}>
      <TouchableOpacity style={navStyles.navBtn} onPress={onListsPress} activeOpacity={0.7}>
        <ListsIcon color={Colors.mint} size={24} />
        <Text style={navStyles.navLabel}>Lists</Text>
      </TouchableOpacity>

      <View style={navStyles.owlWrap}>
        <TommyOwl size={64} />
      </View>

      <TouchableOpacity style={navStyles.navBtn} activeOpacity={0.7}>
        <SettingsIcon color={Colors.mintLight} size={24} />
        <Text style={[navStyles.navLabel, navStyles.navLabelFaded]}>Settings</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── List picker modal ────────────────────────────────────────────

type ListPickerModalProps = {
  visible: boolean;
  lists: LocalList[];
  activeLocalId: string;
  onSelect: (list: LocalList) => void;
  onClose: () => void;
  onNewList: () => void;
}

function ListPickerModal({
  visible,
  lists,
  activeLocalId,
  onSelect,
  onClose,
  onNewList,
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
          <TouchableOpacity style={pickerStyles.newRow} onPress={onNewList} activeOpacity={0.7}>
            <Text style={pickerStyles.newText}>+ New list</Text>
          </TouchableOpacity>
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
  doneItemWrap: {},
});

const navStyles = StyleSheet.create({
  bar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radii.xl + 4,
    borderTopRightRadius: Radii.xl + 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.xxl * 2,
    shadowColor: Colors.mint,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 8,
  },
  navBtn: {
    alignItems: 'center',
    gap: Spacing.xs,
    minWidth: 48,
  },
  navLabel: {
    fontSize: FontSize.tiny,
    fontWeight: '800',
    color: Colors.mint,
  },
  navLabelFaded: {
    color: Colors.mintLight,
  },
  owlWrap: {
    position: 'absolute',
    top: -44,
    left: '50%',
    transform: [{ translateX: -32 }],
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
  newRow: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.mintPale,
    backgroundColor: Colors.white,
  },
  newText: {
    fontSize: FontSize.small,
    fontWeight: '700',
    color: Colors.mintLight,
  },
});
