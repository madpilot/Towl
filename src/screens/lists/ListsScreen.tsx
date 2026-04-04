import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  RefreshControl,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as listsDb from '@/db/lists';
import * as syncQueue from '@/db/syncQueue';
import * as shoppingListsApi from '@/api/shoppinglists';
import { useHouseholdStore } from '@/store/householdStore';
import { useAuthStore } from '@/store/authStore';
import type { LocalList } from '@/db/lists';
import type { ListsScreenProps } from '@/navigation/types';

function ListSeparator() {
  return <View style={styles.separator} />;
}

export default function ListsScreen({ navigation }: ListsScreenProps) {
  const [lists, setLists] = useState<LocalList[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [creating, setCreating] = useState(false);

  const selectedHousehold = useHouseholdStore((s) => s.selectedHousehold);
  const serverUrl = useAuthStore((s) => s.serverUrl);

  const householdId = selectedHousehold?.id ?? 0;

  const loadFromDb = useCallback(async () => {
    const rows = await listsDb.getAllLists(householdId);
    setLists(rows);
  }, [householdId]);

  const syncFromServer = useCallback(async () => {
    if (!serverUrl) return;
    try {
      const apiLists = await shoppingListsApi.getShoppingLists();
      for (const apiList of apiLists) {
        const existing = await listsDb.getListByServerId(apiList.id);
        await listsDb.upsertListFromServer(
          apiList.id,
          apiList.household_id,
          apiList.name,
          existing?.localId
        );
      }
      await loadFromDb();
    } catch {
      // Offline — local data is fine
    }
  }, [serverUrl, loadFromDb]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      loadFromDb()
        .then(() => { if (active) setLoading(false); })
        .catch(() => { if (active) setLoading(false); });
      syncFromServer().catch(() => {});
      return () => { active = false; };
    }, [loadFromDb, syncFromServer])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await syncFromServer().catch(() => {});
    setRefreshing(false);
  }, [syncFromServer]);

  const handleCreateList = useCallback(async () => {
    const name = newListName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const newList = await listsDb.createListLocally(householdId, name);
      await syncQueue.enqueue(
        { opType: 'CREATE_LIST', listLocalId: newList.localId, name },
        newList.localId
      );
      setCreateModalVisible(false);
      setNewListName('');
      await loadFromDb();
    } catch {
      Alert.alert('Error', 'Could not create list. Please try again.');
    } finally {
      setCreating(false);
    }
  }, [newListName, householdId, loadFromDb]);

  const handleDeleteList = useCallback((list: LocalList) => {
    Alert.alert(
      'Delete List',
      `Delete "${list.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await listsDb.softDeleteList(list.localId);
            if (list.serverId !== null) {
              await syncQueue.enqueue(
                {
                  opType: 'DELETE_LIST',
                  listLocalId: list.localId,
                  listServerId: list.serverId,
                },
                list.localId
              );
            } else {
              await listsDb.hardDeleteList(list.localId);
            }
            await loadFromDb();
          },
        },
      ]
    );
  }, [loadFromDb]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={lists}
        keyExtractor={(item) => item.localId}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.listItem}
            onPress={() =>
              navigation.navigate('ListDetail', {
                listLocalId: item.localId,
                listName: item.name,
                listServerId: item.serverId,
              })
            }
            onLongPress={() => handleDeleteList(item)}
            activeOpacity={0.7}
          >
            <Text style={styles.listName}>{item.name}</Text>
            {item.isDirty && <View style={styles.dirtyDot} />}
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={ListSeparator}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No shopping lists yet.</Text>
            <Text style={styles.emptyHint}>Tap + to create one.</Text>
          </View>
        }
        contentContainerStyle={lists.length === 0 ? styles.emptyContainer : undefined}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setCreateModalVisible(true)}
        activeOpacity={0.85}
        testID="create-list-fab"
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal
        visible={createModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => { setCreateModalVisible(false); setNewListName(''); }}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New List</Text>
            <TextInput
              style={styles.modalInput}
              value={newListName}
              onChangeText={setNewListName}
              placeholder="List name"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCreateList}
              editable={!creating}
              testID="new-list-input"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => { setCreateModalVisible(false); setNewListName(''); }}
                disabled={creating}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalCreate, creating ? styles.modalCreateDisabled : undefined]}
                onPress={handleCreateList}
                disabled={creating}
                testID="confirm-create-list"
              >
                {creating
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.modalCreateText}>Create</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f8f8' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  listName: { flex: 1, fontSize: 17, color: '#1a1a1a' },
  dirtyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f59e0b',
  },
  separator: { height: 1, backgroundColor: '#f0f0f0', marginLeft: 20 },
  emptyContainer: { flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText: { fontSize: 17, color: '#888', marginBottom: 4 },
  emptyHint: { fontSize: 14, color: '#aaa' },
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabText: { fontSize: 28, color: '#fff', lineHeight: 32 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
  },
  modalTitle: { fontSize: 18, fontWeight: '600', marginBottom: 16, color: '#1a1a1a' },
  modalInput: {
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#1a1a1a',
    marginBottom: 16,
  },
  modalButtons: { flexDirection: 'row', gap: 12 },
  modalCancel: {
    flex: 1,
    paddingVertical: 13,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#ddd',
  },
  modalCancelText: { fontSize: 15, color: '#555' },
  modalCreate: {
    flex: 1,
    paddingVertical: 13,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#2563eb',
  },
  modalCreateDisabled: { opacity: 0.6 },
  modalCreateText: { fontSize: 15, color: '#fff', fontWeight: '600' },
});
