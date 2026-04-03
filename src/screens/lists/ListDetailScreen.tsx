import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as itemsDb from '@/db/items';
import * as syncQueue from '@/db/syncQueue';
import * as shoppingListsApi from '@/api/shoppinglists';
import { recordItemUsed } from '@/db/history';
import { matchItem } from '@/data/foodMatcher';
import AddItemSheet from '@/components/AddItemSheet';
import type { LocalItem } from '@/db/items';
import type { ListDetailScreenProps } from '@/navigation/types';

export default function ListDetailScreen({ route }: ListDetailScreenProps) {
  const { listLocalId, listServerId } = route.params;

  const [items, setItems] = useState<LocalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);

  const addSheetRef = useRef<{ focus: () => void }>(null);

  const loadFromDb = useCallback(async () => {
    const rows = await itemsDb.getItemsForList(listLocalId);
    setItems(rows);
  }, [listLocalId]);

  const syncFromServer = useCallback(async () => {
    if (listServerId === null) return;
    try {
      const apiItems = await shoppingListsApi.getShoppingListItems(listServerId);
      for (const apiItem of apiItems) {
        const match = matchItem(apiItem.item.icon ?? apiItem.item.name);
        await itemsDb.upsertItemFromServer(
          apiItem.item_id,
          listLocalId,
          apiItem.item.name,
          apiItem.description,
          match.iconKey,
          match.category
        );
      }
      await loadFromDb();
    } catch {
      // Offline — local data is fine
    }
  }, [listServerId, listLocalId, loadFromDb]);

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

  const handleRemoveItem = useCallback((item: LocalItem) => {
    Alert.alert(
      'Remove Item',
      `Remove "${item.name}" from the list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await itemsDb.softDeleteItem(item.localId);
            if (item.serverId !== null && listServerId !== null) {
              await syncQueue.enqueue(
                {
                  opType: 'REMOVE_ITEM',
                  listServerId,
                  itemServerId: item.serverId,
                  itemLocalId: item.localId,
                },
                listLocalId
              );
            } else {
              await itemsDb.hardDeleteItem(item.localId);
            }
            await loadFromDb();
          },
        },
      ]
    );
  }, [listServerId, listLocalId, loadFromDb]);

  const handleAddItem = useCallback(async (name: string, description: string) => {
    const match = matchItem(name);
    const newItem = await itemsDb.addItemLocally(
      listLocalId,
      name,
      description,
      match.iconKey,
      match.category
    );
    await recordItemUsed(name, match.iconKey, match.category);

    if (listServerId !== null) {
      await syncQueue.enqueue(
        {
          opType: 'ADD_ITEM',
          listServerId,
          listLocalId,
          itemLocalId: newItem.localId,
          name,
          description,
        },
        listLocalId
      );
    }
    await loadFromDb();
  }, [listLocalId, listServerId, loadFromDb]);

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
        data={items}
        keyExtractor={(item) => item.localId}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.itemRow}
            onLongPress={() => handleRemoveItem(item)}
            activeOpacity={0.7}
          >
            <Text style={styles.itemEmoji}>{item.category === 'Other' ? '🛒' : undefined}</Text>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.name}</Text>
              {item.description ? (
                <Text style={styles.itemDesc}>{item.description}</Text>
              ) : null}
            </View>
            {item.isDirty && <View style={styles.dirtyDot} />}
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>List is empty.</Text>
            <Text style={styles.emptyHint}>Tap + to add items.</Text>
          </View>
        }
        contentContainerStyle={items.length === 0 ? styles.emptyContainer : undefined}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setSheetVisible(true)}
        activeOpacity={0.85}
        testID="add-item-fab"
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <AddItemSheet
        ref={addSheetRef}
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onAdd={handleAddItem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f8f8' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  itemEmoji: { fontSize: 22, width: 30, textAlign: 'center' },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 16, color: '#1a1a1a' },
  itemDesc: { fontSize: 13, color: '#888', marginTop: 2 },
  dirtyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f59e0b',
  },
  separator: { height: 1, backgroundColor: '#f0f0f0', marginLeft: 58 },
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
});
