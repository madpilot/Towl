import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { getHouseholds } from '@/api/households';
import { useHouseholdStore } from '@/store/householdStore';
import type { Household } from '@/api/households';

export default function HouseholdPickerScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [households, setHouseholds] = useState<Household[]>([]);
  const selectHousehold = useHouseholdStore((s) => s.selectHousehold);

  useEffect(() => {
    async function load() {
      try {
        const results = await getHouseholds();
        if (results.length === 0) {
          setError('No households found on this server.');
          return;
        }
        if (results.length === 1) {
          selectHousehold(results[0]);
          return;
        }
        setHouseholds(results);
      } catch {
        setError('Could not load households. Check your network and try again.');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [selectHousehold]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" testID="household-loading" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={households}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.item}
          onPress={() => selectHousehold(item)}
          activeOpacity={0.7}
        >
          <Text style={styles.name}>{item.name}</Text>
        </TouchableOpacity>
      )}
      contentContainerStyle={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16 },
  item: {
    paddingVertical: 18,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  name: { fontSize: 17, color: '#1a1a1a', fontWeight: '500' },
  error: { fontSize: 15, color: '#e53e3e', textAlign: 'center', padding: 24 },
});
