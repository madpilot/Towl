import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet, PanResponder } from 'react-native';
import Sheet from '@/components/Sheet';
import { SectionLabel, Card, Sep, Field, PrimaryBtn, SecondaryBtn } from '@/components/settings';
import { useCategoriesSection } from '@/store/householdDetailStore';
import { Colors, Spacing, FontSize } from '@/theme';
import type { HouseholdCategory } from '@/api/households';

const ITEM_HEIGHT_EST = 46;

// ─── DragRow ──────────────────────────────────────────────────────────────────

type DragRowProps = {
  cat: HouseholdCategory;
  /** Stable index in localCats — used for position math, never changes mid-drag. */
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
  // Recreate PanResponder only when index or stable callbacks change.
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
      {/* Drag handle — the only touch target for dragging */}
      <View style={styles.handle} {...panHandlers}>
        <Text style={styles.handleText}>≡</Text>
      </View>

      {/* Name + chevron — tapping anywhere here opens the edit sheet */}
      <TouchableOpacity
        style={styles.rowContent}
        onPress={onEditPress}
        activeOpacity={0.7}
        testID={`edit-category-${cat.id}`}
      >
        <Text style={styles.rowName} numberOfLines={1}>{cat.name}</Text>
        <Text style={styles.editChevron}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── CategoriesSection ────────────────────────────────────────────────────────

export type CategoriesSectionProps = {
  /** Called with true when a drag begins and false when it ends.
   *  Pass this to the parent ScrollView's scrollEnabled prop to prevent
   *  the native scroll view from stealing the vertical gesture. */
  onDragScrollLock?: (locked: boolean) => void;
};

export function CategoriesSection({ onDragScrollLock }: CategoriesSectionProps = {}) {
  const { categories, createCategory, updateCategory, deleteCategory, reorderCategory } = useCategoriesSection();

  // Stable ground-truth order — only updated when a drag commits or store changes.
  const [localCats, setLocalCats] = useState<HouseholdCategory[]>(() =>
    [...categories].sort((a, b) => a.ordering - b.ordering)
  );
  const localCatsRef = useRef(localCats);
  localCatsRef.current = localCats;

  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (!isDraggingRef.current) {
      setLocalCats([...categories].sort((a, b) => a.ordering - b.ordering));
    }
  }, [categories]);

  // Drag state — draggingIndex is the item's stable position in localCats.
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [targetIndex, setTargetIndex] = useState<number | null>(null);

  // Real-time display order: localCats with the dragged item moved to targetIndex.
  const displayCats = useMemo(() => {
    if (draggingIndex === null || targetIndex === null || draggingIndex === targetIndex) {
      return localCats;
    }
    const next = [...localCats];
    const [item] = next.splice(draggingIndex, 1);
    next.splice(targetIndex, 0, item);
    return next;
  }, [localCats, draggingIndex, targetIndex]);

  const itemHeightRef = useRef(ITEM_HEIGHT_EST);

  const reorderRef = useRef(reorderCategory);
  useEffect(() => { reorderRef.current = reorderCategory; }, [reorderCategory]);

  const onDragScrollLockRef = useRef(onDragScrollLock);
  useEffect(() => { onDragScrollLockRef.current = onDragScrollLock; }, [onDragScrollLock]);

  // Stable drag callbacks — all mutable state is accessed through refs.

  const handleDragStart = useCallback((idx: number) => {
    isDraggingRef.current = true;
    onDragScrollLockRef.current?.(true);
    setDraggingIndex(idx);
    setTargetIndex(idx);
  }, []);

  const handleDragMove = useCallback((fromIndex: number, dy: number) => {
    const h = itemHeightRef.current;
    const centerY = fromIndex * h + h / 2 + dy;
    const target = Math.max(
      0,
      Math.min(localCatsRef.current.length - 1, Math.floor(centerY / h))
    );
    setTargetIndex(target);
  }, []);

  const handleDragEnd = useCallback((fromIndex: number, dy: number) => {
    const cats = localCatsRef.current;
    const h = itemHeightRef.current;
    const centerY = fromIndex * h + h / 2 + dy;
    const target = Math.max(0, Math.min(cats.length - 1, Math.floor(centerY / h)));

    if (target !== fromIndex) {
      const newCats = [...cats];
      const [moved] = newCats.splice(fromIndex, 1);
      newCats.splice(target, 0, moved);
      setLocalCats(newCats);
      void reorderRef.current(moved.id, target, newCats);
    }

    setDraggingIndex(null);
    setTargetIndex(null);
    isDraggingRef.current = false;
    onDragScrollLockRef.current?.(false);
  }, []);

  // ── Modal state ────────────────────────────────────────────────────────────

  const [modal, setModal] = useState<'new' | 'edit' | null>(null);
  const [catName, setCatName] = useState('');
  const [editingCatId, setEditingCatId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!catName.trim()) return;
    setSaving(true);
    try {
      await createCategory(catName.trim());
      setCatName('');
      setModal(null);
    } catch (e: unknown) {
      Alert.alert('Not yet available', e instanceof Error ? e.message : 'Failed to create category.');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate() {
    if (!catName.trim() || editingCatId === null) return;
    setSaving(true);
    try {
      await updateCategory(editingCatId, catName.trim());
      setModal(null);
    } catch (e: unknown) {
      Alert.alert('Not yet available', e instanceof Error ? e.message : 'Failed to update category.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (editingCatId === null) return;
    setSaving(true);
    try {
      await deleteCategory(editingCatId);
      setModal(null);
    } catch (e: unknown) {
      Alert.alert('Not yet available', e instanceof Error ? e.message : 'Failed to delete category.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <SectionLabel label="Categories" />
      <Card>
        {localCats.length === 0 ? (
          <View style={styles.emptyRow}>
            <Text style={styles.emptyText}>No categories yet.</Text>
          </View>
        ) : (
          displayCats.map((cat, displayIdx) => {
            // Pass the stable localCats index so the PanResponder is never
            // recreated mid-drag when the item's display position changes.
            const stableIndex = localCatsRef.current.findIndex((c) => c.id === cat.id);
            return (
              <View key={cat.id}>
                <DragRow
                  cat={cat}
                  index={stableIndex}
                  isDragging={draggingIndex === stableIndex}
                  onDragStart={handleDragStart}
                  onDragMove={handleDragMove}
                  onDragEnd={handleDragEnd}
                  onEditPress={() => {
                    setEditingCatId(cat.id);
                    setCatName(cat.name);
                    setModal('edit');
                  }}
                  onHeightMeasured={displayIdx === 0 ? (h) => { itemHeightRef.current = h; } : undefined}
                />
                {displayIdx < displayCats.length - 1 && <Sep />}
              </View>
            );
          })
        )}
        <Sep />
        <TouchableOpacity
          style={styles.addRow}
          onPress={() => { setCatName(''); setModal('new'); }}
          activeOpacity={0.7}
        >
          <Text style={styles.addLabel}>+ Add category</Text>
        </TouchableOpacity>
      </Card>

      <Sheet visible={modal === 'new'} title="New category" onClose={() => setModal(null)}>
        <Field label="Category name" value={catName} onChangeText={setCatName} placeholder="e.g. Frozen" />
        <PrimaryBtn label="Add category" onPress={handleCreate} loading={saving} />
        <SecondaryBtn label="Cancel" onPress={() => setModal(null)} />
        <View style={{ height: Spacing.xl }} />
      </Sheet>

      <Sheet visible={modal === 'edit'} title="Edit category" onClose={() => setModal(null)}>
        <Field label="Category name" value={catName} onChangeText={setCatName} placeholder="Category name" />
        <PrimaryBtn label="Save changes" onPress={handleUpdate} loading={saving} />
        <PrimaryBtn label="Delete category" onPress={handleDelete} loading={saving} danger />
        <SecondaryBtn label="Cancel" onPress={() => setModal(null)} />
        <View style={{ height: Spacing.xl }} />
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  emptyRow: { padding: Spacing.xl },
  emptyText: { fontSize: FontSize.body, color: Colors.textFaded },
  addRow: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md + 2 },
  addLabel: { fontSize: FontSize.body, fontWeight: '700', color: Colors.mint },
  dragRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dragRowLifted: {
    backgroundColor: Colors.mintPale,
    opacity: 0.7,
  },
  handle: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md + 2,
    paddingLeft: Spacing.sm + 4,
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
    paddingLeft: Spacing.md,
    paddingRight: Spacing.xl,
  },
  rowName: {
    flex: 1,
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.textDark,
  },
  editChevron: {
    fontSize: 20,
    color: Colors.mintPale,
    fontWeight: '700',
  },
});
