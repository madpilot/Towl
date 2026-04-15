import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { useListDetailStore, useItemActions } from '@/store/listDetailStore';
import SwipeableItem from '@/components/SwipeableItem';
import { Colors, Spacing, Radii, FontSize } from '@/theme';

export default function TrolleySection() {
  const doneItems = useListDetailStore(useShallow((s) => s.items.filter((i) => i.isChecked)));
  const {
    editingId,
    setEditingId,
    toggleDone,
    toggleImportant,
    deleteItem,
    saveItem,
    clearTrolley,
  } = useItemActions();

  if (doneItems.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.dot} />
        <Text style={styles.label}>In the trolley</Text>
        <View style={styles.rule} />
      </View>
      {doneItems.map((item) => (
        <SwipeableItem
          key={item.localId}
          item={item}
          onToggleDone={toggleDone}
          onToggleImportant={toggleImportant}
          onDelete={deleteItem}
          onSave={saveItem}
          editingId={editingId}
          setEditingId={setEditingId}
        />
      ))}
      <TouchableOpacity style={styles.doneBtn} onPress={clearTrolley} activeOpacity={0.75}>
        <Text style={styles.doneBtnText}>Shopping is done!</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: Spacing.sm,
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
    backgroundColor: Colors.mintLight,
  },
  label: {
    fontSize: FontSize.label,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: Colors.mintLight,
    textTransform: 'uppercase',
  },
  rule: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.mintPale,
  },
  doneBtn: {
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    alignSelf: 'center',
    backgroundColor: Colors.mint,
    borderRadius: Radii.full,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.xxl,
  },
  doneBtnText: {
    fontSize: FontSize.body,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.2,
  },
});
