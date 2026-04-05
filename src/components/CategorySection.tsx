import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import SwipeableItem from '@/components/SwipeableItem';
import { Colors, CategoryColors, Spacing, FontSize } from '@/theme';
import type { LocalItem } from '@/db/items';
import type { SwipeableItemHandlers } from '@/components/SwipeableItem';

type CategorySectionProps = SwipeableItemHandlers & {
  category: string;
  items: LocalItem[];
}

export default function CategorySection({
  category,
  items,
  ...handlers
}: CategorySectionProps) {
  const dotColor = CategoryColors[category] ?? CategoryColors['Other'];

  return (
    <View style={styles.section}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <Text style={styles.label}>{category.toUpperCase()}</Text>
        <View style={styles.rule} />
      </View>

      {items.map((item) => (
        <SwipeableItem key={item.localId} item={item} {...handlers} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: Spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
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
});
