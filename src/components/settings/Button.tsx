import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Colors, Spacing, Radii, FontSize } from '@/theme';

type PrimaryBtnProps = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  danger?: boolean;
  disabled?: boolean;
};

export function PrimaryBtn({ label, onPress, loading = false, danger = false, disabled = false }: PrimaryBtnProps) {
  return (
    <TouchableOpacity
      style={[styles.btn, danger && styles.dangerBtn, (disabled || loading) && styles.btnDisabled]}
      onPress={onPress}
      activeOpacity={0.8}
      disabled={loading || disabled}
    >
      {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.label}>{label}</Text>}
    </TouchableOpacity>
  );
}

export function SecondaryBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.secondaryBtn} onPress={onPress} activeOpacity={0.8}>
      <Text style={styles.secondaryLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    margin: Spacing.xl,
    marginBottom: 0,
    padding: Spacing.md + 1,
    borderRadius: Radii.md,
    backgroundColor: Colors.mint,
    alignItems: 'center',
  },
  dangerBtn: { backgroundColor: '#e05555' },
  btnDisabled: { opacity: 0.5 },
  label: { fontSize: FontSize.body, fontWeight: '800', color: Colors.white },
  secondaryBtn: {
    margin: Spacing.xl,
    marginBottom: 0,
    padding: Spacing.md + 1,
    borderRadius: Radii.md,
    borderWidth: 1.5,
    borderColor: Colors.mintPale,
    alignItems: 'center',
  },
  secondaryLabel: { fontSize: FontSize.body, fontWeight: '800', color: Colors.mint },
});
