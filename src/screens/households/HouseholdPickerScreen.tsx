import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { getHouseholds } from '@/api/households';
import { useHouseholdStore } from '@/store/householdStore';
import HouseIcon from '@/components/icons/HouseIcon';
import TommyOwl from '@/components/TommyOwl';
import { Colors, Spacing, Radii, FontSize } from '@/theme';
import type { Household } from '@/api/households';
import type { HouseholdPickerScreenProps } from '@/navigation/types';

export default function HouseholdPickerScreen({ navigation }: HouseholdPickerScreenProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [households, setHouseholds] = useState<Household[]>([]);

  const selectedHousehold = useHouseholdStore((s) => s.selectedHousehold);
  const selectHousehold = useHouseholdStore((s) => s.selectHousehold);

  const canGoBack = navigation.canGoBack();

  useEffect(() => {
    async function load() {
      try {
        const results = await getHouseholds();
        if (results.length === 0) {
          setError('No households found on this server.');
          return;
        }
        // During onboarding with a single household, auto-select and let the
        // navigator transition automatically (no explicit navigation needed).
        if (results.length === 1 && selectedHousehold === null) {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSelect(household: Household) {
    selectHousehold(household);
    // In-app mode: go back to the list. In onboarding mode, the conditional
    // render in RootNavigator transitions to ListDetail automatically.
    if (canGoBack) {
      navigation.goBack();
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        {canGoBack && (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Text style={styles.backText}>‹ Back</Text>
          </TouchableOpacity>
        )}
        <View style={styles.titleRow}>
          <HouseIcon color={Colors.mint} size={28} />
          <Text style={styles.title}>Households</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.mint} testID="household-loading" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <TommyOwl size={80} />
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={households}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const isSelected = selectedHousehold?.id === item.id;
            return (
              <TouchableOpacity
                style={[styles.item, isSelected && styles.itemSelected]}
                onPress={() => handleSelect(item)}
                activeOpacity={0.7}
              >
                <HouseIcon
                  color={isSelected ? Colors.white : Colors.mint}
                  size={20}
                />
                <Text style={[styles.itemName, isSelected && styles.itemNameSelected]}>
                  {item.name}
                </Text>
                {isSelected && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.mintBg,
  },
  header: {
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  backBtn: {
    alignSelf: 'flex-start',
  },
  backText: {
    fontSize: FontSize.body,
    color: Colors.mint,
    fontWeight: '600',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  title: {
    fontSize: FontSize.title,
    fontWeight: '900',
    color: Colors.mint,
    letterSpacing: -0.5,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xl,
    paddingHorizontal: Spacing.xxl,
  },
  error: {
    fontSize: FontSize.body,
    color: Colors.deleteRedStrong,
    textAlign: 'center',
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xxl,
    gap: Spacing.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.lg - 2,
    paddingHorizontal: Spacing.xl,
    backgroundColor: Colors.white,
    borderRadius: Radii.lg,
    shadowColor: Colors.mint,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  itemSelected: {
    backgroundColor: Colors.mint,
  },
  itemName: {
    flex: 1,
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.textDark,
  },
  itemNameSelected: {
    color: Colors.white,
  },
  checkmark: {
    fontSize: FontSize.body,
    color: Colors.white,
    fontWeight: '800',
  },
});
