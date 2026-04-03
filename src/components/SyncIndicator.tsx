import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { useSyncStore } from '@/store/syncStore';
import { useNetworkStore } from '@/sync/connectivityMonitor';

/**
 * Small status pill rendered in the navigation header (or as an overlay).
 * - Hidden when idle with no pending ops and online
 * - Amber pulsing dot when there are pending ops queued
 * - Blue spinning ring when actively syncing
 * - Red dot when last sync attempt errored
 * - Grey offline badge when no connectivity
 */
export default function SyncIndicator() {
  const status = useSyncStore((s) => s.status);
  const pendingCount = useSyncStore((s) => s.pendingCount);
  const isOnline = useNetworkStore((s) => s.isOnline);

  const [spin] = useState(() => new Animated.Value(0));
  const spinAnim = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (status === 'syncing') {
      spinAnim.current = Animated.loop(
        Animated.timing(spin, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        })
      );
      spinAnim.current.start();
    } else {
      spinAnim.current?.stop();
      spin.setValue(0);
    }
    return () => { spinAnim.current?.stop(); };
  }, [status, spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (!isOnline) {
    return (
      <View style={[styles.pill, styles.pillOffline]} testID="sync-offline">
        <Text style={styles.pillText}>Offline</Text>
      </View>
    );
  }

  if (status === 'syncing') {
    return (
      <View style={styles.row} testID="sync-syncing">
        <Animated.View style={[styles.spinner, { transform: [{ rotate }] }]} />
        {pendingCount > 0 && (
          <Text style={styles.countText}>{pendingCount}</Text>
        )}
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={[styles.pill, styles.pillError]} testID="sync-error">
        <Text style={styles.pillText}>
          {pendingCount > 0 ? `${pendingCount} pending` : 'Sync error'}
        </Text>
      </View>
    );
  }

  if (pendingCount > 0) {
    return (
      <View style={[styles.pill, styles.pillPending]} testID="sync-pending">
        <Text style={styles.pillText}>{pendingCount} pending</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 12,
  },
  spinner: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#2563eb',
    borderTopColor: 'transparent',
  },
  countText: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '600',
  },
  pill: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginRight: 12,
  },
  pillText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  pillOffline: { backgroundColor: '#9ca3af' },
  pillError: { backgroundColor: '#ef4444' },
  pillPending: { backgroundColor: '#f59e0b' },
});
