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
  PanResponder,
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

// ─── DragRow ──────────────────────────────────────────────────────────────────

type DragRowProps = {
  cat: HouseholdCategory;
  index: number;
  isDragging: boolean;
  onDragStart: (index: number) => void;
  onDragMove: (index: number, dy: number) => void;
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
  const panHandlers = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => onDragStart(index),
        onPanResponderMove: (_, g) => onDragMove(index, g.dy),
        onPanResponderRelease: (_, g) => onDragEnd(index, g.dy),
        onPanResponderTerminate: () => onDragEnd(index, 0),
      }).panHandlers,
    [index, onDragStart, onDragMove, onDragEnd]
  );

  return (
    <View
      style={[styles.dragRow, isDragging && styles.dragRowLifted]}
      onLayout={onHeightMeasured ? (e) => onHeightMeasured(e.nativeEvent.layout.height) : undefined}
    >
      <View style={styles.handle} {...panHandlers}>
        <Text style={styles.handleText}>≡</Text>
      </View>
      <TouchableOpacity
        style={styles.rowContent}
        onPress={onEditPress}
        activeOpacity={0.7}
      >
        <Text style={styles.rowName} numberOfLines={1}>{cat.name}</Text>
        <Text style={styles.rowChevron}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HouseholdCategoriesScreen({ navigation, route }: HouseholdCategoriesScreenProps) {
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

  // ── Load ───────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!householdsApi) return;
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
    if (!name.trim() || !householdsApi) return;
    setAction('create');
    try {
      const ordering = categories.length;
      const created = await householdsApi.createCategory(householdId, name.trim(), ordering);
      setCategories((prev) => [...prev, created]);
      closeSheet();
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create category.');
    } finally {
      setAction(null);
    }
  }

  async function handleUpdate() {
    if (!name.trim() || !editingCat || !householdsApi) return;
    setAction('update');
    try {
      await householdsApi.updateCategory(editingCat.id, name.trim(), editingCat.ordering);
      setCategories((prev) =>
        prev.map((c) => c.id === editingCat.id ? { ...c, name: name.trim() } : c)
      );
      closeSheet();
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to update category.');
    } finally {
      setAction(null);
    }
  }

  async function handleDelete() {
    if (!editingCat || !householdsApi) return;
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
    setScrollEnabled(false);
    setDraggingIndex(idx);
    setTargetIndex(idx);
  }, []);

  const handleDragMove = useCallback((fromIndex: number, dy: number) => {
    const h = itemHeightRef.current;
    const centerY = fromIndex * h + h / 2 + dy;
    const target = Math.max(
      0,
      Math.min(categoriesRef.current.length - 1, Math.floor(centerY / h))
    );
    setTargetIndex(target);
  }, []);

  const handleDragEnd = useCallback((fromIndex: number, dy: number) => {
    const cats = categoriesRef.current;
    const h = itemHeightRef.current;
    const centerY = fromIndex * h + h / 2 + dy;
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
  }, [householdsApi]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backChevron}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{householdName}: Categories</Text>
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
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          scrollEnabled={scrollEnabled}
        >
          <Card>
            {categories.length === 0 ? (
              <View style={styles.emptyRow}>
                <Text style={styles.emptyText}>{'No categories yet. Tap "+ New" to add one.'}</Text>
              </View>
            ) : (
              displayCats.map((cat, displayIdx) => {
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
                      onHeightMeasured={displayIdx === 0 ? (h) => { itemHeightRef.current = h; } : undefined}
                    />
                    {displayIdx < displayCats.length - 1 && <Sep />}
                  </View>
                );
              })
            )}
          </Card>
        </ScrollView>
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
  scroll: { flex: 1 },
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
