import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  StyleSheet,
  TextInput,
  ScrollView,
} from 'react-native';
import Sheet from '@/components/Sheet';
import BottomNav from '@/components/BottomNav';
import { Card, Sep, PrimaryBtn } from '@/components/settings';
import { useAuthStore } from '@/store/authStore';
import { Colors, Spacing, Radii, FontSize } from '@/theme';
import type { HouseholdCategoriesScreenProps } from '@/navigation/types';
import type { HouseholdCategory } from '@/api/households';

// ─── Types ────────────────────────────────────────────────────────────────────

type SheetMode = 'new' | 'edit' | null;
type ActionKind = 'create' | 'update' | 'delete' | null;

const BOTTOM_NAV_CLEARANCE = 100;
const ITEM_HEIGHT_EST = 50;
const SCROLL_EDGE_ZONE = 80; // px from top/bottom edge that triggers auto-scroll
const SCROLL_SPEED = 6; // px per frame during auto-scroll

// ─── DragRow ──────────────────────────────────────────────────────────────────

type DragRowProps = {
  cat: HouseholdCategory;
  index: number;
  isDragging: boolean;
  onDragStart: (index: number) => void;
  // pageY is the touch's current Y position in screen coordinates
  onDragMove: (index: number, dy: number, pageY: number) => void;
  onDragEnd: (index: number, dy: number) => void;
  onEditPress: () => void;
  onHeightMeasured?: (height: number) => void;
};

