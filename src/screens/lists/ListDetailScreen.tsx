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
  KeyboardAvoidingView,
  Platform,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useShallow } from 'zustand/react/shallow';
import { useHouseholdStore } from '@/store/householdStore';
import { useSyncStore } from '@/store/syncStore';
import { useListDetailStore, useListNav, useItemActions } from '@/store/listDetailStore';
import { DragDropProvider, useDragDrop } from '@/components/DragDropContext';
import CategorySection from '@/components/CategorySection';
import AddItemBar from '@/components/AddItemBar';
import BottomNav from '@/components/BottomNav';
import HouseIcon from '@/components/icons/HouseIcon';
import KitchenOwlIcon from '@/components/KitchenOwlIcon';
import ListPickerModal from '@/screens/lists/ListPickerModal';
import TrolleySection from '@/screens/lists/TrolleySection';
import { Colors, Spacing, FontSize, Radii } from '@/theme';
import type { LocalItem } from '@/db/items';
import type { ListDetailScreenProps } from '@/navigation/types';

// ─── Category grouping ───────────────────────────────────────────

type CategoryGroup = { category: string; categoryId: number | null; items: LocalItem[] };

/**
 * Groups unchecked items by their server category, ordered by the category's
 * `ordering` field from the server. Items with no server category (not yet
 * synced, or the household has no categories) are collected into an
 * "Uncategorized" group at the end.
 */
function groupByCategory(items: LocalItem[]): CategoryGroup[] {
  const map = new Map<number | null, { name: string; ordering: number; items: LocalItem[] }>();
  for (const item of items) {
    const key = item.serverCategoryId;
    const existing = map.get(key);
    if (existing) {
      existing.items.push(item);
    } else {
      map.set(key, {
        name: item.serverCategoryName ?? 'Uncategorized',
        ordering: item.serverCategoryOrdering ?? Number.MAX_SAFE_INTEGER,
        items: [item],
      });
    }
  }
  return [...map.entries()]
    .sort(([, a], [, b]) => a.ordering - b.ordering)
    .map(([id, group]) => ({ category: group.name, categoryId: id, items: group.items }));
}

// ─── Ghost overlay ────────────────────────────────────────────────────────────

function DragGhost() {
  const dragDrop = useDragDrop();

  const ghostStyle = useAnimatedStyle(() => {
    if (!dragDrop) return { opacity: 0 };
    return {
      transform: [
        { translateX: dragDrop.ghostX.value },
        { translateY: dragDrop.ghostY.value },
      ],
      opacity: dragDrop.ghostOpacity.value,
    };
  });

  if (!dragDrop?.draggingItem) return null;
  const { draggingItem } = dragDrop;

  return (
    <Animated.View
      style={[ghostStyles.ghost, ghostStyle]}
      pointerEvents="none"
    >
      <KitchenOwlIcon iconKey={draggingItem.iconKey} size={20} style={{ color: Colors.mint }} />
      <Text style={ghostStyles.name} numberOfLines={1}>{draggingItem.name}</Text>
    </Animated.View>
  );
}

const ghostStyles = StyleSheet.create({
  ghost: {
    position: 'absolute',
    top: 0,
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.white,
    borderRadius: Radii.lg,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    shadowColor: Colors.mint,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 9999,
    maxWidth: 220,
  },
  name: {
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.textDark,
    flexShrink: 1,
  },
});

// ─── Screen content (inside DragDropProvider) ─────────────────────────────────

type ListDetailContentProps = { navigation: ListDetailScreenProps['navigation'] };

