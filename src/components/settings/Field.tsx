import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Colors, Spacing, Radii, FontSize } from '@/theme';

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
};

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
}: FieldProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
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

const styles = StyleSheet.create({
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