function DragRow({
  cat,
  index,
  isDragging,
  onDragStart,
  onDragMove,
  onDragEnd,
  onEditPress,
  onHeightMeasured,
}: DragRowProps) {
  // Track the finger's starting Y so we can compute dy from raw responder events.
  const startYRef = useRef(0);
  const lastDyRef = useRef(0);

  return (
    <View
      style={[styles.dragRow, isDragging && styles.dragRowLifted]}
      onLayout={onHeightMeasured ? (e) => onHeightMeasured(e.nativeEvent.layout.height) : undefined}
    >
      {/* Use raw responder props instead of PanResponder so we can set
          onResponderTerminationRequest to false — this prevents SafeAreaView /
          ScrollView from stealing the gesture when the finger drags above the
          scroll area's top edge. */}
      <View
        style={styles.handle}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(e) => {
          startYRef.current = e.nativeEvent.pageY;
          lastDyRef.current = 0;
          onDragStart(index);
        }}
        onResponderMove={(e) => {
          const dy = e.nativeEvent.pageY - startYRef.current;
          lastDyRef.current = dy;
          onDragMove(index, dy, e.nativeEvent.pageY);
        }}
        onResponderRelease={() => onDragEnd(index, lastDyRef.current)}
        onResponderTerminate={() => onDragEnd(index, lastDyRef.current)}
      >
        <Text style={styles.handleText}>≡</Text>
      </View>
      <TouchableOpacity style={styles.rowContent} onPress={onEditPress} activeOpacity={0.7}>
        <Text style={styles.rowName} numberOfLines={1}>
          {cat.name}
        </Text>
        <Text style={styles.rowChevron}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HouseholdCategoriesScreen({
  navigation,
  route,
}: HouseholdCategoriesScreenProps) {
  const { householdId, householdName } = route.params;
  const { householdsApi } = useAuthStore();

  // ── Data ───────────────────────────────────────────────────────────────────

  const [loading, setLoading] = useState(true);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [categories, setCategories] = useState<HouseholdCategory[]>([]);
  const categoriesRef = useRef(categories);
  categoriesRef.current = categories;

  // ── Sheet state ────────────────────────────────────────────────────────────

  const [sheet, setSheet] = useState<SheetMode>(null);
  const [editingCat, setEditingCat] = useState<HouseholdCategory | null>(null);
  const [name, setName] = useState('');
  const [action, setAction] = useState<ActionKind>(null);
  const saving = action !== null;

  // ── Drag state ─────────────────────────────────────────────────────────────

  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [targetIndex, setTargetIndex] = useState<number | null>(null);
  const isDraggingRef = useRef(false);
  const itemHeightRef = useRef(ITEM_HEIGHT_EST);

  // Real-time display order: categories with the dragged item moved to targetIndex
  const displayCats = useMemo(() => {
    if (draggingIndex === null || targetIndex === null || draggingIndex === targetIndex) {
      return categories;
    }
    const next = [...categories];
    const [item] = next.splice(draggingIndex, 1);
    next.splice(targetIndex, 0, item);
    return next;
  }, [categories, draggingIndex, targetIndex]);

  // ── Scroll & auto-scroll refs ──────────────────────────────────────────────

  const scrollViewRef = useRef<ScrollView>(null);
  const scrollContainerRef = useRef<View>(null); // used for measure() — ScrollView doesn't expose it
  const scrollOffsetRef = useRef(0); // current scroll Y
  const scrollViewTopRef = useRef(0); // screen Y of scroll view top
  const scrollViewHeightRef = useRef(0); // visible height of scroll view

  // Drag context needed by the auto-scroll interval to recalculate target
  const dragStartScrollOffsetRef = useRef(0);
  const dragFromIndexRef = useRef(0);
  const dragDyRef = useRef(0);

  const autoScrollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopAutoScroll() {
    if (autoScrollTimerRef.current !== null) {
      clearInterval(autoScrollTimerRef.current);
      autoScrollTimerRef.current = null;
    }
  }

  function startAutoScroll(direction: 'up' | 'down') {
    // Don't restart if already scrolling in the same direction
    if (autoScrollTimerRef.current !== null) {
      return;
    }

    autoScrollTimerRef.current = setInterval(() => {
      const delta = direction === 'up' ? -SCROLL_SPEED : SCROLL_SPEED;
      const newOffset = Math.max(0, scrollOffsetRef.current + delta);
      scrollViewRef.current?.scrollTo({ y: newOffset, animated: false });
      scrollOffsetRef.current = newOffset;

      // Recalculate target to reflect the list having scrolled under the finger
      const h = itemHeightRef.current;
      const scrollDelta = newOffset - dragStartScrollOffsetRef.current;
      const centerY = dragFromIndexRef.current * h + h / 2 + dragDyRef.current + scrollDelta;
      const target = Math.max(
        0,
        Math.min(categoriesRef.current.length - 1, Math.floor(centerY / h))
      );
      setTargetIndex(target);
    }, 16);
  }

  // ── Load ───────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!householdsApi) {
      return;
    }
    try {
      const fetched = await householdsApi.getCategories(householdId);
      setCategories(fetched.slice().sort((a, b) => a.ordering - b.ordering));
    } catch {
      Alert.alert('Error', 'Could not load categories. Check your connection.');
    }
  }, [householdsApi, householdId]);

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, [load]);

  // ── Sheet helpers ──────────────────────────────────────────────────────────

  function openNew() {
    setEditingCat(null);
    setName('');
    setSheet('new');
  }

  function openEdit(cat: HouseholdCategory) {
    setEditingCat(cat);
    setName(cat.name);
    setSheet('edit');
  }

  function closeSheet() {
    setSheet(null);
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  async function handleCreate() {
    if (!name.trim() || !householdsApi) {
      return;
    }
    setAction('create');
    try {
      const ordering = categories.length;
      const created = await householdsApi.createCategory(householdId, name.trim(), ordering);
      // Override the server-echoed ordering with the value we sent — the server may
      // return a different ordering value in its response.
      setCategories((prev) => [...prev, { ...created, ordering }]);
      closeSheet();
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create category.');
    } finally {
      setAction(null);
    }
  }

  async function handleUpdate() {
    if (!name.trim() || !editingCat || !householdsApi) {
      return;
    }
    setAction('update');
    try {
      await householdsApi.updateCategory(editingCat.id, name.trim(), editingCat.ordering);
      setCategories((prev) =>
        prev.map((c) => (c.id === editingCat.id ? { ...c, name: name.trim() } : c))
      );
      closeSheet();
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to update category.');
    } finally {
      setAction(null);
    }
  }

  async function handleDelete() {
    if (!editingCat || !householdsApi) {
      return;
    }
    setAction('delete');
    try {
      await householdsApi.deleteCategory(editingCat.id);
      setCategories((prev) => prev.filter((c) => c.id !== editingCat.id));
      closeSheet();
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to delete category.');
    } finally {
      setAction(null);
    }
  }

  // ── Drag handlers ──────────────────────────────────────────────────────────

  const handleDragStart = useCallback((idx: number) => {
    isDraggingRef.current = true;
    dragStartScrollOffsetRef.current = scrollOffsetRef.current;
    setScrollEnabled(false);
    setDraggingIndex(idx);
    setTargetIndex(idx);
  }, []);

  const handleDragMove = useCallback((fromIndex: number, dy: number, pageY: number) => {
    // Store for use by the auto-scroll interval
    dragFromIndexRef.current = fromIndex;
    dragDyRef.current = dy;

    // Target index adjusted for any scroll that has occurred since drag start
    const h = itemHeightRef.current;
    const scrollDelta = scrollOffsetRef.current - dragStartScrollOffsetRef.current;
    const centerY = fromIndex * h + h / 2 + dy + scrollDelta;
    const target = Math.max(0, Math.min(categoriesRef.current.length - 1, Math.floor(centerY / h)));
    setTargetIndex(target);

    // Start or stop auto-scroll based on proximity to the scroll view edges
    const top = scrollViewTopRef.current;
    const bottom = top + scrollViewHeightRef.current;
    if (pageY < top + SCROLL_EDGE_ZONE) {
      startAutoScroll('up');
    } else if (pageY > bottom - SCROLL_EDGE_ZONE) {
      startAutoScroll('down');
    } else {
      stopAutoScroll();
    }
  }, []);

  const handleDragEnd = useCallback(
    (fromIndex: number, dy: number) => {
      stopAutoScroll();

      const cats = categoriesRef.current;
      const h = itemHeightRef.current;
      const scrollDelta = scrollOffsetRef.current - dragStartScrollOffsetRef.current;
      const centerY = fromIndex * h + h / 2 + dy + scrollDelta;
      const target = Math.max(0, Math.min(cats.length - 1, Math.floor(centerY / h)));

      if (target !== fromIndex) {
        const newCats = [...cats];
        const [moved] = newCats.splice(fromIndex, 1);
        newCats.splice(target, 0, moved);
        const ordered = newCats.map((c, i) => ({ ...c, ordering: i }));
        setCategories(ordered);
        if (householdsApi) {
          ordered.forEach((c) => {
            void householdsApi.updateCategory(c.id, c.name, c.ordering);
          });
        }
      }

      setDraggingIndex(null);
      setTargetIndex(null);
      isDraggingRef.current = false;
      setScrollEnabled(true);
    },
    [householdsApi]
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backChevron}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {householdName}: Categories
        </Text>
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
        <View
          ref={scrollContainerRef}
          style={styles.scroll}
          onLayout={() => {
            scrollContainerRef.current?.measureInWindow((_x, y, _w, h) => {
              scrollViewTopRef.current = y;
              scrollViewHeightRef.current = h;
            });
          }}
        >
          <ScrollView
            ref={scrollViewRef}
            style={styles.fill}
            contentContainerStyle={styles.scrollContent}
            scrollEnabled={scrollEnabled}
            scrollEventThrottle={16}
            onScroll={(e) => {
              scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
            }}
          >
            {categories.length === 0 ? (
              <View style={styles.emptyRow}>
                <Text style={styles.emptyText}>{'No categories yet. Tap "+ New" to add one.'}</Text>
              </View>
            ) : (
              <Card>
                {displayCats.map((cat, displayIdx) => {
                  const stableIndex = categoriesRef.current.findIndex((c) => c.id === cat.id);
                  return (
                    <View key={cat.id}>
                      <DragRow
                        cat={cat}
                        index={stableIndex}
                        isDragging={draggingIndex === stableIndex}
                        onDragStart={handleDragStart}
                        onDragMove={handleDragMove}
                        onDragEnd={handleDragEnd}
                        onEditPress={() => openEdit(cat)}
                        onHeightMeasured={
                          displayIdx === 0
                            ? (h) => {
                                itemHeightRef.current = h;
                              }
                            : undefined
                        }
                      />
                      {displayIdx < displayCats.length - 1 && <Sep />}
                    </View>
                  );
                })}
              </Card>
            )}
          </ScrollView>
        </View>
      )}

      <BottomNav active="settings" />

      {/* Create sheet */}
      <Sheet visible={sheet === 'new'} title="New category" onClose={closeSheet}>
        <View style={styles.nameRow}>
          <TextInput
            style={styles.nameInput}
            value={name}
            onChangeText={setName}
            placeholder="Category name"
            placeholderTextColor={Colors.textFaded}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
          />
        </View>
        <PrimaryBtn
          label="Add category"
          onPress={handleCreate}
          loading={action === 'create'}
          disabled={saving}
        />
        <View style={{ height: Spacing.xl }} />
      </Sheet>

      {/* Edit sheet */}
      <Sheet visible={sheet === 'edit'} title="Edit category" onClose={closeSheet}>
        <View style={styles.nameRow}>
          <TextInput
            style={styles.nameInput}
            value={name}
            onChangeText={setName}
            placeholder="Category name"
            placeholderTextColor={Colors.textFaded}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
          />
        </View>
        <PrimaryBtn
          label="Save changes"
          onPress={handleUpdate}
          loading={action === 'update'}
          disabled={saving}
        />
        <View style={styles.dangerDivider}>
          <Text style={styles.dangerDividerLabel}>Danger zone</Text>
        </View>
        <PrimaryBtn
          label="Delete category"
          onPress={handleDelete}
          loading={action === 'delete'}
          disabled={saving}
          danger
        />
        <View style={{ height: Spacing.xl }} />
      </Sheet>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.mintBg },

  // Header
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
  addLabel: { fontSize: FontSize.body, fontWeight: '700', color: Colors.mintLight },

  // List
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 }, // outer View used for measureInWindow
  fill: { flex: 1 }, // ScrollView inside the wrapper
  scrollContent: { paddingBottom: BOTTOM_NAV_CLEARANCE },
  emptyRow: { padding: Spacing.xl, alignItems: 'center' },
  emptyText: { fontSize: FontSize.body, color: Colors.textFaded, textAlign: 'center' },

  // Drag rows
  dragRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
  },
  dragRowLifted: {
    backgroundColor: Colors.mintPale,
    opacity: 0.7,
  },
  handle: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md + 2,
  },
  handleText: {
    fontSize: FontSize.heading,
    color: Colors.textFaded,
    lineHeight: 22,
    textAlign: 'center',
  },
  rowContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md + 2,
    paddingRight: Spacing.xl,
  },
  rowName: {
    flex: 1,
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.textDark,
  },
  rowChevron: { fontSize: 20, color: Colors.mintPale, fontWeight: '700' },

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

  // Sheet — danger zone
  dangerDivider: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.mintPale,
    paddingTop: Spacing.md,
  },
  dangerDividerLabel: {
    fontSize: FontSize.small,
    fontWeight: '800',
    color: Colors.textFaded,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
