import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import Sheet from '@/components/Sheet';
import {
  SectionLabel,
  Card,
  Sep,
  Row,
  Field,
  PrimaryBtn,
  SecondaryBtn,
} from '@/components/settings';
import { useListsSection } from '@/store/householdDetailStore';
import { Colors, Spacing, FontSize } from '@/theme';

export function ListsSection() {
  const { lists, defaultListId, createList, renameList, deleteList } = useListsSection();

  const [modal, setModal] = useState<'new' | 'edit' | null>(null);
  const [listName, setListName] = useState('');
  const [editingListId, setEditingListId] = useState<number | null>(null);
  const [editingIsDefault, setEditingIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!listName.trim()) {
      return;
    }
    setSaving(true);
    try {
      await createList(listName.trim());
      setListName('');
      setModal(null);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create list.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRename() {
    if (!listName.trim() || editingListId === null) {
      return;
    }
    setSaving(true);
    try {
      await renameList(editingListId, listName.trim());
      setModal(null);
    } catch (e: unknown) {
      Alert.alert('Not yet available', e instanceof Error ? e.message : 'Failed to rename list.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (editingListId === null) {
      return;
    }
    setSaving(true);
    try {
      await deleteList(editingListId);
      setModal(null);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to delete list.');
    } finally {
      setSaving(false);
    }
  }

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
                sub={`${list.items.length} item${list.items.length !== 1 ? 's' : ''}${list.id === defaultListId ? ' · default' : ''}`}
                onPress={() => {
                  setEditingListId(list.id);
                  setListName(list.name);
                  setEditingIsDefault(list.id === defaultListId);
                  setModal('edit');
                }}
              />
              {i < lists.length - 1 && <Sep />}
            </View>
          ))
        )}
        <Sep />
        <TouchableOpacity
          style={styles.addRow}
          onPress={() => {
            setListName('');
            setModal('new');
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.addLabel}>+ New list</Text>
        </TouchableOpacity>
      </Card>

      <Sheet visible={modal === 'new'} title="New list" onClose={() => setModal(null)}>
        <Field
          label="List name"
          value={listName}
          onChangeText={setListName}
          placeholder="e.g. Weekend Shop"
        />
        <PrimaryBtn label="Create list" onPress={handleCreate} loading={saving} />
        <SecondaryBtn label="Cancel" onPress={() => setModal(null)} />
        <View style={{ height: Spacing.xl }} />
      </Sheet>

      <Sheet visible={modal === 'edit'} title="Edit list" onClose={() => setModal(null)}>
        <Field
          label="List name"
          value={listName}
          onChangeText={setListName}
          placeholder="e.g. Weekend Shop"
        />
        <PrimaryBtn label="Save changes" onPress={handleRename} loading={saving} />
        {!editingIsDefault && (
          <PrimaryBtn label="Delete list" onPress={handleDelete} loading={saving} danger />
        )}
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
