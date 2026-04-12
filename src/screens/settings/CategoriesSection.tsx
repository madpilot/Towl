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
  index: number;
  isDragging: boolean;
  isTarget: boolean;
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
  isTarget,
  onDragStart,
  onDragMove,
  onDragEnd,
  onEditPress,
  onHeightMeasured,
}: DragRowProps) {
  // Recreate PanResponder only when index or stable callbacks change.
  // Callbacks are stable (useCallback([]) in parent), so recreation only
  // happens when this row's position in the list changes.
  const panHandlers = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => onDragStart(index),
        onPanResponderMove: (_, g) => onDragMove(index, g.dy),
        onPanResponderRelease: (_, g) => onDragEnd(index, g.dy),
        onPanResponderTerminate: () => onDragEnd(index, 0),
      }).panHandlers,
    [index, onDragStart, onDragMove, onDragEnd]
  );

  return (
    <View
      style={[styles.dragRow, isDragging && styles.dragRowLifted, isTarget && styles.dragRowTarget]}
      onLayout={onHeightMeasured ? (e) => onHeightMeasured(e.nativeEvent.layout.height) : undefined}
    >
      <View style={styles.handle} {...panHandlers}>
        <Text style={styles.handleText}>≡</Text>
      </View>
      <Text style={styles.rowName} numberOfLines={1}>{cat.name}</Text>
      <TouchableOpacity onPress={onEditPress} hitSlop={8} testID={`edit-category-${cat.id}`}>
        <Text style={styles.editChevron}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── CategoriesSection ────────────────────────────────────────────────────────

export function CategoriesSection() {
  const { categories, createCategory, updateCategory, deleteCategory, reorderCategory } = useCategoriesSection();

  // Local sorted copy — updated from the store while not dragging.
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

  // Drag visual state.
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [targetIndex, setTargetIndex] = useState<number | null>(null);

  // Measured height of one row (updated by the first item's onLayout).
  const itemHeightRef = useRef(ITEM_HEIGHT_EST);

  // reorderCategory changes identity on each render; keep a stable ref for use
  // inside the drag-end callback.
  const reorderRef = useRef(reorderCategory);

  useEffect(() => {
    reorderRef.current = reorderCategory;
  }, [reorderCategory]);

  // Stable drag callbacks — deps are [] because all mutable state is accessed
  // through refs, not closed-over state values.

  const handleDragStart = useCallback((idx: number) => {
    isDraggingRef.current = true;
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
      void reorderRef.current(moved.id, target);
    }

    setDraggingIndex(null);
    setTargetIndex(null);
    isDraggingRef.current = false;
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
          localCats.map((cat, i) => (
            <View key={cat.id}>
              <DragRow
                cat={cat}
                index={i}
                isDragging={draggingIndex === i}
                isTarget={targetIndex === i && draggingIndex !== i}
                onDragStart={handleDragStart}
                onDragMove={handleDragMove}
                onDragEnd={handleDragEnd}
                onEditPress={() => {
                  setEditingCatId(cat.id);
                  setCatName(cat.name);
                  setModal('edit');
                }}
                onHeightMeasured={i === 0 ? (h) => { itemHeightRef.current = h; } : undefined}
              />
              {i < localCats.length - 1 && <Sep />}
            </View>
          ))
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
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md + 2,
  },
  dragRowLifted: {
    backgroundColor: Colors.mintBg,
    opacity: 0.6,
  },
  dragRowTarget: {
    borderTopWidth: 2,
    borderTopColor: Colors.mint,
  },
  handle: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: Spacing.sm,
  },
  handleText: {
    fontSize: FontSize.heading,
    color: Colors.textFaded,
    lineHeight: 22,
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
