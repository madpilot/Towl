import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { SectionLabel, Card, Sep, Row } from '@/components/settings/SettingsUI';
import { Colors, Spacing, FontSize } from '@/theme';
import type { HouseholdCategory } from '@/api/households';

type Props = {
  categories: HouseholdCategory[];
  onEdit: (category: HouseholdCategory) => void;
  onNew: () => void;
};

export function CategoriesSection({ categories, onEdit, onNew }: Props) {
  return (
    <>
      <SectionLabel label="Categories" />
      <Card>
        {categories.length === 0 ? (
          <View style={styles.emptyRow}>
            <Text style={styles.emptyText}>No categories yet.</Text>
          </View>
        ) : (
          categories.map((cat, i) => (
            <View key={cat.id}>
              <Row label={cat.name} onPress={() => onEdit(cat)} />
              {i < categories.length - 1 && <Sep />}
            </View>
          ))
        )}
        <Sep />
        <TouchableOpacity style={styles.addRow} onPress={onNew} activeOpacity={0.7}>
          <Text style={styles.addLabel}>+ Add category</Text>
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
