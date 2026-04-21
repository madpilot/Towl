import React, { useEffect, useMemo, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import HouseIcon from '@/components/icons/HouseIcon';
import { useHouseholdStore, persistAndSelectHousehold } from '@/store/householdStore';
import { useAuthStore } from '@/store/authStore';
import { Colors, FontSize, Radii, Spacing } from '@/theme';
import type { Household } from '@/api/households';
import type { HouseholdPickerScreenProps } from '@/navigation/types';

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCards() {
  const shimmer = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 650, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [shimmer]);

  return (
    <View style={{ gap: 10 }} testID="household-loading">
      {[0, 1, 2].map((i) => (
        <Animated.View
          key={i}
          style={{
            height: 68,
            borderRadius: Radii.lg,
            backgroundColor: Colors.white,
            borderWidth: 2,
            borderColor: Colors.mintPale,
            opacity: shimmer,
          }}
        />
      ))}
    </View>
  );
}

// ─── Household row ────────────────────────────────────────────────────────────

type HouseholdRowProps = {
  household: Household;
  selected: boolean;
  onPress: () => void;
};

function HouseholdRow({ household, selected, onPress }: HouseholdRowProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[rowStyles.row, selected && rowStyles.rowSelected]}
    >
      <HouseIcon color={selected ? Colors.mint : Colors.mintLight} size={24} />
      <View style={{ flex: 1 }}>
        <Text style={[rowStyles.name, selected && rowStyles.nameSelected]}>{household.name}</Text>
      </View>
      <View style={[rowStyles.radio, selected && rowStyles.radioSelected]}>
        {selected && (
          <Svg width={10} height={8} viewBox="0 0 10 8" fill="none">
            <Path
              d="M1 4L3.5 6.5L9 1"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        )}
      </View>
    </TouchableOpacity>
  );
}

const rowStyles = {
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 14,
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.mintPale,
    borderRadius: Radii.lg,
    padding: 14,
  },
  rowSelected: {
    borderColor: Colors.mint,
    backgroundColor: `${Colors.mint}14`,
  },
  name: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: '#333',
  },
  nameSelected: {
    color: Colors.mint,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.mintPale,
    backgroundColor: Colors.white,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
  },
  radioSelected: {
    borderColor: Colors.mint,
    backgroundColor: Colors.mint,
  },
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HouseholdPickerScreen({ navigation }: HouseholdPickerScreenProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const selectedHousehold = useHouseholdStore((s) => s.selectedHousehold);
  const setStoreHouseholds = useHouseholdStore((s) => s.setHouseholds);
  const householdsApi = useAuthStore((s) => s.householdsApi);

  const canGoBack = navigation.canGoBack();

  // HouseholdPicker lives in both the null and non-null selectedHousehold
  // branches of MainNavigator, so React Navigation won't auto-transition when
  // the store changes. Explicitly reset to ListDetail once a household is
  // persisted (covers both the Done button and single-household auto-select).
  useEffect(() => {
    if (!canGoBack && selectedHousehold !== null) {
      navigation.reset({ index: 0, routes: [{ name: 'ListDetail' }] });
    }
  }, [selectedHousehold, canGoBack, navigation]);

  useEffect(() => {
    async function load() {
      try {
        const results = (await householdsApi?.getHouseholds()) ?? [];
        if (results.length === 0) {
          setError('No households found on this server.');
          return;
        }
        // During onboarding (no back stack) with a single household, auto-select
        // and let the navigator transition to ListDetail automatically.
        // When reached from the nav bar (canGoBack = true), always show the list
        // so the user can explicitly confirm or switch their household.
        if (results.length === 1 && !canGoBack) {
          await persistAndSelectHousehold(results[0]);
          return;
        }
        setHouseholds(results);
        setStoreHouseholds(results);
        if (selectedHousehold) {
          setSelectedId(selectedHousehold.id);
        }
      } catch {
        setError('Could not load households. Check your network and try again.');
      } finally {
        setLoading(false);
      }
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSelect(household: Household) {
    setSelectedId(household.id);
    // In-app mode: persist immediately and go back.
    // In onboarding mode: the Done button handles persist; the conditional
    // render in RootNavigator transitions to ListDetail automatically.
    if (canGoBack) {
      await persistAndSelectHousehold(household);
      navigation.goBack();
    }
  }

  async function handleDone() {
    const household = households.find((h) => h.id === selectedId);
    if (!household) {
      return;
    }
    await persistAndSelectHousehold(household);
    // MainNavigator auto-transitions when selectedHousehold becomes non-null.
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
          <Text style={styles.title}>Households</Text>
          {!canGoBack && (
            <TouchableOpacity
              style={styles.doneBtn}
              onPress={handleDone}
              disabled={selectedId === null}
              activeOpacity={0.7}
              testID="done-button"
            >
              <Text style={[styles.doneText, selectedId === null && styles.doneTextDisabled]}>
                Done
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.listContainer}>
          <SkeletonCards />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : (
        <View style={styles.listContainer}>
          {households.map((hh) => (
            <HouseholdRow
              key={hh.id}
              household={hh}
              selected={selectedId === hh.id}
              onPress={() => handleSelect(hh)}
            />
          ))}
        </View>
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
    paddingHorizontal: Spacing.xl,
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
    justifyContent: 'space-between',
  },
  title: {
    fontSize: FontSize.title,
    fontWeight: '900',
    color: Colors.mint,
    letterSpacing: -0.5,
  },
  doneBtn: {
    paddingVertical: 4,
    paddingLeft: Spacing.md,
  },
  doneText: {
    fontSize: FontSize.body,
    color: Colors.mint,
    fontWeight: '700',
  },
  doneTextDisabled: {
    color: Colors.mintLight,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
  },
  error: {
    fontSize: FontSize.body,
    color: Colors.deleteRedStrong,
    textAlign: 'center',
    fontWeight: '600',
  },
  listContainer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    gap: Spacing.sm,
  },
});
