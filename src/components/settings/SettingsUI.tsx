import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Colors, Spacing, Radii, FontSize } from '@/theme';

// ─── Section label ────────────────────────────────────────────────────────────

export function SectionLabel({ label }: { label: string }) {
  return (
    <View style={sectionStyles.row}>
      <Text style={sectionStyles.text}>{label.toUpperCase()}</Text>
      <View style={sectionStyles.rule} />
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xs,
  },
  text: {
    fontSize: FontSize.tiny,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: Colors.mintLight,
  },
  rule: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.mintPale,
  },
});

// ─── Card ─────────────────────────────────────────────────────────────────────

export function Card({ children }: { children: React.ReactNode }) {
  return <View style={cardStyles.card}>{children}</View>;
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radii.lg,
    borderWidth: 1.5,
    borderColor: Colors.mintPale,
    marginHorizontal: Spacing.lg,
    overflow: 'hidden',
  },
});

// ─── Separator ────────────────────────────────────────────────────────────────

export function Sep() {
  return <View style={{ height: 1, backgroundColor: Colors.mintBg, marginLeft: Spacing.xl }} />;
}

// ─── Row ──────────────────────────────────────────────────────────────────────

type RowProps = {
  label: string;
  sub?: string;
  onPress?: () => void;
  danger?: boolean;
  showChevron?: boolean;
};

export function Row({ label, sub, onPress, danger = false, showChevron = true }: RowProps) {
  return (
    <TouchableOpacity style={rowStyles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={rowStyles.text}>
        <Text style={[rowStyles.label, danger && rowStyles.dangerLabel]}>{label}</Text>
        {sub ? <Text style={rowStyles.sub}>{sub}</Text> : null}
      </View>
      {showChevron && <Text style={rowStyles.chevron}>›</Text>}
    </TouchableOpacity>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md + 2,
  },
  text: { flex: 1 },
  label: {
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.textDark,
  },
  dangerLabel: { color: '#e05555' },
  sub: {
    fontSize: FontSize.small,
    color: Colors.textFaded,
    marginTop: 2,
  },
  chevron: {
    fontSize: 20,
    color: Colors.mintPale,
    fontWeight: '700',
  },
});

// ─── Field ────────────────────────────────────────────────────────────────────

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
};

export function Field({ label, value, onChangeText, placeholder, secureTextEntry = false }: FieldProps) {
  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.label}>{label}</Text>
      <TextInput
        style={fieldStyles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textFaded}
        secureTextEntry={secureTextEntry}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrap: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm },
  label: {
    fontSize: FontSize.label,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: Colors.mintLight,
    marginBottom: Spacing.xs,
  },
  input: {
    fontSize: FontSize.body,
    fontWeight: '600',
    color: Colors.textDark,
    borderWidth: 1.5,
    borderColor: Colors.mintPale,
    borderRadius: Radii.md,
    padding: Spacing.md,
    backgroundColor: Colors.mintBg,
  },
});

// ─── Buttons ──────────────────────────────────────────────────────────────────

type PrimaryBtnProps = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  danger?: boolean;
};

export function PrimaryBtn({ label, onPress, loading = false, danger = false }: PrimaryBtnProps) {
  return (
    <TouchableOpacity
      style={[btnStyles.btn, danger && btnStyles.dangerBtn]}
      onPress={onPress}
      activeOpacity={0.8}
      disabled={loading}
    >
      {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={btnStyles.label}>{label}</Text>}
    </TouchableOpacity>
  );
}

export function SecondaryBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={btnStyles.secondaryBtn} onPress={onPress} activeOpacity={0.8}>
      <Text style={btnStyles.secondaryLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const btnStyles = StyleSheet.create({
  btn: {
    margin: Spacing.xl,
    marginBottom: 0,
    padding: Spacing.md + 1,
    borderRadius: Radii.md,
    backgroundColor: Colors.mint,
    alignItems: 'center',
  },
  dangerBtn: { backgroundColor: '#e05555' },
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
