import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import SwipeableItem from '@/components/SwipeableItem';
import { useDragDrop } from '@/components/DragDropContext';
import { Colors, CATEGORY_PALETTE, Spacing, FontSize } from '@/theme';
import type { LocalItem } from '@/db/items';
import type { SwipeableItemHandlers } from '@/components/SwipeableItem';

type CategorySectionProps = SwipeableItemHandlers & {
  category: string;
  categoryId: number | null;
  items: LocalItem[];
};

export default function CategorySection({
  category,
  categoryId,
  items,
  ...handlers
}: CategorySectionProps) {
  const coloredCount = CATEGORY_PALETTE.length - 1; // last slot reserved for uncategorized
  const dotColor =
    categoryId !== null
      ? CATEGORY_PALETTE[categoryId % coloredCount]
      : CATEGORY_PALETTE[CATEGORY_PALETTE.length - 1];

  const sectionRef = useRef<View>(null);
  const dragDrop = useDragDrop();

  // Register this section as a drop zone while mounted.
  // registerZone / unregisterZone are stable (useCallback with empty deps).
  const registerZone = dragDrop?.registerZone;
  const unregisterZone = dragDrop?.unregisterZone;

  useEffect(() => {
    if (!registerZone || !unregisterZone) {
      return;
    }

    registerZone(
      categoryId,
      () =>
        new Promise((resolve) => {
          if (!sectionRef.current) {
            resolve(null);
            return;
          }
          sectionRef.current.measureInWindow((x, y, width, height) => {
            resolve({ x, y, width, height });
          });
        })
    );

    return () => unregisterZone(categoryId);
  }, [categoryId, registerZone, unregisterZone]);

  const isHovered = dragDrop?.hoveredCategoryId === categoryId;

  return (
    <View ref={sectionRef} style={[styles.section, isHovered && styles.sectionHovered]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <Text style={styles.label}>{category.toUpperCase()}</Text>
        <View style={styles.rule} />
      </View>

      {items.map((item) => (
        <SwipeableItem key={item.localId} item={item} {...handlers} />
      ))}

      {/* Empty drop target placeholder shown when dragging and no items */}
      {items.length === 0 && dragDrop?.dragging && (
        <View style={styles.emptyDropTarget}>
          <Text style={styles.emptyDropText}>Drop here</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: Spacing.xl,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  sectionHovered: {
    borderColor: Colors.mint,
    backgroundColor: `${Colors.mint}10`,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    paddingHorizontal: 2,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: Colors.mintPale,
  },
  label: {
    fontSize: FontSize.label,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: Colors.mint,
  },
  rule: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.mintPale,
  },
  emptyDropTarget: {
    height: 52,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.mintPale,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  emptyDropText: {
    fontSize: FontSize.small,
    color: Colors.textFaded,
    fontWeight: '600',
  },
});
