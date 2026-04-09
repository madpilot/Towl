import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, FontSize } from '@/theme';

export function SectionLabel({ label }: { label: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.text}>{label.toUpperCase()}</Text>
      <View style={styles.rule} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xs,
  },
  text: { fontSize: FontSize.tiny, fontWeight: '800', letterSpacing: 1.2, color: Colors.mintLight },
  rule: { flex: 1, height: 1, backgroundColor: Colors.mintPale },
});
