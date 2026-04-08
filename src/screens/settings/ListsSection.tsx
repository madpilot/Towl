import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { SectionLabel, Card, Sep, Row } from '@/components/settings/SettingsUI';
import { Colors, Spacing, FontSize } from '@/theme';
import type { ApiShoppingList } from '@/api/shoppinglists';

type Props = {
  lists: ApiShoppingList[];
  onEdit: (list: ApiShoppingList) => void;
  onNew: () => void;
};

export function ListsSection({ lists, onEdit, onNew }: Props) {
  return (
    <>
      <SectionLabel label="Shopping Lists" />
      <Card>
        {lists.length === 0 ? (
          <View style={styles.emptyRow}>
            <Text style={styles.emptyText}>No lists yet.</Text>
          </View>
        ) : (
          lists.map((list, i) => (
            <View key={list.id}>
              <Row
                label={list.name}
                sub={`${list.items.length} item${list.items.length !== 1 ? 's' : ''}`}
                onPress={() => onEdit(list)}
              />
              {i < lists.length - 1 && <Sep />}
            </View>
          ))
        )}
        <Sep />
        <TouchableOpacity style={styles.addRow} onPress={onNew} activeOpacity={0.7}>
          <Text style={styles.addLabel}>+ New list</Text>
        </TouchableOpacity>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  emptyRow: { padding: Spacing.xl },
  emptyText: { fontSize: FontSize.body, color: Colors.textFaded },
  addRow: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md + 2 },
  addLabel: { fontSize: FontSize.body, fontWeight: '700', color: Colors.mint },
});
