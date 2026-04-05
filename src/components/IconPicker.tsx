import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { ICON_CODEPOINTS } from '@/icons/kitchenowlIcons';
import KitchenOwlIcon from '@/components/KitchenOwlIcon';
import { Colors, Spacing, Radii, FontSize } from '@/theme';

type IconPickerProps = {
  visible: boolean;
  selected: string | null;
  onSelect: (key: string) => void;
  onClose: () => void;
}

const ALL_KEYS = Object.keys(ICON_CODEPOINTS);
const NUM_COLUMNS = 6;

export default function IconPicker({ visible, selected, onSelect, onClose }: IconPickerProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ALL_KEYS;
    return ALL_KEYS.filter((k) => k.includes(q));
  }, [query]);

  function handleSelect(key: string) {
    onSelect(key);
    onClose();
    setQuery('');
  }

  function handleClose() {
    onClose();
    setQuery('');
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title}>Choose icon</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn} testID="icon-picker-close">
            <Text style={styles.closeText}>Done</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search icons…"
            placeholderTextColor={Colors.textFaded}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(item) => item}
          numColumns={NUM_COLUMNS}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.cell, selected === item && styles.cellSelected]}
              onPress={() => handleSelect(item)}
              activeOpacity={0.7}
            >
              <KitchenOwlIcon iconKey={item} size={28} style={{ color: Colors.mint }} />
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.grid}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.mintPale,
  },
  title: {
    fontSize: FontSize.heading,
    fontWeight: '700',
    color: Colors.textDark,
  },
  closeBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  closeText: {
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.mint,
  },
  searchRow: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
  },
  searchInput: {
    height: 40,
    borderRadius: Radii.lg,
    backgroundColor: Colors.mintBg,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.body,
    color: Colors.textDark,
    borderWidth: 1.5,
    borderColor: Colors.mintPale,
  },
  grid: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    margin: Spacing.xs,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.mintBg,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cellSelected: {
    borderColor: Colors.mint,
    backgroundColor: Colors.mintPale,
  },
});
