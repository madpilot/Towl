import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import Sheet from '@/components/Sheet';
import { SectionLabel, Card, Sep, Row, Field, PrimaryBtn, SecondaryBtn } from '@/components/settings';
import { useCategoriesSection } from '@/store/householdDetailStore';
import { Colors, Spacing, FontSize } from '@/theme';

export function CategoriesSection() {
  const { categories, createCategory, updateCategory, deleteCategory } = useCategoriesSection();

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
        {categories.length === 0 ? (
          <View style={styles.emptyRow}>
            <Text style={styles.emptyText}>No categories yet.</Text>
          </View>
        ) : (
          categories.map((cat, i) => (
            <View key={cat.id}>
              <Row
                label={cat.name}
                onPress={() => { setEditingCatId(cat.id); setCatName(cat.name); setModal('edit'); }}
              />
              {i < categories.length - 1 && <Sep />}
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
});