function ListDetailContent({ navigation }: ListDetailContentProps) {
  const selectedHousehold = useHouseholdStore((s) => s.selectedHousehold);
  const householdId = selectedHousehold?.id ?? 0;

  const { bootstrap, reloadAfterSync, loading, items, allCategories } = useListDetailStore(
    useShallow((s) => ({
      bootstrap: s.bootstrap,
      reloadAfterSync: s.reloadAfterSync,
      loading: s.loading,
      items: s.items,
      allCategories: s.allCategories,
    }))
  );

  const { activeName, refreshing, refresh, setListPickerVisible } = useListNav();
  const { editingId, setEditingId, toggleDone, toggleImportant, deleteItem, saveItem, addItem } = useItemActions();

  const dragDrop = useDragDrop();
  const dragging = dragDrop?.dragging ?? false;

  // ── Auto-scroll while dragging ────────────────────────────────────────────────
  // When the dragged ghost nears the top or bottom of the scroll view, scroll
  // programmatically so the user can reach categories outside the visible area.

  const scrollRef = useRef<ScrollView>(null);
  /** Wraps the ScrollView — used solely for measureInWindow (ScrollView type lacks it). */
  const scrollWrapperRef = useRef<View>(null);
  /** Absolute screen bounds of the ScrollView, measured via measureInWindow. */
  const scrollBoundsRef = useRef<{ top: number; bottom: number } | null>(null);
  /** Current scroll offset, kept in sync via onScroll. */
  const scrollOffsetYRef = useRef(0);
  /**
   * Stable ref to the current dragDrop context value.
   * Updated after every render so the interval closure always reads up-to-date
   * shared values (ghostY) without listing dragDrop in the effect deps.
   */
  const dragDropRef = useRef(dragDrop);
  useEffect(() => { dragDropRef.current = dragDrop; });

  // Measure the ScrollView's absolute position whenever its layout changes.
  const onScrollViewLayout = useCallback(() => {
    scrollWrapperRef.current?.measureInWindow((_x, y, _w, height) => {
      scrollBoundsRef.current = { top: y, bottom: y + height };
    });
  }, []);

  // Track scroll offset so the auto-scroll can calculate the next position.
  const onScrollView = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffsetYRef.current = e.nativeEvent.contentOffset.y;
  }, []);

  // Start / stop the auto-scroll interval based on dragging state.
  useEffect(() => {
    if (!dragging) return;

    const EDGE_ZONE = 80; // px from the edge that triggers scrolling
    const MAX_SPEED = 10; // px per tick at the very edge (~600 px/s at 60 fps)

    const interval = setInterval(() => {
      const ctx = dragDropRef.current;
      const bounds = scrollBoundsRef.current;
      if (!ctx || !bounds) return;

      // ghostY is absolute_y − 30; add 30 back to approximate the finger position.
      const fingerY = ctx.ghostY.value + 30;

      const distFromTop = fingerY - bounds.top;
      const distFromBottom = bounds.bottom - fingerY;

      let speed = 0;
      if (distFromTop >= 0 && distFromTop < EDGE_ZONE) {
        speed = -MAX_SPEED * (1 - distFromTop / EDGE_ZONE);
      } else if (distFromBottom >= 0 && distFromBottom < EDGE_ZONE) {
        speed = MAX_SPEED * (1 - distFromBottom / EDGE_ZONE);
      }

      if (Math.abs(speed) >= 1) {
        const newY = Math.max(0, scrollOffsetYRef.current + speed);
        scrollRef.current?.scrollTo({ y: newY, animated: false });
        // Zone bounds have shifted — re-measure so hit-testing stays accurate.
        ctx.remeasureZones();
      }
    }, 16); // ~60 fps

    return () => clearInterval(interval);
  }, [dragging]);
  // dragDropRef and the scroll refs are stable refs — safe to omit from deps.

  // ── Bootstrap ────────────────────────────────────────────────────────────────
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

  /**
   * When a drag is active, append empty groups for every known server category
   * that has no items in the current list (so the user can drag into them).
   * Empty groups appear after the populated groups so the visible layout
   * doesn't shift when dragging starts.
   */
  const draggableGroups = useMemo<CategoryGroup[]>(() => {
    if (!dragging) return categoryGroups;

    const activeCategoryIds = new Set(categoryGroups.map((g) => g.categoryId));

    const emptyGroups: CategoryGroup[] = allCategories
      .filter((c) => !activeCategoryIds.has(c.id))
      .sort((a, b) => a.ordering - b.ordering)
      .map((c) => ({ category: c.name, categoryId: c.id, items: [] }));

    const extraGroups: CategoryGroup[] = [...emptyGroups];
    if (!activeCategoryIds.has(null)) {
      extraGroups.push({ category: 'Uncategorized', categoryId: null, items: [] });
    }

    return [...categoryGroups, ...extraGroups];
  }, [dragging, categoryGroups, allCategories]);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
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
          <View ref={scrollWrapperRef} style={styles.scroll} onLayout={onScrollViewLayout}>
            <ScrollView
              ref={scrollRef}
              style={styles.scrollInner}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              // Disable user-initiated scroll during drag; programmatic scrollTo still works.
              scrollEnabled={!dragging}
              onScroll={onScrollView}
              scrollEventThrottle={16}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor={Colors.mint}
                />
              }
            >
              {draggableGroups.map(({ category, categoryId, items: catItems }) => (
                <CategorySection
                  key={categoryId ?? 'uncategorized'}
                  category={category}
                  categoryId={categoryId}
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
          </View>
        )}
      </KeyboardAvoidingView>

      {/* BottomNav is position:absolute — anchor it to SafeAreaView, not KAV. */}
      <BottomNav active="lists" />

      {/* Drag ghost — absolute overlay, follows the finger during drag. */}
      <DragGhost />

      {/* List picker modal */}
      <ListPickerModal />
    </SafeAreaView>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ListDetailScreen({ navigation }: ListDetailScreenProps) {
  const moveItemToCategory = useListDetailStore((s) => s.moveItemToCategory);

  const handleDrop = useCallback(
    (item: LocalItem, categoryId: number | null) => {
      void moveItemToCategory(item.localId, categoryId);
    },
    [moveItemToCategory]
  );

  return (
    <DragDropProvider onDrop={handleDrop}>
      <ListDetailContent navigation={navigation} />
    </DragDropProvider>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.mintBg,
  },
  keyboardAvoid: {
    flex: 1,
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
  scrollInner: {
    flex: 1,
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
