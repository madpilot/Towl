import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors, Spacing, Radii } from '@/theme';

export function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radii.lg,
    borderWidth: 1.5,
    borderColor: Colors.mintPale,
    marginHorizontal: Spacing.lg,
    overflow: 'hidden',
  },
});
