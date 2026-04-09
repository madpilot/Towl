import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Spacing, FontSize } from '@/theme';

export type RowProps = {
  label: string;
  sub?: string;
  onPress?: () => void;
  danger?: boolean;
  showChevron?: boolean;
};

export function Row({ label, sub, onPress, danger = false, showChevron = true }: RowProps) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.text}>
        <Text style={[styles.label, danger && styles.dangerLabel]}>{label}</Text>
        {sub ? <Text style={styles.sub}>{sub}</Text> : null}
      </View>
      {showChevron && <Text style={styles.chevron}>›</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md + 2,
  },
  text: { flex: 1 },
  label: { fontSize: FontSize.body, fontWeight: '700', color: Colors.textDark },
  dangerLabel: { color: '#e05555' },
  sub: { fontSize: FontSize.small, color: Colors.textFaded, marginTop: 2 },
  chevron: { fontSize: 20, color: Colors.mintPale, fontWeight: '700' },
});
