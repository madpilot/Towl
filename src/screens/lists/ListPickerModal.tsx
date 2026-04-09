import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { useListNav } from '@/store/listDetailStore';
import { useHouseholdStore } from '@/store/householdStore';
import { Colors, Spacing, Radii, FontSize } from '@/theme';

export default function ListPickerModal() {
  const { allLists, activeLocalId, listPickerVisible, setListPickerVisible, switchToList } = useListNav();
  const householdId = useHouseholdStore((s) => s.selectedHousehold?.id ?? 0);

  return (
    <Modal
      visible={listPickerVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setListPickerVisible(false)}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={() => setListPickerVisible(false)}
      >
        <View style={styles.menu}>
          {allLists.map((list) => (
            <TouchableOpacity
              key={list.localId}
              style={[styles.row, list.localId === activeLocalId && styles.rowActive]}
              onPress={() => switchToList(list, householdId)}
              activeOpacity={0.7}
            >
              <Text style={[styles.rowText, list.localId === activeLocalId && styles.rowTextActive]}>
                {list.name}
              </Text>
              {list.isDirty && <View style={styles.dirtyDot} />}
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
